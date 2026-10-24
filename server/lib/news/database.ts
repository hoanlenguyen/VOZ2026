export interface NewsStatement {
  bind(...values: (string | number | null)[]): NewsStatement
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { changes: number } }>
}
export interface NewsDatabase {
  prepare(sql: string): NewsStatement
  exec(sql: string): Promise<unknown>
}

// D1 and development SQLite share this additive, idempotent schema.
export const NEWS_SCHEMA = `
CREATE TABLE IF NOT EXISTS news_matches (key TEXT PRIMARY KEY, competition TEXT NOT NULL, kickoff INTEGER NOT NULL, status TEXT NOT NULL, body TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS news_matches_due ON news_matches(status, kickoff);
CREATE TABLE IF NOT EXISTS news_feeds (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, url TEXT NOT NULL, interval_seconds INTEGER NOT NULL, next_due INTEGER NOT NULL DEFAULT 0, attempted_at INTEGER, succeeded_at INTEGER, failures INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', candidates TEXT NOT NULL DEFAULT '[]', etag TEXT, last_modified TEXT);
CREATE TABLE IF NOT EXISTS news_articles (id TEXT PRIMARY KEY, source_id TEXT NOT NULL, url TEXT NOT NULL UNIQUE, published_at INTEGER NOT NULL, document TEXT NOT NULL, content_hash TEXT NOT NULL, assessment TEXT, verified_at INTEGER NOT NULL, seen_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS news_articles_recent ON news_articles(published_at);
CREATE TABLE IF NOT EXISTS news_article_aliases (alias_id TEXT PRIMARY KEY, article_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS news_jobs (id TEXT PRIMARY KEY, kind TEXT NOT NULL, target TEXT NOT NULL, payload TEXT NOT NULL, due_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, queued_at INTEGER NOT NULL DEFAULT 0, completed_at INTEGER, error TEXT);
CREATE INDEX IF NOT EXISTS news_jobs_due ON news_jobs(status, due_at);
CREATE INDEX IF NOT EXISTS news_jobs_target ON news_jobs(kind, target, status);
CREATE TABLE IF NOT EXISTS news_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS news_ai_budget (day TEXT PRIMARY KEY, used INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS news_host_limits (origin TEXT PRIMARY KEY, next_at INTEGER NOT NULL);
`

export interface NewsJob { id: string, kind: 'fixtures' | 'feed' | 'article', target: string, payload: string, due_at: number, status: string, attempts: number, lease_until: number, queued_at: number }

export async function claimNewsJob(db: NewsDatabase, id: string, now: number): Promise<NewsJob | null> {
  // One atomic write, not a KV read-then-write lock. Redelivery cannot claim an active job.
  return db.prepare(`UPDATE news_jobs SET status='running', attempts=attempts+1, lease_until=?
    WHERE id=? AND status IN ('pending','running') AND due_at<=? AND lease_until<=? RETURNING *`)
    .bind(now + 180_000, id, now, now).first<NewsJob>()
}

export async function reserveNewsAiCall(db: NewsDatabase, now: number, limit: number): Promise<boolean> {
  if (limit <= 0) return false
  const result = await db.prepare(`INSERT INTO news_ai_budget(day,used) VALUES (?,1)
    ON CONFLICT(day) DO UPDATE SET used=used+1 WHERE used<? RETURNING used`)
    .bind(new Date(now).toISOString().slice(0, 10), limit).first<{ used: number }>()
  return !!result
}
