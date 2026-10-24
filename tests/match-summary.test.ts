import assert from 'node:assert/strict'
import test from 'node:test'
import { matchNewsPolicy, matchStateKey } from '../server/lib/news/match-policy.ts'
import { createMatchSummaryService, type MatchDigestInput } from '../server/lib/news/match-summary.ts'
import { createTimedNewsCache } from '../server/lib/news/timed-cache.ts'
import type { NewsMatchState } from '../shared/types/news-coverage.ts'
import type { SummaryConfig } from '../server/lib/news/summary.ts'

const kickoff = Date.parse('2026-10-24T19:00:00Z')
const scheduled: NewsMatchState = { key: 'premier-league:123', status: 'scheduled', start: new Date(kickoff).toISOString(), home: { name: 'Ipswich Town', score: null }, away: { name: 'Nottingham Forest', score: null } }
const config: SummaryConfig = { provider: 'openai', model: 'gpt-6-luna', apiKey: 'test-placeholder' }
const sources = ['one', 'two', 'three'].map(name => ({ id: name, title: `${name} report`, source: name, link: `https://${name}.example/report`, publishedAt: new Date(kickoff - 3600_000).toISOString() }))
function store() {
  const values = new Map<string, unknown>()
  return { getItem: async <T>(key: string) => (values.get(key) as T | undefined) ?? null, setItem: async (key: string, value: unknown) => { values.set(key, value) } }
}
const input = (match: NewsMatchState, now: number): MatchDigestInput => ({ match, policy: matchNewsPolicy(match, now), sources, revision: 'same-news-revision' })

test('upcoming caching tightens near kickoff and never invents a live or finished status', () => {
  assert.equal(matchNewsPolicy(scheduled, kickoff - 2 * 3600_000).summarySeconds, 300)
  assert.equal(matchNewsPolicy(scheduled, kickoff - 30 * 60_000).summarySeconds, 60)
  assert.equal(matchNewsPolicy(scheduled, kickoff - 15_000).summarySeconds, 15)
  assert.equal(matchNewsPolicy(scheduled, kickoff + 4 * 3600_000).phase, 'upcoming')
  assert.equal(matchNewsPolicy({ ...scheduled, status: 'live' }, kickoff).summarySeconds, 60)
})

test('post-match refreshes reaction frequently before settling into a daily cache', () => {
  const final = { ...scheduled, status: 'finished' as const }
  assert.equal(matchNewsPolicy(final, kickoff + 3 * 3600_000).summarySeconds, 300)
  assert.equal(matchNewsPolicy(final, kickoff + 10 * 3600_000).summarySeconds, 3600)
  assert.equal(matchNewsPolicy(final, kickoff + 25 * 3600_000).summarySeconds, 86400)
})

test('status and score changes have different cache identities, including null versus zero', () => {
  assert.notEqual(matchStateKey(scheduled), matchStateKey({ ...scheduled, status: 'live' }))
  assert.notEqual(matchStateKey(scheduled), matchStateKey({ ...scheduled, home: { ...scheduled.home, score: 0 } }))
})

test('three reports produce one synthesis; unchanged preview sources are checked without another AI call', async () => {
  let now = kickoff - 30 * 60_000, reads = 0, generations = 0, changed = false
  const service = createMatchSummaryService({
    store: store(), now: () => now,
    readArticle: async article => { reads++; return { ...article, description: 'A match report.', text: changed ? 'The source has new coverage.' : 'The same source report.' } },
    generate: async (evidence, settings, context) => {
      generations++
      assert.equal(settings.model, 'gpt-6-luna')
      assert.equal(context.sourcesCount, 3)
      for (const name of ['one', 'two', 'three']) assert.match(evidence.text, new RegExp(`SOURCE.*${name}`, 'i'))
      return `Combined summary ${generations}.`
    },
  })
  const first = await service(input(scheduled, now), config)
  assert.equal(first.phase, 'upcoming')
  assert.equal(Date.parse(first.expiresAt) - now, 60_000)
  assert.equal((await service(input(scheduled, now), config)).cached, true)
  assert.equal(reads, 3)
  now += 60_000
  const rechecked = await service(input(scheduled, now), config)
  assert.equal(reads, 6)
  assert.equal(generations, 1)
  assert.equal(rechecked.generatedAt, first.generatedAt)
  assert.equal(rechecked.cached, true)
  changed = true
  now += 60_000
  assert.notEqual((await service(input(scheduled, now), config)).summary, first.summary)
  assert.equal(generations, 2)
})

test('phase, score and selected-source changes invalidate a still-unexpired summary', async () => {
  let calls = 0
  const now = kickoff - 1000
  const service = createMatchSummaryService({
    store: store(), now: () => now,
    readArticle: async article => ({ ...article, description: 'A report.', text: 'Source text.' }),
    generate: async () => `summary ${++calls}`,
  })
  await service(input(scheduled, now), config)
  await service(input({ ...scheduled, start: new Date(kickoff + 3600_000).toISOString() }, now), config)
  const scored = { ...scheduled, status: 'finished' as const, home: { ...scheduled.home, score: 1 }, away: { ...scheduled.away, score: 0 } }
  await service(input(scored, now), config)
  await service(input({ ...scored, home: { ...scored.home, score: 2 } }, now), config)
  await service({ ...input(scored, now), revision: 'new-source-selected' }, config)
  assert.equal(calls, 5)
})

test('live status rejects synthesis before cached text, publisher reads or AI calls', async () => {
  let reads = 0, generations = 0
  const service = createMatchSummaryService({ store: store(), now: () => kickoff,
    readArticle: async article => { reads++; return { ...article, description: '', text: 'Source text.' } },
    generate: async () => { generations++; return 'Not a live news service.' },
  })
  await assert.rejects(service(input({ ...scheduled, status: 'live' }, kickoff), config), /Live updates are on the match page/)
  await assert.rejects(service({ ...input(scheduled, kickoff), policy: { ...matchNewsPolicy(scheduled, kickoff), phase: 'streaming' } }, config), /Live updates/)
  assert.equal(reads, 0)
  assert.equal(generations, 0)
})

test('the combined AI request receives reports in source-priority order with their attribution', async () => {
  const ranked = sources.map((source, i) => ({ ...source, sourceId: source.id, sourcePriority: [5, 1, 2][i]!, sourceKind: i === 1 ? 'league' as const : i === 2 ? 'club' as const : 'newsroom' as const }))
  const service = createMatchSummaryService({ store: store(), now: () => kickoff,
    readArticle: async article => ({ ...article, description: 'Attributed report.', text: 'The account is reported by this publisher.' }),
    generate: async evidence => {
      assert.match(evidence.text, /SOURCE 1: two\nEditorial rank: 1; type: league/)
      assert.match(evidence.text, /SOURCE 2: three\nEditorial rank: 2; type: club/)
      assert.match(evidence.text, /SOURCE 3: one\nEditorial rank: 5; type: newsroom/)
      return 'One attributed match summary.'
    },
  })
  const result = await service({ ...input(scheduled, kickoff), sources: ranked }, config)
  assert.deepEqual(result.sources.map(s => s.sourceId), ['two', 'three', 'one'])
})

test('concurrent automatic loads share one synthesis and missing/restricted sources are not padded', async () => {
  let calls = 0
  const now = kickoff
  const service = createMatchSummaryService({ store: store(), now: () => now,
    readArticle: async article => ({ ...article, description: '', text: 'The source.' }),
    generate: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 20)); return 'Combined summary.' },
  })
  await Promise.all(Array.from({ length: 5 }, () => service(input(scheduled, now), config)))
  assert.equal(calls, 1)
  await assert.rejects(service({ ...input(scheduled, now), sources: sources.slice(0, 2) }, config), /three verified/)
  await assert.rejects(service(input({ ...scheduled, status: 'cancelled' }, now), config), /cancelled/)
  await assert.rejects(service(input({ ...scheduled, status: 'postponed' }, now), config), /postponed/)
  assert.equal(calls, 1)
})

test('a cache created far from kickoff obeys the shorter near-kickoff policy', async () => {
  let now = kickoff - 2 * 3600_000, calls = 0
  const cache = createTimedNewsCache<number>(store(), 'test', () => now)
  assert.equal(await cache('same-match', 1800, async () => ++calls), 1)
  now += 10 * 60_000
  assert.equal(await cache('same-match', 300, async () => ++calls), 2)
})

test('slow source loading does not extend cache validity past its original deadline', async () => {
  let now = kickoff - 20_000, calls = 0
  const cache = createTimedNewsCache<number>(store(), 'test', () => now)
  const load = async () => { now += 25_000; return ++calls }
  assert.equal(await cache('same-match', 20, load), 1)
  assert.equal(await cache('same-match', 20, load), 2)
})
