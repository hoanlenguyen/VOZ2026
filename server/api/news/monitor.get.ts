import { newsDatabase } from '../../utils/news-monitor'

/** Freshness/queue metadata only; article bodies and AI credentials are never exposed. */
export default defineEventHandler(async event => {
  setResponseHeader(event, 'cache-control', 'no-store')
  const enabled = !!useRuntimeConfig().newsMonitorEnabled
  try {
    const db = await newsDatabase()
    const lastTick = await db.prepare("SELECT value FROM news_meta WHERE key='last-tick'").first<{ value: string }>()
    const feeds = (await db.prepare('SELECT source_id,url,status,interval_seconds,attempted_at,succeeded_at,next_due,failures,json_array_length(candidates) AS discoveredLinks FROM news_feeds ORDER BY source_id,url').all<{ source_id: string, url: string, status: string, interval_seconds: number, attempted_at: number | null, succeeded_at: number | null, next_due: number, failures: number, discoveredLinks: number }>()).results
    const jobs = (await db.prepare('SELECT status,COUNT(*) AS count FROM news_jobs GROUP BY status').all()).results
    const matches = await db.prepare("SELECT COUNT(*) AS count FROM news_matches WHERE status='scheduled' AND kickoff BETWEEN ? AND ?").bind(Date.now() - 2 * 3600_000, Date.now() + 7 * 86400_000).first<{ count: number }>()
    const ai = await db.prepare('SELECT used FROM news_ai_budget WHERE day=?').bind(new Date().toISOString().slice(0, 10)).first<{ used: number }>()
    const articles = await db.prepare('SELECT COUNT(*) AS count,MAX(verified_at) AS lastVerified FROM news_articles').first<{ count: number, lastVerified: number | null }>()
    const backlog = await db.prepare("SELECT MIN(due_at) AS oldest FROM news_jobs WHERE status='pending'").first<{ oldest: number | null }>()
    return { enabled, available: true, lastTick: lastTick ? new Date(Number(lastTick.value)).toISOString() : null, activeMatches: matches?.count ?? 0,
      feeds: feeds.map(feed => ({ ...feed, stale: !feed.succeeded_at || Date.now() - feed.succeeded_at > Math.max(300_000, feed.interval_seconds * 3000) })), jobs,
      verifiedArticles: articles?.count ?? 0, lastArticleVerification: articles?.lastVerified ? new Date(articles.lastVerified).toISOString() : null,
      oldestPendingSeconds: backlog?.oldest ? Math.max(0, Math.floor((Date.now() - backlog.oldest) / 1000)) : 0,
      assessmentsToday: ai?.used ?? 0, assessmentDailyLimit: Number(useRuntimeConfig().newsAssessmentDailyLimit) }
  }
  catch { setResponseStatus(event, 503); return { enabled, available: false, note: 'News monitoring storage is unavailable.' } }
})
