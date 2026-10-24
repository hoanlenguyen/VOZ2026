import { NEWS_SCHEMA, type NewsDatabase } from '../lib/news/database'
import { createNewsMonitor, decodeCollectedNews, type StoredNewsArticle } from '../lib/news/monitor'
import { assessNewsArticle } from '../lib/news/assessment'
import { newsSummaryConfig } from './news-summary'
import { providerFor } from './sports'
import { COMPETITIONS } from '#shared/utils/competitions'
import type { Match } from '#shared/types/sports'

let database: Promise<NewsDatabase> | undefined
export async function newsDatabase(): Promise<NewsDatabase> {
  if (!database) database = (async () => {
    const binding = (globalThis as typeof globalThis & { __env__?: { VOZ_NEWS_DB?: NewsDatabase } }).__env__?.VOZ_NEWS_DB
    let db = binding
    if (!db && import.meta.dev) {
      const { mkdir } = await import('node:fs/promises')
      const { openLocalNewsDatabase } = await import('../lib/news/local-database')
      await mkdir('.data', { recursive: true })
      db = openLocalNewsDatabase('.data/news-watch.sqlite')
    }
    if (!db) throw new Error('News monitoring database is not configured')
    await db.exec(NEWS_SCHEMA)
    return db
  })().catch(error => { database = undefined; throw error })
  return database
}

export async function newsMonitor() {
  const config = useRuntimeConfig()
  const summaryConfigured = config.newsAiProvider === 'huggingface' ? !!config.hfToken : !!config.openaiApiKey
  return createNewsMonitor({
    db: await newsDatabase(), aiDailyLimit: Math.max(0, Math.min(1000, Number(config.newsAssessmentDailyLimit) || 0)),
    fixtures: async id => {
      const competition = COMPETITIONS.find(c => c.id === id)!
      const provider = providerFor(competition)
      if (provider.unavailableReason(competition)) return []
      return (await provider.matches(competition, {})).data
    },
    ...(summaryConfigured ? { assess: article => assessNewsArticle(article, newsSummaryConfig()) } : {}),
  })
}

export async function trackNewsMatch(match: Match) {
  const db = await newsDatabase()
  await db.prepare(`INSERT INTO news_matches(key,competition,kickoff,status,body,updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET kickoff=excluded.kickoff,status=excluded.status,body=excluded.body,updated_at=excluded.updated_at`)
    .bind(match.key, match.competitionId, Date.parse(match.start), match.status, JSON.stringify(match), Date.now()).run()
}

export async function collectedNews() {
  const db = await newsDatabase()
  return (await db.prepare('SELECT * FROM news_articles WHERE published_at>=? ORDER BY published_at DESC LIMIT 1500').bind(Date.now() - 14 * 86400_000).all<StoredNewsArticle>()).results.map(decodeCollectedNews)
}

export async function collectedArticleHash(id: string): Promise<string | undefined> {
  try { return (await (await newsDatabase()).prepare('SELECT content_hash FROM news_articles WHERE id=?').bind(id).first<{ content_hash: string }>())?.content_hash }
  catch { return undefined }
}

export async function recentlyVerifiedNews(id: string, contentHash: string) {
  const row = await (await newsDatabase()).prepare('SELECT * FROM news_articles WHERE id=? AND content_hash=? AND verified_at>=?')
    .bind(id, contentHash, Date.now() - 300_000).first<StoredNewsArticle>()
  return row ? decodeCollectedNews(row).document : undefined
}
