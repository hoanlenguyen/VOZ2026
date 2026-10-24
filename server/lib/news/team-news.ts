import type { MatchNewsArticle } from '../../../shared/types/match-news.ts'
import type { TeamNewsTopic } from '../../../shared/types/news-coverage.ts'
import { createNewsCrawler } from './crawler.ts'
import { mentionsTeam, normalize } from './input.ts'
import { articleUrl, dateFromUrl, discoverArticles, publicationTime, readPublisherArticle, type ArticleDocument, type Candidate, type LookupOptions } from './lookup.ts'
import { indexesForTeams, type NewsSource } from './sources.ts'
import { rankedNewsSources, sourceAttribution } from './source-policy.ts'
import type { NewsSourceCheck } from '../../../shared/types/news-source.ts'

const DAY = 86_400_000
export interface TeamNewsQuery { name: string, variants: string[] }
export interface TeamNewsArticle extends MatchNewsArticle { topic: TeamNewsTopic }

/** Teams must be in the actual headline/standfirst, unless this is their official club. */
export function teamNewsTopic(article: ArticleDocument, team: TeamNewsQuery, source: NewsSource): TeamNewsTopic | undefined {
  const lead = `${article.title} ${article.description}`
  const official = source.team && team.variants.includes(normalize(source.team))
  if (source.team && !official) return
  if (!official && !mentionsTeam(lead, team.variants)) return
  // Avoid confusing the senior side with the academy or women's team.
  if (!/women|u\d{2}|under.?\d{2}/i.test(team.name) && /\b(?:women|womens|naiset|naisten|tytot|frauen|vrouwen|feminin|feminine|femenino|femminile|dames)\b|\bu\d{2}\b|under.?\d{2}|academy|youth/i.test(normalize(article.title))) return
  if (/tickets|hospitality|shop|merchandise|sponsors?|competition winners|how to (?:watch|follow)|tv guide|after .{0,40}exit|director|chairman|owner|b.team|junior reds/i.test(article.title)) return
  const text = official ? `${lead} ${article.text.slice(0, 1200)}` : lead
  if (/injur|fitness|fit to|ruled out|sidelined|medical|hamstring|ankle|knee|return to training|team news|loukkaantu|vamma|sairastu|blessur|lesion|infortun|verletz/i.test(text)) return 'injuries'
  if (/player|signing|transfer|contract|squad|captain|manager|coach|boss|striker|midfielder|defender|goalkeeper|line.?ups?|starting (?:xi|eleven)|suspend|banned|kokoonpano|pelikiel|pelaaja|sopimus|valmentaja|joukkue|joueur|contrat|jogador|giocatore|spieler|speler/i.test(text)) return 'players'
  if (/form|wins?|victor|draw|defeat|loss|losing|unbeaten|points?|performance|preview|report|reaction|verdict|goals?|season|fixture|postpon|cancel|reschedul|siirret|peruut|voitto|tappio|tasapeli|ottelu|maali|kausi|but\b|victoire|overwinning|wedstrijd|vitoria|vittoria|partita|spielbericht/i.test(text)) return 'form'
  return undefined
}

/** Both team lists share index/article reads, and discovery never calls an AI provider. */
export async function lookupTeamNews(teams: TeamNewsQuery[], options: LookupOptions = {}) {
  const now = options.now ?? Date.now()
  const rankedSources = rankedNewsSources(options.competitionId, teams.flatMap(team => team.variants), options.sources)
  const recent = (date: string) => {
    const time = publicationTime(date)
    return time >= now - 14 * DAY && time <= now
  }
  let indexesRead = 0
  const pool: { article: ArticleDocument, source: NewsSource, priority: number }[] = []
  const sourceChecks: NewsSourceCheck[] = []

  function select(team: TeamNewsQuery): TeamNewsArticle[] {
    const articles: TeamNewsArticle[] = []
    const seen = new Set<string>()
    // Rank is a hard boundary. Freshness/topic variety only break ties within a tier.
    for (const priority of new Set(pool.map(item => item.priority))) {
      const candidates = pool.filter(item => item.priority === priority).flatMap(({ article, source }) => {
        const topic = teamNewsTopic(article, team, source)
        return topic ? [{ article, topic }] : []
      }).sort((a, b) => Date.parse(b.article.publishedAt) - Date.parse(a.article.publishedAt) || a.article.link.localeCompare(b.article.link))
      for (const diversify of [true, false]) {
        for (const { article, topic } of candidates) {
          const title = normalize(article.title)
          if (seen.has(title) || articles.some(a => a.link === article.link)) continue
          if (diversify && articles.some(a => a.sourcePriority === priority && (a.topic === topic || a.source === article.source))) continue
          const { text: _text, description: _description, ...preview } = article
          articles.push({ ...preview, topic }); seen.add(title)
          if (articles.length === 3) return articles
        }
      }
    }
    return articles
  }

  for (const priority of new Set(rankedSources.map(s => s.priority))) {
    if (teams.every(team => select(team).length === 3)) break
    const remainingTeams = teams.filter(team => select(team).length < 3)
    const results = await Promise.all(rankedSources.filter(s => s.priority === priority
      && (!s.source.team || remainingTeams.some(t => t.variants.includes(normalize(s.source.team!))))).map(async rankedSource => {
      const { source } = rankedSource
      const crawl = createNewsCrawler(options.fetcher, [source], { totalMs: 12_000, requestMs: 5_000 })
      const pages = new Map<string, ReturnType<typeof crawl>>()
      const read = (url: string) => {
        if (!pages.has(url)) pages.set(url, crawl(url))
        return pages.get(url)!
      }
      let readable = false
      const candidates: Candidate[] = (options.candidates ?? []).filter(c => articleUrl(c.url, c.url, source))
        .map(c => ({ ...c, description: c.description ?? '' }))
      for (const index of indexesForTeams(source, remainingTeams.flatMap(team => team.variants))) {
        try {
          const page = await read(index)
          candidates.push(...discoverArticles(page.text, page.url, source))
          indexesRead++
          readable = true
        }
        catch { /* Continue with the other publishers. */ }
      }
      const ranked = [...new Map(candidates.map(c => [c.url, c])).values()].filter(c => {
        const date = c.publishedAt || dateFromUrl(c.url)
        if (date && Number.isFinite(publicationTime(date)) && !recent(date)) return false
        let path = new URL(c.url).pathname
        try { path = decodeURI(path) } catch { /* Keep the undecoded path. */ }
        return !!source.team || remainingTeams.some(team => mentionsTeam(`${c.title} ${c.description} ${path}`, team.variants))
      }).sort((a, b) => publicationTime(b.publishedAt || dateFromUrl(b.url) || '') - publicationTime(a.publishedAt || dateFromUrl(a.url) || ''))
      const found: { article: ArticleDocument, source: NewsSource, priority: number }[] = []
      for (const candidate of ranked.slice(0, source.team ? 8 : 6)) {
        try {
          const page = await read(candidate.url)
          if (!articleUrl(page.url, page.url, source)) continue
          const article = readPublisherArticle(page.text, page.url, candidate, source)
          if (!article || article.text.length < 150 || !recent(article.publishedAt)) continue
          if (remainingTeams.some(team => teamNewsTopic(article, team, source))) found.push({ article: { ...article, ...sourceAttribution(rankedSource) }, source, priority })
          if (source.team && found.length >= 3) break
        }
        catch { /* Do not include unverifiable pages. */ }
      }
      return { found, readable, source }
    }))
    for (const { found, readable, source } of results) {
      pool.push(...found)
      const selected = teams.flatMap(select).filter(a => a.sourceId === (source.id ?? source.name)).length
      sourceChecks.push({ sourceId: source.id ?? source.name, source: source.name, priority, selected,
        outcome: selected ? 'selected' : readable ? 'no-verified-articles' : 'unavailable' })
    }
  }

  return teams.map(team => {
    const articles = select(team)
    return {
      name: team.name, articles, sourceChecks: sourceChecks.map(check => ({ ...check, selected: articles.filter(a => a.sourceId === check.sourceId).length,
        outcome: articles.some(a => a.sourceId === check.sourceId) ? 'selected' as const : check.outcome === 'unavailable' ? 'unavailable' as const : 'no-verified-articles' as const })),
      note: articles.length === 3 ? null : indexesRead
        ? `Found ${articles.length} of 3 recent, verified team updates. More coverage may become available.`
        : 'Team news sources are unavailable right now.',
    }
  })
}
