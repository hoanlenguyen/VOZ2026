// Newsroom agent: turns SportWorld matches (simulated match data, server/utils/mock-sports.ts) into
// AI match posts that wait for the newsroom's review. Per match:
//   1. the match file -> Match + extras (toMock) -> fact ledger (buildFacts), as for the demo match
//   2. the story agent writes the checked story per language (standard, neutral); without a checked
//      story the harness falls back to the facts themselves (origin "template")
//   3. trusted publishers' coverage (newsCoverageForMatch, NEWS_SOURCES) is attached as attributed
//      context: up to 3 articles about the fixture and 2 recent updates per team, as headline, source
//      and link. It never feeds the facts or the text.
//   4. stored in D1 (ai_posts) as "pending"; nothing reaches readers until the newsroom approves.
// Runs from the cron (AGENT_CRON, task newsroom:agent) when the newsroom's interval has passed,
// or at once from "Run now".

import type { AgentDesk, AgentRun, AgentRunResult, AgentSettings, AgentTrigger, AiPost, AiPostPress, AiPostStatus, AiPostSummary } from '#shared/types/ai-post'
import type { MatchStory } from '#shared/types/story'
import { COMPETITIONS } from '#shared/utils/competitions'
import { AGENT_CRON, AGENT_MATCHES_PER_RUN, agentDue, cleanAgentSettings, nextAgentRun } from '#shared/utils/newsroom-agent'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ai_posts (id TEXT PRIMARY KEY, match_key TEXT NOT NULL UNIQUE, competition TEXT NOT NULL, match_id TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, summary TEXT, body TEXT);
CREATE INDEX IF NOT EXISTS ai_posts_status ON ai_posts(status, created_at);
`
/** A post stuck in "writing" this long (a crashed run) may be written again. */
const STALE_MS = 10 * 60_000
const MAX_ATTEMPTS = 3
const PRESS_TIMEOUT_MS = 25_000

let ready: Promise<Awaited<ReturnType<typeof sportWorldDb>>> | undefined
async function db() {
  if (!ready) ready = sportWorldDb().then(async (d) => { await d.exec(SCHEMA); return d }).catch((e) => { ready = undefined; throw e })
  return ready
}

const kv = () => useStorage('kvcache')
export async function agentSettings(): Promise<AgentSettings> {
  return cleanAgentSettings(await kv().getItem<AgentSettings>('newsroom:agent:settings').catch(() => null))
}
export async function saveAgentSettings(input: Partial<AgentSettings>): Promise<AgentSettings> {
  const settings = cleanAgentSettings(input)
  await kv().setItem('newsroom:agent:settings', settings)
  return settings
}
export async function lastAgentRun(): Promise<AgentRun | null> {
  return kv().getItem<AgentRun>('newsroom:agent:lastrun').catch(() => null)
}

export const postIdFor = (competition: string, matchId: string) => `sw-${competition}-${matchId}`

/** SportWorld matches without a post (or whose post failed and may be retried), oldest first. */
async function waitingMatches(limit: number): Promise<Array<{ id: string, competition: string }>> {
  const { results } = await (await db()).prepare(`SELECT m.id, m.competition FROM mock_sports_matches m
    LEFT JOIN ai_posts p ON p.match_key = m.competition || ':' || m.id
    WHERE p.id IS NULL OR (p.status='failed' AND p.attempts<?1) OR (p.status='writing' AND p.updated_at<?2)
    ORDER BY m.created_at, m.id LIMIT ?3`).bind(MAX_ATTEMPTS, Date.now() - STALE_MS, limit).all<{ id: string, competition: string }>()
  return results
}

/** Claims a match for writing: one atomic write, so overlapping runs never write the same post. */
async function claim(competition: string, matchId: string, now: number): Promise<boolean> {
  const row = await (await db()).prepare(`INSERT INTO ai_posts (id, match_key, competition, match_id, status, attempts, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, 'writing', 1, ?5, ?5)
    ON CONFLICT(id) DO UPDATE SET status='writing', attempts=attempts+1, updated_at=?5
    WHERE (ai_posts.status='failed' AND ai_posts.attempts<?6) OR (ai_posts.status='writing' AND ai_posts.updated_at<?7)
    RETURNING id`).bind(postIdFor(competition, matchId), `${competition}:${matchId}`, competition, matchId, now, MAX_ATTEMPTS, now - STALE_MS).first<{ id: string }>()
  return !!row
}

function summaryOf(post: AiPost): AiPostSummary {
  const story: MatchStory | undefined = post.stories.en ?? Object.values(post.stories)[0]
  return {
    id: post.id, status: post.status, createdAt: post.createdAt, competitionId: post.competitionId, competitionName: post.competitionName,
    matchId: post.matchId, match: post.match, headline: story?.headline ?? `${post.match.home} ${post.match.score.home}–${post.match.score.away} ${post.match.away}`,
    origin: story?.origin ?? null, langs: Object.keys(post.stories) as AiPostSummary['langs'], pressCount: post.press.length, error: post.error,
  }
}

async function save(post: AiPost) {
  await (await db()).prepare('UPDATE ai_posts SET status=?, updated_at=?, summary=?, body=? WHERE id=?')
    .bind(post.status, Date.parse(post.updatedAt), JSON.stringify(summaryOf(post)), JSON.stringify(post), post.id).run()
}

const withTimeout = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))])

/** Trusted publishers' coverage: attribution only. Failure leaves the post without it. */
async function pressFor(match: Parameters<typeof newsCoverageForMatch>[0]): Promise<{ press: AiPostPress[], note: string | null }> {
  try {
    const coverage = await withTimeout(newsCoverageForMatch(match), PRESS_TIMEOUT_MS)
    const press = coverage.groups.flatMap(g => g.articles.slice(0, g.key === 'match' ? 3 : 2).map((a): AiPostPress => ({
      title: a.title, source: a.source, link: a.link, publishedAt: a.publishedAt, about: g.key, team: g.key === 'match' ? null : g.title,
    })))
    return { press, note: coverage.groups.find(g => g.key === 'match')?.note ?? null }
  }
  catch (err) {
    return { press: [], note: `Publisher coverage could not be checked (${(err as Error).message}).` }
  }
}

async function writePost(competition: string, matchId: string, settings: AgentSettings, trigger: AgentTrigger): Promise<AgentRunResult> {
  const id = postIdFor(competition, matchId)
  const now = Date.now()
  if (!await claim(competition, matchId, now)) return { matchId, label: matchId, status: 'failed', postId: null, error: 'already being written' }
  const def = COMPETITIONS.find(c => c.id === competition)
  const found = await getMockMatch(matchId).catch(() => null)
  const label = found ? `${found.file.matchInfo.homeTeam.name} ${found.file.matchInfo.homeTeam.score}–${found.file.matchInfo.awayTeam.score} ${found.file.matchInfo.awayTeam.name}` : matchId
  const base: AiPost = {
    id, matchKey: `${competition}:${matchId}`, competitionId: competition, competitionName: def?.name ?? competition, matchId,
    status: 'failed', createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), trigger, simulated: true,
    match: found
      ? { home: found.file.matchInfo.homeTeam.name, away: found.file.matchInfo.awayTeam.name, score: { home: found.file.matchInfo.homeTeam.score, away: found.file.matchInfo.awayTeam.score }, start: '', venue: found.file.matchInfo.venue ?? null }
      : { home: '', away: '', score: { home: 0, away: 0 }, start: '', venue: null },
    stories: {}, facts: [], names: [], press: [], pressNote: null, error: null,
  }
  try {
    if (!def || !found) throw new Error(!def ? `unknown competition ${competition}` : 'match no longer in SportWorld')
    const season = await providerFor(def).matches(def, {}).then(r => r.data, () => [])
    const { match, extras } = toMock(def, found.file, season, 'en')
    const facts = buildFacts(def, match, extras, season)
    const names = factNames(match, extras)
    base.match.start = match.start
    base.facts = facts
    base.names = names
    // Languages one after another: the story agent has its own rate limit and time budget.
    for (const lang of settings.langs) {
      base.stories[lang] = await runStoryAgent({ match, competitionName: def.name, facts, names, length: 'standard', tone: 'neutral', lang })
    }
    const { press, note } = await pressFor(match)
    base.press = press
    base.pressNote = note
    base.status = 'pending'
  }
  catch (err) {
    base.error = (err as Error).message
    console.warn(`[newsroom-agent] ${id}: ${base.error}`)
  }
  base.updatedAt = new Date().toISOString()
  await save(base)
  return { matchId, label, status: base.status === 'pending' ? 'created' : 'failed', postId: id, error: base.error }
}

let running: Promise<AgentRun> | null = null

/** One run: the oldest waiting SportWorld matches (AGENT_MATCHES_PER_RUN), one after another. */
export function runNewsroomAgent(trigger: AgentTrigger): Promise<AgentRun> {
  // A run already going (cron and "Run now" together) is shared, not doubled.
  running ??= (async () => {
    const settings = await agentSettings()
    const results: AgentRunResult[] = []
    for (const m of await waitingMatches(AGENT_MATCHES_PER_RUN)) results.push(await writePost(m.competition, m.id, settings, trigger))
    const run: AgentRun = { at: new Date().toISOString(), trigger, results, waiting: (await waitingMatches(100)).length }
    await kv().setItem('newsroom:agent:lastrun', run).catch(() => undefined)
    return run
  })().finally(() => { running = null })
  return running
}

/** The cron tick: runs only when enabled and the newsroom's interval has passed. */
export async function runScheduledAgent(now = new Date()): Promise<AgentRun | null> {
  const [settings, last] = await Promise.all([agentSettings(), lastAgentRun()])
  if (!agentDue(settings, last?.at ?? null, now)) return null
  return runNewsroomAgent('schedule')
}

export async function listAiPosts(opts: { status?: AiPostStatus, limit?: number } = {}): Promise<AiPostSummary[]> {
  const { results } = await (await db())
    .prepare('SELECT summary FROM ai_posts WHERE summary IS NOT NULL AND (?1 IS NULL OR status=?1) ORDER BY created_at DESC LIMIT ?2')
    .bind(opts.status ?? null, Math.max(1, Math.min(100, opts.limit ?? 30))).all<{ summary: string }>()
  return results.map(r => JSON.parse(r.summary) as AiPostSummary)
}

export async function getAiPost(id: string): Promise<AiPost | null> {
  const row = await (await db()).prepare('SELECT body FROM ai_posts WHERE id=? AND body IS NOT NULL').bind(id).first<{ body: string }>()
  return row ? JSON.parse(row.body) as AiPost : null
}

export async function agentDesk(): Promise<AgentDesk> {
  const [settings, lastRun, posts, waiting] = await Promise.all([agentSettings(), lastAgentRun(), listAiPosts({ limit: 30 }), waitingMatches(100)])
  const next = nextAgentRun(settings, lastRun?.at ?? null, new Date())
  return { settings, cron: AGENT_CRON, lastRun, nextRunAt: next?.toISOString() ?? null, waiting: waiting.length, posts, aiConfigured: !!llmConfig().key }
}
