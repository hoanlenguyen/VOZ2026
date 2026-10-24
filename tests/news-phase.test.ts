import assert from 'node:assert/strict'
import test from 'node:test'
import { newsCoveragePhase } from '../shared/utils/news-phase.ts'
import { retainedPreMatchGroups } from '../server/lib/news/coverage-phase.ts'
import { articleUrl, lookupMatchNews } from '../server/lib/news/lookup.ts'
import { parseNewsInput } from '../server/lib/news/input.ts'
import { sourceForUrl } from '../server/lib/news/sources.ts'
import type { NewsMatchState } from '../shared/types/news-coverage.ts'

const match: NewsMatchState = { key: 'premier-league:1', status: 'live', start: '2026-10-24T19:00:00Z', home: { name: 'Ipswich Town', score: 0 }, away: { name: 'Nottingham Forest', score: 1 } }

test('news labels follow the provider status and never claim live coverage', () => {
  for (const status of ['scheduled', 'live', 'postponed', 'cancelled'] as const) assert.equal(newsCoveragePhase(status), 'pre-match')
  assert.equal(newsCoveragePhase('finished'), 'post-match')
})

test('retained previews exclude in-play publications and keep gaps explicit', () => {
  const article = { id: 'preview', title: 'A verified preview', link: 'https://www.bbc.com/sport/football/articles/example', source: 'BBC Sport', publishedAt: '2026-10-24T18:00:00Z' }
  const groups = retainedPreMatchGroups(match, [{ key: 'match', title: 'This match', note: null, articles: [article, { ...article, id: 'in-play', publishedAt: '2026-10-24T19:05:00Z' }, { ...article, id: 'invalid', publishedAt: 'invalid' }] }])
  assert.deepEqual(groups[0]!.articles.map(a => a.id), ['preview'])
  assert.match(groups[0]!.note!, /1 of 3 pre-match sources/)
  assert.equal(groups[1]!.articles.length, 0)
  assert.equal(retainedPreMatchGroups(match).length, 3)
})

test('live news lookup makes zero requests, including publisher indexes', async () => {
  let calls = 0
  const input = parseNewsInput({ kickoff: match.start, status: 'live', homeTeam: match.home, awayTeam: match.away, competitionId: 'premier-league' })
  const result = await lookupMatchNews(input, { fetcher: (async () => { calls++; throw new Error('Must not crawl') }) as typeof fetch })
  assert.equal(calls, 0)
  assert.deepEqual(result.articles, [])
  assert.match(result.note!, /after full time/)
})

test('approved publishers still exclude live-blog URLs from article discovery', () => {
  for (const url of ['https://www.bbc.com/sport/football/live/example', 'https://www.skysports.com/football/ipswich-vs-forest/live/123', 'https://www.theguardian.com/football/live/2026/oct/24/ipswich-forest']) {
    const source = sourceForUrl(url)!
    assert.equal(articleUrl(url, url, source), undefined)
  }
  const url = 'https://www.bbc.com/sport/football/articles/example'
  assert.equal(articleUrl(url, url, sourceForUrl(url)!), url)
})
