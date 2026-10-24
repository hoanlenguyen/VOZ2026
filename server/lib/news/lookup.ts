import { load } from 'cheerio/slim'
import type { MatchNewsArticle, MatchNewsResult } from '../../../shared/types/match-news.ts'
import { createNewsCrawler } from './crawler.ts'
import { mentionsTeam, normalize, type NewsMatch } from './input.ts'
import { sourceForUrl, type NewsSource } from './sources.ts'
import { newsSourcePolicy, rankedNewsSources, sourceAttribution } from './source-policy.ts'
import type { NewsSourceCheck } from '../../../shared/types/news-source.ts'

const DAY = 86_400_000
export interface Candidate { url: string, title: string, description: string, publishedAt?: string }
const clean = (value: string) => value.replace(/\s+/g, ' ').trim()
const useful = (value: string) => value && !/^(?:undefined|null)$/i.test(value)

export function articleUrl(value: string, base: string, source: NewsSource): string | undefined {
  try {
    const url = new URL(value, base)
    if (sourceForUrl(url.href, [source]) !== source || !source.articlePath.test(url.pathname)) return
    // Rolling live blogs belong on the live match page, never in the news evidence set.
    if (/(?:^|\/)(?:live|liveblog|live-blog)(?:\/|$)/i.test(url.pathname)) return
    url.hash = ''
    // Publisher news paths identify the article; omit tracking/query duplicates.
    url.search = ''
    return url.href
  }
  catch { return }
}

export function discoverArticles(markup: string, base: string, source: NewsSource): Candidate[] {
  const xml = /^\s*<\?xml|<rss\b|<feed\b/i.test(markup)
  const $ = load(markup, { xmlMode: xml })
  const found = new Map<string, Candidate>()
  const add = (href: string, title = '', description = '', publishedAt?: string) => {
    const url = articleUrl(href, base, source)
    if (url && !found.has(url)) found.set(url, { url, title: clean(title), description: clean(description), publishedAt })
  }
  if (xml) {
    $('item, entry').each((_, item) => {
      const element = $(item)
      add(element.find('link').attr('href') || element.find('link').text(), element.find('title').text(),
        load(element.find('description, summary').first().text()).text(), element.find('pubDate, published').first().text())
    })
    // Official club sitemaps are useful when their news index requires client-side rendering.
    // lastmod is deliberately not used as the publication date.
    $('url').each((_, item) => add($(item).find('loc').first().text()))
  }
  else {
    $('a[href]').each((_, a) => add($(a).attr('href')!, $(a).text()))
    // Some official club indexes carry their article URLs in inert hydration JSON.
    // Decode string escapes only; never execute publisher scripts.
    const decoded = markup.replace(/\\u002[fF]|\\\//g, '/').replace(/&quot;|\\"/g, '"')
    for (const match of decoded.matchAll(/["']((?:https:\/\/[^"'<>\s]+)?\/news\/\d{4}\/[^"'<>\s]+)["']/g)) add(match[1]!)
  }
  return [...found.values()].sort((a, b) => (publicationTime(b.publishedAt || dateFromUrl(b.url) || '') || 0) - (publicationTime(a.publishedAt || dateFromUrl(a.url) || '') || 0)).slice(0, 150)
}

export function dateFromUrl(url: string): string | undefined {
  const match = new URL(url).pathname.match(/\/(\d{4})\/([a-z]+|\d{2})\/(\d{1,2})\//i)
  if (!match) return
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const month = /^\d+$/.test(match[2]!) ? Number(match[2]) : months.indexOf(match[2]!.slice(0, 3).toLowerCase()) + 1
  if (!month || month > 12) return
  return `${match[1]}-${String(month).padStart(2, '0')}-${match[3]!.padStart(2, '0')}T00:00:00Z`
}

// UK feeds sometimes emit BST, which Date.parse does not recognize consistently.
export const publicationTime = (date: string) => Date.parse(date.replace(/\bBST\b/g, '+0100'))

const inWindow = (date: string, match: NewsMatch, now: number) => {
  const time = publicationTime(date)
  const end = match.status === 'scheduled' ? Math.min(now, match.kickoff) : Math.min(now, match.kickoff + 2 * DAY)
  return Number.isFinite(time) && time >= match.kickoff - 3 * DAY && time <= end
}

function newsJson(markup: string): Record<string, unknown>[] {
  const $ = load(markup)
  const records: Record<string, unknown>[] = []
  function visit(value: unknown, depth = 0) {
    if (depth > 8 || !value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.slice(0, 100).forEach(item => visit(item, depth + 1)); return }
    const record = value as Record<string, unknown>
    const type = record['@type']
    if (String(type).match(/Article|BlogPosting|Reportage/)) records.push(record)
    for (const key of ['@graph', 'mainEntity', 'itemListElement']) if (record[key]) visit(record[key], depth + 1)
  }
  $('script[type="application/ld+json"]').each((_, script) => {
    try { visit(JSON.parse($(script).text())) } catch { /* malformed publisher metadata */ }
  })
  return records
}

/** Publisher previews stay short and attributed; no model or invented match recap. */
function preview(text: string): string {
  const sentence = clean(text).split(/(?<=[.!?])\s+|;\s*/).find(part => {
    const count = part.split(/\s+/).length
    return count >= 8 && count <= 24
  })
  if (sentence) return sentence
  const words = clean(text).split(/\s+/)
  return words.length <= 24 ? words.join(' ') : `${words.slice(0, 24).join(' ').replace(/[.,;:]$/, '')}…`
}

export interface ArticleDocument extends MatchNewsArticle {
  /** Server-only evidence. Never return this field to the browser. */
  text: string
  description: string
}

export function readPublisherArticle(markup: string, url: string, candidate: Candidate, source: NewsSource): ArticleDocument | undefined {
  const $ = load(markup)
  const meta = (key: string) => clean($(`meta[property="${key}"], meta[name="${key}"], meta[itemprop="${key}"]`).first().attr('content') ?? '')
  if (/\b(?:noindex|nosnippet|noai)\b|(?:max-snippet\s*:\s*0)/i.test(meta('robots') + ' ' + meta('VOZMatchNews'))) return
  const records = newsJson(markup)
  if (records.some(record => record.isAccessibleForFree === false || record.isAccessibleForFree === 'false')) return
  const record = records[0] ?? {}
  const field = (key: string) => typeof record[key] === 'string' ? clean(record[key]) : ''
  const title = [meta('og:title'), field('headline'), $('h1').first().text(), candidate.title].map(clean).find(useful)
  if (!title || title.length < 8 || title.length > 400) return
  // Ipswich's Nuxt 2 pages place article paragraphs in quoted hydration strings.
  // Parse those string literals as JSON data; never evaluate the surrounding JS.
  const embedded: string[] = []
  if (source.hosts.includes('www.itfc.co.uk')) $('script').each((_, script) => {
    const scriptText = $(script).text()
    if (!scriptText.startsWith('window.__NUXT__=')) return
    for (const literal of scriptText.matchAll(/"(?:[^"\\]|\\.)*"/g)) {
      try {
        const value: unknown = JSON.parse(literal[0])
        if (typeof value === 'string' && /^\s*<p[\s>]/.test(value)) {
          const fragment = load(value)
          fragment('script, style, nav, aside').remove()
          embedded.push(...fragment('p').map((_, p) => clean(fragment(p).text())).get())
        }
      }
      catch { /* Not a JSON string literal. */ }
    }
  })
  $('script, style, nav, aside, footer, header, [class*="related"], [class*="recommend"]').remove()
  const article = $('article, [itemprop="articleBody"], .article-body, .article__body, .news-article').first()
  const paragraphs = [...(article.length ? article : $('main').first()).find('p').map((_, p) => clean($(p).text())).get(), ...embedded]
    .filter(p => p.length >= 50 && !/cookie|subscribe|sign up|copyright/i.test(p))
  const body = paragraphs.slice(0, 40).join('\n').slice(0, 14000)
  const description = [meta('description'), meta('og:description'), field('description'), candidate.description, paragraphs[0] ?? '']
    .find(value => useful(value) && value.length >= 30 && !/official website|latest news, highlights|cookies/i.test(value))
  if (!description) return
  const published = [field('datePublished'), meta('article:published_time'), meta('datePublished'), $('time[datetime]').first().attr('datetime') ?? '', candidate.publishedAt ?? '', dateFromUrl(url) ?? '']
    .find(value => value && Number.isFinite(publicationTime(value)))
  if (!published) return
  const canonical = $('link[rel="canonical"]').attr('href')
  const link = canonical ? articleUrl(canonical, url, source) : articleUrl(url, url, source)
  if (!link) return
  return { title, link, summary: preview(description), source: source.name, publishedAt: new Date(publicationTime(published)).toISOString(), text: body, description }
}

export function extractArticle(markup: string, url: string, candidate: Candidate, source: NewsSource, match: NewsMatch, now: number): MatchNewsArticle | undefined {
  const article = readPublisherArticle(markup, url, candidate, source)
  if (!article || article.text.length < 150) return
  if (!/women|u\d{2}|under.?\d{2}/i.test(`${match.home[0]} ${match.away[0]}`) && /\bwomen|\bu\d{2}\b|under.?\d{2}|academy|youth/i.test(article.title)) return
  const evidence = `${article.title} ${article.description} ${article.text.slice(0, 3000)} ${source.team ?? ''}`
  if (!mentionsTeam(evidence, match.home) || !mentionsTeam(evidence, match.away)) return
  const lead = `${article.title} ${article.description} ${source.team ?? ''}`
  if (!mentionsTeam(lead, match.home) || !mentionsTeam(lead, match.away)) return
  if (!inWindow(article.publishedAt, match, now)) return
  const urlDate = dateFromUrl(url)
  if (urlDate && !inWindow(urlDate, match, now)) return
  const { text: _text, description: _description, ...preview } = article
  return preview
}

export interface LookupOptions {
  fetcher?: typeof fetch
  now?: number
  sources?: NewsSource[]
  competitionId?: string
  /** Optional search API candidates, still verified against the publisher pages. */
  candidates?: { url: string, title: string, description?: string, publishedAt?: string }[]
}

export async function lookupMatchNews(match: NewsMatch, options: LookupOptions = {}): Promise<MatchNewsResult> {
  const now = options.now ?? Date.now()
  const competitionId = match.competitionId ?? options.competitionId
  if (match.status === 'live') return {
    matchId: match.matchId, status: 'none', articles: [], checkedAt: new Date(now).toISOString(),
    sourcePolicy: newsSourcePolicy(competitionId), sourceChecks: [],
    note: 'Live updates are on the match page. News discovery resumes after full time.',
  }
  const rankedSources = rankedNewsSources(competitionId, [...match.home, ...match.away], options.sources)
  const articles: MatchNewsArticle[] = [], sourceChecks: NewsSourceCheck[] = []
  const titles = new Set<string>()
  let indexesRead = 0, failedSources = 0
  for (const priority of new Set(rankedSources.map(s => s.priority))) {
    if (articles.length >= match.limit) break
    // Same-priority club sites share a tier; wait for both before considering a lower tier.
    const results = await Promise.all(rankedSources.filter(s => s.priority === priority).map(async rankedSource => {
      const { source } = rankedSource
      const crawl = createNewsCrawler(options.fetcher, [source], { totalMs: 12_000, requestMs: 5_000 })
      const candidates: Candidate[] = (options.candidates ?? []).filter(c => articleUrl(c.url, c.url, source))
        .map(c => ({ ...c, description: c.description ?? '' }))
      let readable = false
      for (const index of source.indexes) {
        try {
          const page = await crawl(index)
          candidates.push(...discoverArticles(page.text, page.url, source))
          indexesRead++
          readable = true
        }
        catch { /* A failed source must not discard other publishers' results. */ }
      }
      if (!readable) failedSources++
      const ranked = candidates.map(candidate => {
        let path = new URL(candidate.url).pathname
        try { path = decodeURI(path) } catch { /* Malformed publisher escapes cannot abort the lookup. */ }
        const text = `${candidate.title} ${candidate.description} ${path}`
        const score = Number(mentionsTeam(text, match.home)) + Number(mentionsTeam(text, match.away))
        return { candidate, score }
      }).filter(({ candidate, score }) => {
        const date = candidate.publishedAt || dateFromUrl(candidate.url)
        // An unparseable feed date is not evidence: let publisher metadata decide.
        return score > 0 && (!date || !Number.isFinite(publicationTime(date)) || inWindow(date, match, now))
      }).sort((a, b) => {
        // Prefer reports/reaction from match day onward to older previews.
        const rank = (item: typeof a) => {
          const time = publicationTime(item.candidate.publishedAt || dateFromUrl(item.candidate.url) || '')
          const onOrAfterMatchDay = Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) >= match.date
          return item.score + Number(onOrAfterMatchDay) * 2
        }
        return rank(b) - rank(a)
          || (publicationTime(b.candidate.publishedAt || dateFromUrl(b.candidate.url) || '') || 0) - (publicationTime(a.candidate.publishedAt || dateFromUrl(a.candidate.url) || '') || 0)
          || a.candidate.url.localeCompare(b.candidate.url)
      })
      const seen = new Set<string>()
      let tried = 0
      for (const { candidate } of ranked) {
        if (seen.has(candidate.url)) continue
        seen.add(candidate.url)
        if (++tried > 4) break
        try {
          const page = await crawl(candidate.url)
          // Recheck the actual redirect destination, not just the search/feed URL.
          if (!articleUrl(page.url, page.url, source)) continue
          const result = extractArticle(page.text, page.url, candidate, source, match, now)
          if (result) return { article: { ...result, ...sourceAttribution(rankedSource) }, readable, rankedSource }
        }
        catch { /* Unreadable, restricted or redirected articles are not crawlable results. */ }
      }
      return { article: undefined, readable, rankedSource }
    }))
    for (const { article, readable, rankedSource } of results) {
      const selected = !!article && !titles.has(normalize(article.title)) && articles.length < match.limit
      if (selected) { titles.add(normalize(article.title)); articles.push(article) }
      sourceChecks.push({ sourceId: rankedSource.source.id ?? rankedSource.source.name, source: rankedSource.source.name, priority,
        outcome: selected ? 'selected' : readable ? 'no-verified-articles' : 'unavailable', selected: Number(selected) })
    }
  }
  const status = articles.length >= 3 ? 'ok' : articles.length ? 'partial' : indexesRead ? 'none' : 'unavailable'
  return {
    matchId: match.matchId, status, articles, checkedAt: new Date(now).toISOString(),
    sourcePolicy: newsSourcePolicy(competitionId), sourceChecks,
    note: articles.length === match.limit ? null
      : `Verified ${articles.length} of ${match.limit} requested publishers. ${failedSources ? `${failedSources} source indexes were unavailable. ` : ''}Recent feeds/indexes may not contain this match; no unverified articles were added.`,
  }
}
