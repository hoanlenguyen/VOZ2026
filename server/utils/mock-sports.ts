// SportWorld API store (the mock sports server): simulated match files (shared/utils/match-sim.ts)
// built from real finished football-data fixtures and kept in D1 (the news database, VOZ_NEWS_DB;
// SQLite in dev). Served openly by /sportworld/api/*, the feed the AI newsroom agent reads in place
// of a paid deep-data API.

import type { MatchFile, MockSportsMatchSummary } from '#shared/types/mock-sports'
import { COMPETITIONS, type CompetitionDef } from '#shared/utils/competitions'
import { fixtureFromFootballData, simulateMatch, type FdFixture, type FdTeam } from '#shared/utils/match-sim'
import { newsDatabase } from './news-monitor'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS mock_sports_matches (id TEXT PRIMARY KEY, competition TEXT NOT NULL, kickoff INTEGER NOT NULL, created_at INTEGER NOT NULL, summary TEXT NOT NULL, body TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS mock_sports_matches_created ON mock_sports_matches(created_at);
`
/** football-data competitions whose squads the free plan (and the snapshots) include. */
export const MOCK_SPORTS_COMPETITIONS = COMPETITIONS.filter(c => c.provider === 'football-data' && c.tier === 'TIER_ONE')

let ready: Promise<Awaited<ReturnType<typeof newsDatabase>>> | undefined
async function db() {
  if (!ready) ready = newsDatabase().then(async (d) => { await d.exec(SCHEMA); return d }).catch((e) => { ready = undefined; throw e })
  return ready
}

export function mockSportsCompetition(id: unknown): CompetitionDef {
  const c = MOCK_SPORTS_COMPETITIONS.find(x => x.id === id)
  if (!c) throw createError({ statusCode: 400, statusMessage: `Unknown competition; one of ${MOCK_SPORTS_COMPETITIONS.map(x => x.id).join(', ')}` })
  return c
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(fc|afc|cf)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Games the bundled deep-data mocks already cover (same home team, same day). */
async function bundledGames(c: CompetitionDef): Promise<Set<string>> {
  const storage = useStorage('assets:mocks')
  const files = await Promise.all((await storage.getKeys(c.id)).filter(k => k.endsWith('.json')).map(k => storage.getItem<MatchFile>(k)))
  return new Set(files.filter(f => !!f).map(f => `${fold(f!.matchInfo.homeTeam.name)}|${f!.matchInfo.kickoff.slice(0, 10)}`))
}

function summaryOf(c: CompetitionDef, file: MatchFile, kickoff: string, fixtureId: string, createdAt: number): MockSportsMatchSummary {
  const mi = file.matchInfo
  return {
    id: mi.matchId, competition: c.id, kickoff, createdAt: new Date(createdAt).toISOString(),
    home: mi.homeTeam.name, away: mi.awayTeam.name, score: { home: mi.homeTeam.score, away: mi.awayTeam.score }, fixtureId,
  }
}

/**
 * Simulates `count` new matches: the newest finished fixtures of the competition that have no
 * simulated or bundled match yet. Returns what was made (fewer when the season runs out).
 */
export async function generateMockMatches(c: CompetitionDef, count: number): Promise<MockSportsMatchSummary[]> {
  const [{ data: m }, { data: t }] = await Promise.all([
    upstream<{ matches: FdFixture[] }>('football-data', `competitions/${c.providerCode}/matches`),
    upstream<{ teams: FdTeam[] }>('football-data', `competitions/${c.providerCode}/teams`),
  ])
  const d = await db()
  const taken = new Set((await d.prepare('SELECT id FROM mock_sports_matches WHERE competition=?').bind(c.id).all<{ id: string }>()).results.map(r => r.id))
  const bundled = await bundledGames(c)
  const fixtures = m.matches
    .filter(x => !taken.has(String(x.id)))
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
    .map(x => fixtureFromFootballData(x, t.teams, { name: c.name, code: c.providerCode }))
    .filter(f => f !== null)
  const made: MockSportsMatchSummary[] = []
  for (const f of fixtures) {
    if (made.length >= count) break
    const now = Date.now()
    const file = simulateMatch(f, `voz-sim:${c.id}:${f.id}`, new Date(now))
    if (bundled.has(`${fold(f.home.name)}|${file.matchInfo.kickoff.slice(0, 10)}`)) continue
    const summary = summaryOf(c, file, f.utcDate, String(f.id), now)
    // INSERT OR IGNORE: two clicks at once cannot store the same match twice.
    const { meta } = await d.prepare('INSERT OR IGNORE INTO mock_sports_matches (id, competition, kickoff, created_at, summary, body) VALUES (?,?,?,?,?,?)')
      .bind(summary.id, c.id, Date.parse(f.utcDate), now, JSON.stringify(summary), JSON.stringify(file)).run()
    if (meta.changes) made.push(summary)
  }
  return made
}

/** Newest first; `since` (ISO) keeps matches created after it, for clients that poll. */
export async function listMockMatches(opts: { competition?: string, since?: string, limit?: number } = {}): Promise<MockSportsMatchSummary[]> {
  const since = opts.since ? Date.parse(opts.since) : 0
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50))
  const { results } = await (await db())
    .prepare('SELECT summary FROM mock_sports_matches WHERE (?1 IS NULL OR competition=?1) AND created_at>?2 ORDER BY created_at DESC, id LIMIT ?3')
    .bind(opts.competition ?? null, Number.isFinite(since) ? since : 0, limit).all<{ summary: string }>()
  return results.map(r => JSON.parse(r.summary) as MockSportsMatchSummary)
}

export async function getMockMatch(id: string): Promise<{ competition: string, file: MatchFile } | null> {
  const row = await (await db()).prepare('SELECT competition, body FROM mock_sports_matches WHERE id=?').bind(id).first<{ competition: string, body: string }>()
  return row ? { competition: row.competition, file: JSON.parse(row.body) as MatchFile } : null
}

export async function deleteMockMatch(id: string): Promise<boolean> {
  const { meta } = await (await db()).prepare('DELETE FROM mock_sports_matches WHERE id=?').bind(id).run()
  return meta.changes > 0
}
