import assert from 'node:assert/strict'
import test from 'node:test'
import { NEWS_SCHEMA, claimNewsJob, reserveNewsAiCall, type NewsDatabase } from '../server/lib/news/database.ts'
import { openLocalNewsDatabase } from '../server/lib/news/local-database.ts'
import { createNewsMonitor, decodeCollectedNews, type StoredNewsArticle } from '../server/lib/news/monitor.ts'
import { preMatchScanSeconds, selectPreMatchNews, type CollectedNews } from '../server/lib/news/pre-match.ts'
import { validateNewsAssessment } from '../server/lib/news/assessment.ts'
import { COMPETITIONS } from '../shared/utils/competitions.ts'
import type { Match } from '../shared/types/sports.ts'

const time = Date.parse('2026-10-24T12:00:00Z')
function match(start = time + 30 * 60_000, id = '123'): Match {
  const side = (name: string) => ({ key: name, name, shortName: name, logo: null, score: null, rank: null, stats: {} })
  return { key: `premier-league:${id}`, id, competitionId: 'premier-league', sport: 'football', season: '2026', start: new Date(start).toISOString(), status: 'scheduled', finishType: null, round: 8, venue: null, attendance: null,
    home: side('Ipswich Town'), away: side('Nottingham Forest'), periods: [], shootout: null, goals: [], notCounted: [] }
}
async function database() { const db = openLocalNewsDatabase(':memory:'); await db.exec(NEWS_SCHEMA); return db }
async function track(db: NewsDatabase, m = match()) {
  await db.prepare('INSERT INTO news_matches(key,competition,kickoff,status,body,updated_at) VALUES (?,?,?,?,?,?)').bind(m.key, m.competitionId, Date.parse(m.start), m.status, JSON.stringify(m), time).run()
}
async function job(db: NewsDatabase, id: string, kind: string, target: string, payload: object = {}, due = time) {
  await db.prepare('INSERT INTO news_jobs(id,kind,target,payload,due_at) VALUES (?,?,?,?,?)').bind(id, kind, target, JSON.stringify(payload), due).run()
}
async function noFixtureJobs(db: NewsDatabase, now = time) {
  for (const c of COMPETITIONS) await db.prepare('INSERT INTO news_meta(key,value) VALUES (?,?)').bind(`fixtures:${c.id}`, String(now)).run()
}

test('pre-match checks tighten at 48 hours, six hours and one hour without inferring a live status', () => {
  assert.equal(preMatchScanSeconds(time + 72 * 3600_000, time), 3600)
  assert.equal(preMatchScanSeconds(time + 48 * 3600_000, time), 900)
  assert.equal(preMatchScanSeconds(time + 6 * 3600_000, time), 300)
  assert.equal(preMatchScanSeconds(time + 3600_000, time), 60)
  assert.equal(preMatchScanSeconds(time - 60_000, time), 60)
})

test('an atomic job claim excludes concurrent consumers; expired leases can be recovered', async () => {
  const db = await database()
  await job(db, 'one', 'fixtures', 'premier-league')
  const results = await Promise.all(Array.from({ length: 12 }, () => claimNewsJob(db, 'one', time)))
  assert.equal(results.filter(Boolean).length, 1)
  assert.equal(await claimNewsJob(db, 'one', time + 179_999), null)
  assert.ok(await claimNewsJob(db, 'one', time + 180_000))
})

test('queue redelivery processes a completed job once and persistent retries back off', async () => {
  const db = await database()
  let calls = 0, now = time
  await job(db, 'fixtures', 'fixtures', 'premier-league')
  const monitor = createNewsMonitor({ db, now: () => now, fixtures: async () => { calls++; return [match()] } })
  await Promise.all([monitor.process('fixtures'), monitor.process('fixtures')])
  await monitor.process('fixtures')
  assert.equal(calls, 1)
  await job(db, 'failure', 'fixtures', 'liiga')
  const broken = createNewsMonitor({ db, now: () => now, fixtures: async () => { throw new Error('Do not expose this provider response') } })
  await assert.rejects(broken.process('failure'), /unavailable/)
  const row = await db.prepare('SELECT status,due_at,error FROM news_jobs WHERE id=?').bind('failure').first<{ status: string, due_at: number, error: string }>()
  assert.equal(row?.status, 'pending')
  assert.equal(row?.due_at, time + 120_000)
  assert.equal(row?.error, 'Processing unavailable')
  now += 1000
  assert.equal(await claimNewsJob(db, 'failure', now), null)
})

test('the daily AI reservation is atomic, bounded and resets by UTC day', async () => {
  const db = await database()
  const reservations = await Promise.all(Array.from({ length: 20 }, () => reserveNewsAiCall(db, time, 3)))
  assert.equal(reservations.filter(Boolean).length, 3)
  assert.equal(await reserveNewsAiCall(db, time, 0), false)
  assert.equal(await reserveNewsAiCall(db, time + 86400_000, 3), true)
})

test('the scheduler monitors lower tiers after three articles exist and shares each feed across matches', async () => {
  const db = await database()
  await noFixtureJobs(db)
  await track(db, match(time + 72 * 3600_000, 'far'))
  await track(db, match(time + 30 * 60_000, 'near'))
  let now = time
  const monitor = createNewsMonitor({ db, now: () => now, fixtures: async () => [] })
  await monitor.tick()
  const feeds = (await db.prepare('SELECT url,source_id,interval_seconds FROM news_feeds').all<{ url: string, source_id: string, interval_seconds: number }>()).results
  assert.equal(new Set(feeds.map(f => f.url)).size, feeds.length)
  for (const id of ['premier-league', 'ipswich-town', 'nottingham-forest', 'bbc-sport', 'sky-sports', 'guardian']) assert.ok(feeds.some(f => f.source_id === id))
  assert.ok(feeds.every(f => f.interval_seconds === 60))
  const count = await db.prepare('SELECT COUNT(*) AS count FROM news_jobs').first<{ count: number }>()
  now += 60_000
  await monitor.tick()
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM news_jobs').first<{ count: number }>())?.count, count?.count, 'A queued feed must not accumulate a new job every minute')
})

test('unchanged feeds use conditional requests while changed article bodies are reclassified and versioned', async () => {
  const db = await database()
  await track(db)
  let now = time, changed = false, restricted = false, assessments = 0, conditional = 0
  const url = 'https://www.bbc.com/sport/football/articles/ipswich-injury'
  const feed = 'https://feeds.bbci.co.uk/sport/football/rss.xml'
  const rss = `<rss><channel><item><title>Ipswich Town injury update</title><link>${url}</link></item></channel></rss>`
  const fetcher = (async (input: string | URL | Request, options?: RequestInit) => {
    const address = String(input)
    if (address.endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /', { headers: { 'content-type': 'text/plain' } })
    if (address === feed) {
      if (new Headers(options?.headers).get('if-none-match') === 'rss-v1') { conditional++; return new Response(null, { status: 304 }) }
      return new Response(rss, { headers: { 'content-type': 'application/rss+xml', etag: 'rss-v1' } })
    }
    assert.equal(address, url)
    const body = changed ? 'Ipswich Town confirmed the player has recovered and is available for selection before their next match.' : 'Ipswich Town confirmed the player is unavailable after an injury in training before their next match.'
    return new Response(`<meta property="og:title" content="Ipswich Town injury update"><meta name="description" content="${body}"><meta property="article:published_time" content="2026-10-24T10:00:00Z"><article><p>${body} The manager discussed the latest team preparations at the press conference and said further updates would follow.</p></article>`, { headers: { 'content-type': 'text/html', ...(restricted ? { 'x-robots-tag': 'noai' } : {}) } })
  }) as typeof fetch
  const monitor = createNewsMonitor({ db, now: () => now, fixtures: async () => [], fetcher, assess: async doc => { assessments++; return { topic: 'injuries', importance: 3, certainty: 'reported', evidence: doc.description } } })
  await db.prepare('INSERT INTO news_feeds(id,source_id,url,interval_seconds,next_due) VALUES (?,?,?,?,?)').bind('bbc', 'bbc-sport', feed, 60, time).run()
  await job(db, 'feed1', 'feed', 'bbc')
  await monitor.process('feed1'); await monitor.drain()
  const first = await db.prepare('SELECT * FROM news_articles').first<StoredNewsArticle>()
  assert.ok(first)
  assert.equal(assessments, 1)
  now += 120_000
  await job(db, 'feed2', 'feed', 'bbc', {}, now)
  await monitor.process('feed2'); await monitor.drain()
  assert.equal(conditional, 1)
  assert.equal(assessments, 1, 'No AI call for unchanged publisher text')
  changed = true; now += 120_000
  await job(db, 'feed3', 'feed', 'bbc', {}, now)
  await monitor.process('feed3'); await monitor.drain()
  const corrected = await db.prepare('SELECT * FROM news_articles').first<StoredNewsArticle>()
  assert.notEqual(corrected?.content_hash, first.content_hash)
  assert.equal(assessments, 2)
  assert.match(decodeCollectedNews(corrected!).document.text, /recovered/)
  restricted = true; now += 120_000
  await job(db, 'feed4', 'feed', 'bbc', {}, now)
  await monitor.process('feed4'); await monitor.drain()
  assert.equal(await db.prepare('SELECT * FROM news_articles').first(), null)
})

test('fresh injury coverage can outrank an older official preview; unapproved or future articles are excluded', () => {
  const url = (id: string, slug: string) => id === 'ipswich-town' ? `https://www.itfc.co.uk/news/2026/october/24/${slug}`
    : id === 'bbc-sport' ? `https://www.bbc.com/sport/football/articles/${slug}`
      : id === 'sky-sports' ? `https://www.skysports.com/football/news/12345/${slug}` : `https://www.theguardian.com/football/2026/oct/24/${slug}`
  const article = (sourceId: string, title: string, ageHours: number, assessment: CollectedNews['assessment']): CollectedNews => ({ sourceId, contentHash: title, verifiedAt: time, assessment,
    document: { title, description: `${title} ahead of the next match.`, text: `${title} ahead of the next match. `.repeat(8), source: sourceId, link: url(sourceId, String(ageHours)), summary: title, publishedAt: new Date(time - ageHours * 3600_000).toISOString() } })
  const routine = { topic: 'form' as const, importance: 1 as const, certainty: 'reported' as const, evidence: '' }
  const injury = { topic: 'injuries' as const, importance: 3 as const, certainty: 'reported' as const, evidence: '' }
  const pool = [article('ipswich-town', 'Ipswich Town preview form', 48, routine), article('bbc-sport', 'Ipswich Town injury: captain ruled out', 0.1, injury),
    article('sky-sports', 'Nottingham Forest injury update', 0.5, injury), article('unapproved', 'Ipswich Town injury exclusive', 0, injury), article('guardian', 'Ipswich Town future injury news', -1, injury)]
  const result = selectPreMatchNews(match(), pool, time)
  assert.equal(result.articles[0]?.sourceId, 'bbc-sport')
  assert.deepEqual(result.articles.map(a => a.sourceId), ['bbc-sport', 'sky-sports', 'ipswich-town'])
  assert.equal(result.teams[0]?.articles[0]?.sourceId, 'bbc-sport')
  const spoofed = { ...pool[1]!, document: { ...pool[1]!.document, link: 'https://evil.example/news/report' } }
  assert.equal(selectPreMatchNews(match(), [spoofed], time).articles.length, 0)
})

test('AI classifications need exact source evidence and rumours cannot receive breaking-news importance', () => {
  const document = { title: 'Ipswich Town injury update', description: 'Ipswich Town said the player may miss the next fixture.', text: '', source: 'BBC Sport', link: 'https://www.bbc.com/sport/football/articles/test', publishedAt: new Date(time).toISOString(), summary: '' }
  assert.equal(validateNewsAssessment({ topic: 'injuries', certainty: 'rumour', importance: 3, evidence: 'the player may miss the next fixture' }, document).importance, 1)
  assert.throws(() => validateNewsAssessment({ topic: 'injuries', certainty: 'confirmed', importance: 3, evidence: 'The player has definitely been ruled out' }, document), /Unsupported/)
})

test('a failed feed keeps its backoff when the scheduler runs again', async () => {
  const db = await database()
  await noFixtureJobs(db); await track(db)
  const url = 'https://feeds.bbci.co.uk/sport/football/rss.xml'
  await db.prepare("INSERT INTO news_feeds(id,source_id,url,interval_seconds,next_due,attempted_at,failures,status) VALUES (?,?,?,?,?,?,?,?)")
    .bind('failed', 'bbc-sport', url, 60, time + 480_000, time, 4, 'unavailable').run()
  // Use the scheduler's actual deterministic ID rather than injecting a duplicate plan.
  const { digest } = await import('../server/lib/news/summary.ts')
  const { SOURCE_POLICY_VERSION } = await import('../server/lib/news/source-policy.ts')
  await db.prepare('UPDATE news_feeds SET id=? WHERE id=?').bind(await digest(`${SOURCE_POLICY_VERSION}:bbc-sport:${url}`), 'failed').run()
  const monitor = createNewsMonitor({ db, now: () => time + 60_000, fixtures: async () => [] })
  await monitor.tick()
  const row = await db.prepare('SELECT next_due FROM news_feeds WHERE url=?').bind(url).first<{ next_due: number }>()
  assert.equal(row?.next_due, time + 480_000)
})
