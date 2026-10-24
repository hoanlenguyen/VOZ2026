import assert from 'node:assert/strict'
import test from 'node:test'
import { lookupTeamNews, teamNewsTopic } from '../server/lib/news/team-news.ts'
import type { ArticleDocument } from '../server/lib/news/lookup.ts'
import type { NewsSource } from '../server/lib/news/sources.ts'

const team = { name: 'Ipswich Town', variants: ['ipswich town', 'ipswich'] }
const source: NewsSource = { name: 'Example Sport', hosts: ['sport.example'], indexes: ['https://sport.example/feed'], articlePath: /^\/news\// }
const document: ArticleDocument = { title: 'Ipswich team news: player returns from injury', description: 'Ipswich Town welcome a player back to training ahead of their next fixture.', text: 'The player returned to training.', link: 'https://sport.example/news/update', source: source.name, publishedAt: '2026-10-23T12:00:00Z', summary: 'A player returns.' }

test('classifies injuries, player news and form while rejecting unrelated or non-senior news', () => {
  assert.equal(teamNewsTopic(document, team, source), 'injuries')
  assert.equal(teamNewsTopic({ ...document, title: 'Ipswich player signs a new contract', description: '', text: '' }, team, source), 'players')
  assert.equal(teamNewsTopic({ ...document, title: 'Ipswich extend unbeaten run', description: '', text: '' }, team, source), 'form')
  assert.equal(teamNewsTopic({ ...document, title: 'Ipswich confirmed starting XI', description: '', text: '' }, team, source), 'players')
  assert.equal(teamNewsTopic({ ...document, title: 'Ipswich fixture postponed', description: '', text: '' }, team, source), 'form')
  for (const title of ['Ipswich Women win again', 'Ipswich naisten loukkaantumisuutiset', 'Ipswich U21 squad news', 'Ipswich tickets now on sale', 'Nottingham Forest win again']) {
    assert.equal(teamNewsTopic({ ...document, title, description: '', text: '' }, team, source), undefined)
  }
  assert.equal(teamNewsTopic(document, { name: 'Nottingham Forest', variants: ['nottingham forest'] }, { ...source, team: 'Ipswich Town' }), undefined)
})

test('finds three fresh articles per team, excludes stale coverage and never calls an AI endpoint', async () => {
  const teams = [team, { name: 'Nottingham Forest', variants: ['nottingham forest'] }]
  const articles = teams.flatMap((t, i) => ['injury update', 'player contract', 'unbeaten form'].map((topic, j) => ({ slug: `${i}-${j}`, title: `${t.name} ${topic}`, date: '2026-10-23T12:00:00Z' })))
  articles.push({ slug: 'old', title: 'Ipswich injury update', date: '2026-09-01T12:00:00Z' })
  let reads = 0
  const fetcher = (async (value: string | URL | Request) => {
    const url = new URL(String(value))
    assert.equal(url.hostname, 'sport.example')
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /', { headers: { 'content-type': 'text/plain' } })
    if (url.pathname === '/feed') { reads++; return new Response(`<rss><channel>${articles.map(a => `<item><title>${a.title}</title><link>https://sport.example/news/${a.slug}</link><pubDate>${a.date}</pubDate></item>`).join('')}</channel></rss>`, { headers: { 'content-type': 'application/rss+xml' } }) }
    const a = articles.find(a => url.pathname.endsWith(a.slug))!
    return new Response(`<meta property="og:title" content="${a.title}"><meta name="description" content="${a.title} is the subject of the latest report from this football club."><meta property="article:published_time" content="${a.date}"><article><p>${a.title} is covered in the club's latest news before their next league fixture. The report provides an update on first-team preparations and the players involved in the forthcoming match.</p></article>`, { headers: { 'content-type': 'text/html' } })
  }) as typeof fetch
  const results = await lookupTeamNews(teams, { fetcher, sources: [source], now: Date.parse('2026-10-24T12:00:00Z') })
  assert.equal(reads, 1)
  assert.deepEqual(results.map(t => t.articles.length), [3, 3])
  assert.ok(results.every(t => t.articles.every(a => !a.link.endsWith('old'))))
  assert.ok(results.every(t => t.articles.every(a => !('text' in a) && !('description' in a))))
})
