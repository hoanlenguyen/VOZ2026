import assert from 'node:assert/strict'
import test from 'node:test'
import { parseNewsInput, mentionsTeam } from '../server/lib/news/input.ts'
import { createNewsCrawler } from '../server/lib/news/crawler.ts'
import { discoverArticles, extractArticle, lookupMatchNews } from '../server/lib/news/lookup.ts'
import { sourceForUrl, type NewsSource } from '../server/lib/news/sources.ts'

const input = {
  matchId: '2645271', kickoff: '2026-10-23 20:00:00', kickoffTimezone: 'Europe/London',
  homeTeam: { name: 'Ipswich Town', shortName: 'Ipswich' },
  awayTeam: { name: 'Nottingham Forest', shortName: "Nott'm Forest" },
}
const match = parseNewsInput(input)
const now = Date.parse('2026-10-24T12:00:00Z')
const source: NewsSource = {
  name: 'Test publisher', hosts: ['news.example'], indexes: ['https://news.example/feed'], articlePath: /^\/news\//,
}
const candidate = { url: 'https://news.example/news/report', title: '', description: '' }
const article = (title = 'Ipswich Town draw with Nottingham Forest', date = '2026-10-23T22:00:00Z') => `
  <html><head><meta property="og:title" content="${title}">
  <meta name="description" content="Ipswich Town and Nottingham Forest shared the points after an entertaining league match.">
  <meta property="article:published_time" content="${date}"></head>
  <body><article><h1>${title}</h1><p>Ipswich Town and Nottingham Forest shared the points in a closely contested match. The publisher described the teams' performances and the opportunities created in this league meeting.</p></article></body></html>`
const response = (body: string, type = 'text/html', status = 200) => new Response(body, { status, headers: { 'content-type': type } })

test('accepts complete file and local timezone; BST is converted to UTC', () => {
  assert.equal(new Date(match.kickoff).toISOString(), '2026-10-23T19:00:00.000Z')
  assert.deepEqual(parseNewsInput({ matchInfo: input }), match)
  assert.equal(parseNewsInput({ ...input, kickoff: '2026-10-23T19:00:00.000Z' }).kickoff, match.kickoff)
  assert.equal(parseNewsInput({ ...input, status: 'Upcoming' }).status, 'scheduled')
  assert.equal(parseNewsInput({ ...input, status: 'Streaming' }).status, 'live')
  assert.equal(parseNewsInput({ ...input, status: 'Post-match' }).status, 'finished')
  assert.equal(parseNewsInput({ ...input, kickoff: '2026-10-23T20:00:00+01:00' }).kickoff, match.kickoff)
  assert.equal(parseNewsInput({ ...input, kickoff: '2026-12-23 20:00:00' }).kickoff, Date.parse('2026-12-23T20:00:00Z'))
})

test('rejects invalid payloads, dates, zones and ambiguous daylight-saving times', () => {
  for (const value of [null, [], {}, { ...input, limit: 10 }, { ...input, kickoff: '2026-02-30 20:00:00' },
    { ...input, kickoffTimezone: 'Invalid/Zone' }, { ...input, kickoffTimezone: undefined },
    { ...input, kickoff: '2026-10-25 01:30:00' }, { ...input, awayTeam: input.homeTeam }]) {
    assert.throws(() => parseNewsInput(value))
  }
})

test('team matching has word boundaries and explicit aliases', () => {
  assert.equal(mentionsTeam('Ipswichshire play Forest', match.home), false)
  assert.equal(mentionsTeam('Ipswich v Nottm Forest', match.away), true)
  assert.equal(mentionsTeam('Nottingham County play Manchester City', match.away), false)
  assert.equal(mentionsTeam('AZ Alkmaar announce squad news', parseNewsInput({ ...input, homeTeam: { name: 'AZ' } }).home), true)
})

test('trusted URLs reject spoofed domains, credentials, ports and non-HTTPS', () => {
  for (const url of ['http://www.bbc.com/sport', 'https://www.bbc.com.evil.test/sport', 'https://www.bbc.com@127.0.0.1/', 'https://www.bbc.com:8443/', 'file:///tmp/test']) {
    assert.equal(sourceForUrl(url), undefined)
  }
  assert.equal(sourceForUrl('https://www.bbc.co.uk/sport/football/articles/123')?.name, 'BBC Sport')
})

test('RSS discovery decodes entities, strips markup and deduplicates tracked URLs', () => {
  const rss = `<rss><channel><item><title><![CDATA[Ipswich & Forest]]></title><link>https://news.example/news/report?utm_source=test</link><description><![CDATA[<b>A draw</b>]]></description><pubDate>Fri, 23 Oct 2026 22:00:00 GMT</pubDate></item><item><link>https://news.example/news/report</link></item><item><link>https://evil.test/news/report</link></item></channel></rss>`
  const found = discoverArticles(rss, source.indexes[0]!, source)
  assert.equal(found.length, 1)
  assert.equal(found[0]?.description, 'A draw')
  assert.equal(found[0]?.url, candidate.url)
})

test('extracts the requested fields from a readable matching article', () => {
  const result = extractArticle(article(), candidate.url, candidate, source, match, now)
  assert.equal(result?.link, candidate.url)
  assert.equal(result?.source, source.name)
  assert.ok(result?.summary)
  assert.ok(result.summary.split(/\s+/).length <= 24)
})

test('uses BST feed dates when article metadata has no publication time', () => {
  const html = article().replace(/<meta property="article:published_time"[^>]+>/, '')
  const result = extractArticle(html, candidate.url, { ...candidate, publishedAt: 'Fri, 23 Oct 2026 22:52:00 BST' }, source, match, now)
  assert.equal(result?.publishedAt, '2026-10-23T21:52:00.000Z')
})

test('reads official club hydration text as data without executing scripts', () => {
  const club = { ...source, name: 'Ipswich Town FC', team: 'Ipswich Town', hosts: ['www.itfc.co.uk'] }
  const url = 'https://www.itfc.co.uk/news/2026/october/23/town-1-nottingham-forest-1/'
  const text = '<p>The Blues shared the points with Nottingham Forest after a closely contested match at Portman Road on Friday evening. The official club report reviewed the teams’ performance and opportunities.</p>'
  const html = `<h1>TOWN 1 NOTTINGHAM FOREST 1</h1><script>window.__NUXT__=function(){throw new Error("Never execute this");return {body:${JSON.stringify(text)}}}()</script>`
  const result = extractArticle(html, url, { ...candidate, url }, club, match, now)
  assert.equal(result?.source, club.name)
  assert.match(result?.summary ?? '', /shared the points/)
})

test('rejects old meetings, future publication, unrelated articles and restricted previews', () => {
  const cases = [
    article(undefined, '2025-03-15T22:00:00Z'), article(undefined, '2026-10-25T22:00:00Z'),
    article().replaceAll('Nottingham Forest', 'Manchester City'),
    article('Ipswich Women target promotion'),
    article().replace('</head>', '<meta name="robots" content="nosnippet"></head>'),
    article().replace('</head>', '<script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script></head>'),
    article().replace('</head>', '<link rel="canonical" href="https://evil.test/news/report"></head>'),
    article().replace(/<p>.*?<\/p>/, '<p>A thin preview with insufficient source text.</p>'),
  ]
  for (const html of cases) assert.equal(extractArticle(html, candidate.url, candidate, source, match, now), undefined)
  assert.equal(extractArticle(article(), 'https://news.example/news/2025/march/15/old-report/', candidate, source, match, now), undefined)
})

test('never fetches a disallowed article or untrusted redirect', async () => {
  const seen: string[] = []
  const fetcher = (async (url: string | URL | Request) => {
    const value = String(url); seen.push(value)
    if (value.endsWith('/robots.txt')) return response('User-agent: *\nDisallow: /news/private', 'text/plain')
    return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/private' } })
  }) as typeof fetch
  const crawl = createNewsCrawler(fetcher, [source])
  await assert.rejects(crawl('https://news.example/news/private'), /disallowed/)
  await assert.rejects(crawl(candidate.url), /Untrusted/)
  assert.deepEqual(seen, ['https://news.example/robots.txt', candidate.url])
})

test('fails closed when crawl permissions cannot be retrieved', async () => {
  const crawl = createNewsCrawler((async () => response('Unavailable', 'text/plain', 503)) as typeof fetch, [source])
  await assert.rejects(crawl(candidate.url), /permissions/)
})

test('returns up to four distinct verified publishers, with a three-result option', async () => {
  const sources = ['one', 'two', 'three', 'four'].map(name => ({ ...source, name, hosts: [`${name}.example`], indexes: [`https://${name}.example/feed`] }))
  const fetcher = (async (url: string | URL | Request) => {
    const value = new URL(String(url))
    if (value.pathname === '/robots.txt') return response('User-agent: *\nAllow: /', 'text/plain')
    if (value.pathname === '/feed') return response(`<rss><channel><item><title>Ipswich v Nottingham Forest</title><link>https://${value.host}/news/report</link></item><item><title>Ipswich v Nottingham Forest</title><link>https://${value.host}/news/other</link></item></channel></rss>`, 'application/rss+xml')
    return response(article(`Ipswich draw with Nottingham Forest: ${value.host} report`))
  }) as typeof fetch
  const four = await lookupMatchNews(match, { fetcher, sources, now })
  assert.equal(four.status, 'ok')
  assert.equal(four.articles.length, 4)
  assert.equal(new Set(four.articles.map(a => a.source)).size, 4)
  const three = await lookupMatchNews({ ...match, limit: 3 }, { fetcher, sources, now })
  assert.equal(three.articles.length, 3)
})

test('does not pad missing coverage or fabricate summaries', async () => {
  const empty = (async (url: string | URL | Request) => String(url).endsWith('robots.txt')
    ? response('User-agent: *\nAllow: /', 'text/plain') : response('<rss><channel/></rss>', 'application/rss+xml')) as typeof fetch
  const result = await lookupMatchNews(match, { fetcher: empty, sources: [source], now })
  assert.equal(result.status, 'none')
  assert.deepEqual(result.articles, [])
  const unavailable = await lookupMatchNews(match, { fetcher: (async () => { throw new Error('Offline') }) as typeof fetch, sources: [source], now })
  assert.equal(unavailable.status, 'unavailable')
})
