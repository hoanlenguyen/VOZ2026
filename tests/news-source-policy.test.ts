import assert from 'node:assert/strict'
import test from 'node:test'
import { COMPETITIONS } from '../shared/utils/competitions.ts'
import { NEWS_SOURCES, type NewsSource } from '../server/lib/news/sources.ts'
import { LEAGUE_SOURCE_PRIORITIES, newsSourcePolicy, rankedNewsSources, SOURCE_POLICY_VERSION } from '../server/lib/news/source-policy.ts'
import { parseNewsInput } from '../server/lib/news/input.ts'
import { lookupMatchNews } from '../server/lib/news/lookup.ts'
import { lookupTeamNews } from '../server/lib/news/team-news.ts'

const now = Date.parse('2026-10-24T12:00:00Z')
const input = { competition: 'Premier League', kickoff: '2026-10-23T19:00:00Z', homeTeam: { name: 'Ipswich Town' }, awayTeam: { name: 'Nottingham Forest' }, limit: 3 }
const match = parseNewsInput(input)
const team = { name: 'Ipswich Town', variants: ['ipswich town', 'ipswich'] }
const source = (id: string, team?: string): NewsSource => ({ id, name: id, kind: team ? 'club' : ['premier-league', 'efl'].includes(id) ? 'league' : 'newsroom', team,
  hosts: [`${id}.example`], indexes: [`https://${id}.example/feed`], articlePath: /^\/news\// })
const sources = [source('guardian'), source('bbc-sport'), source('ipswich-town', 'Ipswich Town'),
  source('nottingham-forest', 'Nottingham Forest'), source('premier-league'), source('sky-sports'), source('efl')]
const response = (body: string, type = 'text/html') => new Response(body, { headers: { 'content-type': type } })

/** Different host speeds, dates and failure modes make priority assertions meaningful. */
function fixture(articles: Record<string, { slug: string, title: string, date?: string, robots?: string }[]>, unavailable: string[] = []) {
  const reads: string[] = []
  const fetcher = (async (value: string | URL | Request) => {
    const url = new URL(String(value)), id = url.hostname.split('.')[0]!
    reads.push(`${id}${url.pathname}`)
    if (url.pathname === '/robots.txt') return response('User-agent: *\nAllow: /', 'text/plain')
    if (unavailable.includes(id)) throw new Error('Offline')
    if (url.pathname === '/feed') {
      if (id === 'premier-league') await new Promise(resolve => setTimeout(resolve, 25))
      return response(`<rss><channel>${(articles[id] ?? []).map(a => `<item><title>${a.title}</title><link>https://${id}.example/news/${a.slug}</link></item>`).join('')}</channel></rss>`, 'application/rss+xml')
    }
    const a = (articles[id] ?? []).find(a => url.pathname === `/news/${a.slug}`)!
    return response(`<meta property="og:title" content="${a.title}"><meta name="description" content="${a.title}: the club confirmed its latest first-team update ahead of the next league fixture.">
      <meta property="article:published_time" content="${a.date ?? '2026-10-23T22:00:00Z'}">${a.robots ? `<meta name="robots" content="${a.robots}">` : ''}
      <article><p>${a.title}: the club confirmed its latest first-team update ahead of the next league fixture. Read the official report for the full details of this announcement.</p></article>`)
  }) as typeof fetch
  return { fetcher, reads }
}

test('every supported competition has a reviewed official-first source policy with no unknown or duplicate publishers', () => {
  const ids = NEWS_SOURCES.map(s => s.id)
  assert.ok(NEWS_SOURCES.every(s => s.id && s.kind))
  assert.equal(new Set(ids).size, ids.length)
  for (const c of COMPETITIONS) {
    const order = LEAGUE_SOURCE_PRIORITIES[c.id]!
    assert.ok(order, c.id)
    assert.equal(NEWS_SOURCES.find(s => s.id === order[0])?.kind, 'league')
    assert.equal(order[1], 'official-clubs')
    assert.equal(new Set(order).size, order.length)
    for (const id of order) assert.ok(id === 'official-clubs' || ids.includes(id), `${c.id}: ${id}`)
    assert.equal(newsSourcePolicy(c.id).version, SOURCE_POLICY_VERSION)
  }
  assert.deepEqual(newsSourcePolicy('premier-league').priorities.flatMap(t => t.sources), ['premier-league', 'official-clubs', 'bbc-sport', 'sky-sports', 'guardian'])
  assert.throws(() => newsSourcePolicy('made-up-league'))
})

test('league names, IDs, provider codes and aliases resolve without guessing an unsupported competition', () => {
  for (const name of ['Premier League', 'premier-league', 'PL', 'EPL']) assert.equal(parseNewsInput({ ...input, competition: name }).competitionId, 'premier-league')
  assert.equal(parseNewsInput({ ...input, competition: 'UEFA Champions League' }).competitionId, 'champions-league')
  assert.equal(parseNewsInput({ ...input, competition: 'La Liga' }).competitionId, 'la-liga')
  assert.equal(parseNewsInput({ matchInfo: input }).competitionId, 'premier-league')
  assert.equal(parseNewsInput({ ...input, competition: undefined }).competitionId, undefined)
  assert.throws(() => parseNewsInput({ ...input, competition: 'Unreviewed League' }), /Unsupported competition/)
  assert.throws(() => parseNewsInput({ ...input, competition: 'constructor' }), /Unsupported competition/)
  assert.throws(() => parseNewsInput({ ...input, competition: { name: 'Premier League' } }), /Unsupported competition/)
})

test('policies isolate league authorities and club sites; Finnish hockey never falls back to English football feeds', () => {
  const football = rankedNewsSources('premier-league', team.variants)
  assert.equal(football[0]?.source.id, 'premier-league')
  assert.ok(football.some(s => s.source.id === 'ipswich-town'))
  assert.ok(!football.some(s => ['efl', 'nottingham-forest', 'liiga', 'yle'].includes(s.source.id!)))
  const hockey = rankedNewsSources('liiga', ['tappara', 'ilves'])
  assert.deepEqual(hockey.map(s => s.source.id), ['liiga', 'yle', 'mtv'])
  assert.deepEqual(rankedNewsSources(undefined, []).map(s => s.source.id), ['bbc-sport', 'sky-sports', 'guardian'])
  const finnishClub = source('karpat', 'Kärpät')
  assert.equal(rankedNewsSources('liiga', ['karpat'], [finnishClub])[0]?.source.id, 'karpat')
})

test('match discovery checks official league then clubs and stops without requesting any lower-ranked newsroom', async () => {
  const article = (slug: string) => ({ slug, title: `Ipswich Town draw with Nottingham Forest: ${slug}` })
  const f = fixture({ 'premier-league': [article('league-report')], 'ipswich-town': [article('home-report')], 'nottingham-forest': [article('away-report')], 'bbc-sport': [article('bbc-report')] })
  const result = await lookupMatchNews(match, { ...f, sources, now })
  assert.deepEqual(result.articles.map(a => a.sourceId), ['premier-league', 'ipswich-town', 'nottingham-forest'])
  assert.deepEqual(result.articles.map(a => a.sourcePriority), [1, 2, 2])
  assert.equal(result.sourcePolicy?.competitionId, 'premier-league')
  assert.ok(!f.reads.some(r => /bbc|sky|guardian|efl/.test(r)))
  assert.ok(f.reads.indexOf('premier-league/news/league-report') < f.reads.indexOf('ipswich-town/feed'))
  assert.deepEqual(result.sourceChecks?.map(c => c.outcome), ['selected', 'selected', 'selected'])
})

test('fallback skips stale, restricted and unavailable articles, audits gaps, and ignores an unapproved search domain', async () => {
  const headline = 'Ipswich Town draw with Nottingham Forest'
  const f = fixture({ 'premier-league': [{ slug: 'stale', title: headline, date: '2025-10-23T22:00:00Z' }],
    'ipswich-town': [{ slug: 'restricted', title: headline, robots: 'nosnippet' }],
    'bbc-sport': [{ slug: 'bbc', title: `${headline}: BBC` }], 'sky-sports': [{ slug: 'sky', title: `${headline}: Sky` }], 'guardian': [{ slug: 'guardian', title: `${headline}: Guardian` }] }, ['nottingham-forest'])
  const result = await lookupMatchNews(match, { ...f, sources, now, candidates: [{ url: 'https://fake.example/news/made-up', title: headline }] })
  assert.deepEqual(result.articles.map(a => a.sourceId), ['bbc-sport', 'sky-sports', 'guardian'])
  assert.deepEqual(result.sourceChecks?.map(c => c.outcome), ['no-verified-articles', 'no-verified-articles', 'unavailable', 'selected', 'selected', 'selected'])
  assert.ok(f.reads.indexOf('bbc-sport/news/bbc') < f.reads.indexOf('sky-sports/feed'))
  assert.ok(!f.reads.some(r => /fake|efl/.test(r)))
})

test('team selection fills three older official articles before considering fresher newsroom coverage', async () => {
  const f = fixture({ 'ipswich-town': ['form report', 'player contract', 'injury update'].map((title, i) => ({ slug: String(i), title: `Ipswich Town ${title}`, date: '2026-10-20T12:00:00Z' })),
    'bbc-sport': [{ slug: 'new', title: 'Ipswich Town unbeaten form', date: '2026-10-24T10:00:00Z' }] })
  const result = await lookupTeamNews([team], { ...f, competitionId: 'premier-league', sources, now })
  assert.equal(result[0]?.articles.length, 3)
  assert.ok(result[0]?.articles.every(a => a.sourceId === 'ipswich-town' && a.sourcePriority === 2))
  assert.ok(!f.reads.some(r => /bbc|sky|guardian|nottingham|efl/.test(r)))
})

test('a partial team tier keeps its verified articles and fills only remaining places in priority order', async () => {
  const f = fixture({ 'ipswich-town': [{ slug: 'club', title: 'Ipswich Town player contract', date: '2026-10-20T12:00:00Z' }],
    'bbc-sport': [{ slug: 'bbc', title: 'Ipswich Town injury update' }], 'sky-sports': [{ slug: 'sky', title: 'Ipswich Town unbeaten form' }],
    'guardian': [{ slug: 'guardian', title: 'Ipswich Town latest form' }] })
  const result = await lookupTeamNews([team], { ...f, competitionId: 'premier-league', sources, now })
  assert.deepEqual(result[0]?.articles.map(a => a.sourceId), ['ipswich-town', 'bbc-sport', 'sky-sports'])
  assert.ok(!f.reads.some(r => /guardian/.test(r)))
})
