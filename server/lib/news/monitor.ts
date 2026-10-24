import type { Match } from '../../../shared/types/sports.ts'
import { COMPETITIONS } from '../../../shared/utils/competitions.ts'
import { claimNewsJob, reserveNewsAiCall, type NewsDatabase } from './database.ts'
import { createNewsCrawler } from './crawler.ts'
import { articleUrl, discoverArticles, readPublisherArticle, dateFromUrl, publicationTime, type Candidate } from './lookup.ts'
import { mentionsTeam, teamNameVariants } from './input.ts'
import { rankedNewsSources, SOURCE_POLICY_VERSION } from './source-policy.ts'
import { NEWS_SOURCES, type NewsSource } from './sources.ts'
import { digest } from './summary.ts'
import { basicNewsAssessment, preMatchScanSeconds, type CollectedNews, type NewsAssessment } from './pre-match.ts'

const DAY = 86400_000
export interface MonitoredFeed { id: string, source_id: string, url: string, interval_seconds: number, next_due: number, candidates: string, etag: string | null, last_modified: string | null, failures: number }
export interface StoredNewsArticle { id: string, source_id: string, document: string, content_hash: string, assessment: string | null, verified_at: number }
export const decodeCollectedNews = (row: StoredNewsArticle): CollectedNews => ({ document: JSON.parse(row.document), sourceId: row.source_id, contentHash: row.content_hash, verifiedAt: row.verified_at, assessment: row.assessment ? JSON.parse(row.assessment) : undefined })

export function createNewsMonitor(dependencies: {
  db: NewsDatabase
  fixtures: (competition: string) => Promise<Match[]>
  fetcher?: typeof fetch
  assess?: (article: CollectedNews['document']) => Promise<NewsAssessment>
  aiDailyLimit?: number
  now?: () => number
}) {
  const { db } = dependencies
  const now = dependencies.now ?? Date.now
  const pending = new Map<string, Promise<void>>()
  const crawler = (source: NewsSource) => createNewsCrawler(dependencies.fetcher, [source], { totalMs: 12_000, requestMs: 5000,
    beforeRequest: async (url, delay) => {
      const time = Date.now()
      const slot = await db.prepare(`INSERT INTO news_host_limits(origin,next_at) VALUES (?,?)
        ON CONFLICT(origin) DO UPDATE SET next_at=MAX(next_at,?)+? WHERE next_at<=? RETURNING next_at`)
        .bind(new URL(url).origin, time + delay, time, delay, time + 10_000).first<{ next_at: number }>()
      if (!slot) throw new Error('Publisher request budget reached')
      const wait = (slot?.next_at ?? time + delay) - delay - time
      if (wait > 10_000) throw new Error('Publisher request budget reached')
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
    },
  })
  const active = async () => (await db.prepare("SELECT body FROM news_matches WHERE status='scheduled' AND kickoff BETWEEN ? AND ? ORDER BY kickoff")
    .bind(now() - 2 * 3600_000, now() + 7 * DAY).all<{ body: string }>()).results.map(r => JSON.parse(r.body) as Match)
  const teamsFor = (matches: Match[]) => [...new Set(matches.flatMap(m => [...teamNameVariants(m.home), ...teamNameVariants(m.away)]))]
  const sourceForMatch = (source: NewsSource, match: Match) => rankedNewsSources(match.competitionId, teamsFor([match])).some(r => r.source.id === source.id)
  const allowedFeed = (source: NewsSource, url: string) => [...source.indexes, ...Object.values(source.teamIndexes ?? {}).flat()].includes(url)

  async function enqueue(kind: 'fixtures' | 'feed' | 'article', target: string, due: number, payload: object = {}) {
    const id = await digest(JSON.stringify([SOURCE_POLICY_VERSION, kind, target, Math.floor(due / 60_000)]))
    await db.prepare(`INSERT OR IGNORE INTO news_jobs(id,kind,target,payload,due_at) SELECT ?,?,?,?,?
      WHERE NOT EXISTS (SELECT 1 FROM news_jobs WHERE kind=? AND target=? AND status IN ('pending','running'))`)
      .bind(id, kind, target, JSON.stringify(payload), Math.max(due, now()), kind, target).run()
    return id
  }

  async function tick(send?: (id: string) => Promise<void>) {
    const time = now()
    const matches = await active()
    for (const c of COMPETITIONS) {
      const row = await db.prepare('SELECT value FROM news_meta WHERE key=?').bind(`fixtures:${c.id}`).first<{ value: string }>()
      const interval = matches.some(m => m.competitionId === c.id && Date.parse(m.start) - time <= 6 * 3600_000) ? 900_000 : 3600_000
      if (!row || Number(row.value) + interval <= time) await enqueue('fixtures', c.id, Math.floor(time / interval) * interval)
    }
    const feedPlans = new Map<string, { source: NewsSource, interval: number }>()
    for (const match of matches) for (const { source } of rankedNewsSources(match.competitionId, teamsFor([match]))) {
      const interval = preMatchScanSeconds(Date.parse(match.start), time)
      const indexes = [...source.indexes, ...teamsFor([match]).flatMap(name => source.teamIndexes?.[name] ?? [])]
      for (const url of indexes) {
        const previous = feedPlans.get(url)
        if (!previous || interval < previous.interval) feedPlans.set(url, { source, interval })
      }
    }
    for (const [url, plan] of feedPlans) {
      const id = await digest(`${SOURCE_POLICY_VERSION}:${plan.source.id}:${url}`)
      // Tightening the schedule must take effect even if the earlier scan set a long next_due.
      await db.prepare(`INSERT INTO news_feeds(id,source_id,url,interval_seconds,next_due) VALUES (?,?,?,?,0)
        ON CONFLICT(id) DO UPDATE SET interval_seconds=excluded.interval_seconds,
        next_due=CASE WHEN news_feeds.failures=0 THEN MIN(news_feeds.next_due,COALESCE(news_feeds.attempted_at,0)+excluded.interval_seconds*1000) ELSE news_feeds.next_due END`)
        .bind(id, plan.source.id!, url, plan.interval).run()
      const feed = await db.prepare('SELECT * FROM news_feeds WHERE id=?').bind(id).first<MonitoredFeed>()
      if (feed && feed.next_due <= time) await enqueue('feed', id, feed.next_due)
    }
    // Recover expired leases; a terminated Worker cannot leave a job stuck forever.
    await db.prepare("UPDATE news_jobs SET status='pending',lease_until=0,queued_at=0 WHERE status='running' AND lease_until<=?").bind(time).run()
    if (send) {
      const jobs = (await db.prepare("SELECT id FROM news_jobs WHERE status='pending' AND due_at<=? AND queued_at<=? ORDER BY CASE WHEN kind='fixtures' THEN 0 WHEN kind='article' AND json_extract(payload,'$.isNew')=1 THEN 1 WHEN kind='feed' THEN 2 ELSE 3 END,due_at,id LIMIT 100")
        .bind(time, time - 300_000).all<{ id: string }>()).results
      for (const job of jobs) {
        await send(job.id)
        await db.prepare('UPDATE news_jobs SET queued_at=? WHERE id=?').bind(time, job.id).run()
      }
    }
    await db.prepare('INSERT INTO news_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('last-tick', String(time)).run()
    await db.prepare('DELETE FROM news_articles WHERE seen_at<?').bind(time - 14 * DAY).run()
    await db.prepare('DELETE FROM news_article_aliases WHERE article_id NOT IN (SELECT id FROM news_articles)').run()
    await db.prepare("DELETE FROM news_jobs WHERE status IN ('done','failed') AND completed_at<?").bind(time - 3 * DAY).run()
    await db.prepare('DELETE FROM news_matches WHERE kickoff<?').bind(time - 2 * DAY).run()
    return { activeMatches: matches.length, feeds: feedPlans.size }
  }

  async function fixtures(competition: string) {
    const c = COMPETITIONS.find(c => c.id === competition)
    if (!c) return
    const matches = await dependencies.fixtures(c.id)
    for (const match of matches) {
      if (!Number.isFinite(Date.parse(match.start)) || Date.parse(match.start) < now() - 2 * 3600_000 || Date.parse(match.start) > now() + 7 * DAY) continue
      await db.prepare(`INSERT INTO news_matches(key,competition,kickoff,status,body,updated_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(key) DO UPDATE SET kickoff=excluded.kickoff,status=excluded.status,body=excluded.body,updated_at=excluded.updated_at`)
        .bind(match.key, c.id, Date.parse(match.start), match.status, JSON.stringify(match), now()).run()
    }
    // Delete fixtures removed from a provider's current schedule as well as updating status.
    const keys = new Set(matches.map(m => m.key))
    for (const existing of (await db.prepare('SELECT key FROM news_matches WHERE competition=?').bind(c.id).all<{ key: string }>()).results) {
      if (!keys.has(existing.key)) await db.prepare('DELETE FROM news_matches WHERE key=?').bind(existing.key).run()
    }
    await db.prepare('INSERT INTO news_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(`fixtures:${c.id}`, String(now())).run()
  }

  async function scanFeed(id: string) {
    const feed = await db.prepare('SELECT * FROM news_feeds WHERE id=?').bind(id).first<MonitoredFeed>()
    const source = NEWS_SOURCES.find(s => s.id === feed?.source_id)
    if (!feed || !source || !allowedFeed(source, feed.url)) return
    const matches = (await active()).filter(m => sourceForMatch(source, m))
    if (!matches.length) {
      await db.prepare('UPDATE news_feeds SET next_due=? WHERE id=?').bind(now() + feed.interval_seconds * 1000, id).run()
      return
    }
    const names = teamsFor(matches), time = now()
    await db.prepare('UPDATE news_feeds SET attempted_at=? WHERE id=?').bind(time, id).run()
    try {
      const page = await crawler(source)(feed.url, { etag: feed.etag ?? undefined, lastModified: feed.last_modified ?? undefined })
      const candidates: Candidate[] = page.notModified ? JSON.parse(feed.candidates) : discoverArticles(page.text, page.url, source)
      const relevant = candidates.filter(c => {
        const date = publicationTime(c.publishedAt || dateFromUrl(c.url) || '')
        if (Number.isFinite(date) && (date > time || date < time - 14 * DAY)) return false
        let path = new URL(c.url).pathname
        try { path = decodeURI(path) } catch { /* Keep publisher escapes as text. */ }
        return !!source.team || mentionsTeam(`${c.title} ${c.description} ${path}`, names)
      })
      // Recent verified pages are revisited even with a 304 feed: corrections need not change a feed.
      for (const candidate of relevant.slice(0, 30)) {
        const articleId = await digest(candidate.url)
        const existing = await db.prepare('SELECT verified_at FROM news_articles WHERE id=? OR id=(SELECT article_id FROM news_article_aliases WHERE alias_id=?)').bind(articleId, articleId).first<{ verified_at: number }>()
        if (!existing || existing.verified_at + Math.max(120, feed.interval_seconds) * 1000 <= time) await enqueue('article', candidate.url, time, { sourceId: source.id, candidate, isNew: !existing })
      }
      await db.prepare(`UPDATE news_feeds SET succeeded_at=?,failures=0,status=?,next_due=?,candidates=?,etag=?,last_modified=? WHERE id=?`)
        .bind(time, candidates.length ? 'ok' : 'empty', time + feed.interval_seconds * 1000, JSON.stringify(candidates), page.etag ?? feed.etag, page.lastModified ?? feed.last_modified, id).run()
    }
    catch {
      const backoff = Math.min(3600, Math.max(feed.interval_seconds, 60 * 2 ** Math.min(feed.failures, 6)))
      await db.prepare("UPDATE news_feeds SET failures=failures+1,status='unavailable',next_due=? WHERE id=?").bind(time + backoff * 1000, id).run()
      // Source failures use the feed's own backoff; queue retries would bypass it.
    }
  }

  async function scanArticle(url: string, payload: string) {
    const value = JSON.parse(payload) as { sourceId: string, candidate: Candidate }
    const source = NEWS_SOURCES.find(s => s.id === value.sourceId)
    if (!source || !articleUrl(url, url, source) || value.candidate.url !== url) return
    const matches = (await active()).filter(m => sourceForMatch(source, m))
    if (!matches.length) return
    const id = await digest(url)
    const removeArticle = () => db.prepare('DELETE FROM news_articles WHERE id=? OR url=? OR id=(SELECT article_id FROM news_article_aliases WHERE alias_id=?)').bind(id, url, id).run()
    let page
    try { page = await crawler(source)(url) }
    catch (error) {
      if (/disallowed|restrict|HTTP (?:404|410)/i.test((error as Error).message)) {
        await removeArticle()
        return
      }
      throw error
    }
    const document = readPublisherArticle(page.text, page.url, value.candidate, source)
    const time = now()
    if (!document || document.text.length < 150 || !articleUrl(page.url, page.url, source) || Date.parse(document.publishedAt) > time || Date.parse(document.publishedAt) < time - 14 * DAY) {
      // A newly restricted/removed article must not keep being selected from an old snapshot.
      await removeArticle()
      return
    }
    if (!source.team && !mentionsTeam(`${document.title} ${document.description}`, teamsFor(matches))) { await removeArticle(); return }
    const canonicalId = await digest(document.link)
    const previous = await db.prepare('SELECT * FROM news_articles WHERE id=?').bind(canonicalId).first<StoredNewsArticle>()
    const contentHash = await digest(JSON.stringify([document.title, document.description, document.text, document.publishedAt]))
    let assessment = previous?.content_hash === contentHash && previous.assessment ? JSON.parse(previous.assessment) as NewsAssessment : basicNewsAssessment(document)
    if (previous?.content_hash !== contentHash && dependencies.assess && await reserveNewsAiCall(db, time, dependencies.aiDailyLimit ?? 100)) {
      try { assessment = await dependencies.assess(document) } catch { /* Safe deterministic ranking remains available; never cache an invented assessment. */ }
    }
    await db.prepare(`INSERT INTO news_articles(id,source_id,url,published_at,document,content_hash,assessment,verified_at,seen_at) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET document=excluded.document,content_hash=excluded.content_hash,assessment=excluded.assessment,published_at=excluded.published_at,verified_at=excluded.verified_at,seen_at=excluded.seen_at`)
      .bind(canonicalId, source.id!, document.link, Date.parse(document.publishedAt), JSON.stringify(document), contentHash, JSON.stringify(assessment), time, time).run()
    await db.prepare('INSERT INTO news_article_aliases(alias_id,article_id) VALUES (?,?) ON CONFLICT(alias_id) DO UPDATE SET article_id=excluded.article_id').bind(id, canonicalId).run()
  }

  async function process(id: string) {
    if (pending.has(id)) return pending.get(id)!
    const request = (async () => {
      const job = await claimNewsJob(db, id, now())
      if (!job) return
      try {
        if (job.kind === 'fixtures') await fixtures(job.target)
        else if (job.kind === 'feed') await scanFeed(job.target)
        else if (job.kind === 'article') await scanArticle(job.target, job.payload)
        await db.prepare("UPDATE news_jobs SET status='done',completed_at=?,lease_until=0,error=NULL WHERE id=?").bind(now(), id).run()
      }
      catch {
        const failed = job.attempts >= 4
        await db.prepare('UPDATE news_jobs SET status=?,due_at=?,lease_until=0,queued_at=0,completed_at=?,error=? WHERE id=?')
          .bind(failed ? 'failed' : 'pending', now() + 60_000 * 2 ** Math.min(job.attempts, 4), failed ? now() : null, 'Processing unavailable', id).run()
        throw new Error('News job processing unavailable')
      }
    })()
    pending.set(id, request)
    try { await request } finally { pending.delete(id) }
  }

  async function drain(limit = 8) {
    const jobs = (await db.prepare("SELECT id FROM news_jobs WHERE status='pending' AND due_at<=? ORDER BY CASE WHEN kind='fixtures' THEN 0 WHEN kind='article' AND json_extract(payload,'$.isNew')=1 THEN 1 WHEN kind='feed' THEN 2 ELSE 3 END,due_at,id LIMIT ?").bind(now(), limit).all<{ id: string }>()).results
    for (const job of jobs) { try { await process(job.id) } catch { /* Persisted backoff applies to the next tick. */ } }
    return jobs.length
  }
  return { tick, process, drain, active }
}
