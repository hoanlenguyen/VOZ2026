import type { Match } from '../../../shared/types/sports.ts'
import type { MatchNewsArticle } from '../../../shared/types/match-news.ts'
import { articleUrl, type ArticleDocument } from './lookup.ts'
import { normalize, parseNewsInput } from './input.ts'
import { rankedNewsSources, sourceAttribution } from './source-policy.ts'
import { teamNewsTopic } from './team-news.ts'
import type { NewsSource } from './sources.ts'
import type { NewsSourceAttribution } from '../../../shared/types/news-source.ts'

export type NewsAssessment = NonNullable<NewsSourceAttribution['assessment']>
export interface CollectedNews { document: ArticleDocument, sourceId: string, contentHash: string, verifiedAt: number, assessment?: NewsAssessment }

export function preMatchScanSeconds(kickoff: number, now = Date.now()): number {
  const hours = (kickoff - now) / 3600_000
  return hours > 48 ? 3600 : hours > 6 ? 900 : hours > 1 ? 300 : 60
}

export function basicNewsAssessment(article: ArticleDocument): NewsAssessment {
  const text = normalize(`${article.title} ${article.description}`)
  const topic = /postpon|cancel|siirret|peruut/.test(text) ? 'postponement'
    : /injur|ruled out|fitness|loukkaantu|vamma/.test(text) ? 'injuries'
      : /line.?up|starting xi|kokoonpano/.test(text) ? 'lineups'
        : /suspend|ban\b|pelikiel/.test(text) ? 'suspensions'
          : /player|contract|transfer|sign|pelaaja|sopimus/.test(text) ? 'players' : 'form'
  const certainty = /rumour|rumor|could|may |reportedly|interest|huhu/.test(text) ? 'rumour' : 'reported'
  return { topic, importance: certainty === 'rumour' ? 1 : ['injuries', 'lineups', 'suspensions', 'postponement'].includes(topic) ? 3 : 1, certainty, evidence: '' }
}

export function articleImportance(article: MatchNewsArticle, assessment: NewsAssessment, now: number): number {
  const age = Math.max(0, now - Date.parse(article.publishedAt)) / 3600_000
  const impact = assessment.certainty === 'rumour' ? Math.min(1, assessment.importance) : assessment.importance
  // Authority is preserved as a preference, while a fresh material update can beat an old preview.
  return 24 / Math.max(1, article.sourcePriority ?? 5) + 40 * Math.exp(-age / 18) + impact * 25 * Math.exp(-age / 12)
}

export function selectPreMatchNews(match: Match, collected: CollectedNews[], now = Date.now(), sources?: NewsSource[]) {
  const info = parseNewsInput({ competitionId: match.competitionId, kickoff: match.start, homeTeam: match.home, awayTeam: match.away })
  const teams = [{ name: match.home.name, variants: info.home }, { name: match.away.name, variants: info.away }]
  const allowed = rankedNewsSources(match.competitionId, [...info.home, ...info.away], sources)
  const pool = collected.flatMap(item => {
    const ranked = allowed.find(r => (r.source.id ?? r.source.name) === item.sourceId)
    const published = Date.parse(item.document.publishedAt)
    if (!ranked || !articleUrl(item.document.link, item.document.link, ranked.source) || !Number.isFinite(published) || published > Math.min(now, Date.parse(match.start)) || published < now - 14 * 86400_000 || item.verifiedAt < now - 24 * 3600_000 || item.document.text.length < 150) return []
    const topics = teams.map(team => teamNewsTopic(item.document, team, ranked.source))
    if (!topics.some(Boolean)) return []
    const { text: _text, description: _description, ...preview } = item.document
    const assessment = item.assessment ?? basicNewsAssessment(item.document)
    const article = { ...preview, ...sourceAttribution(ranked), contentHash: item.contentHash, assessment }
    return [{ article, topics, score: articleImportance(article, assessment, now) }]
  }).sort((a, b) => b.score - a.score || a.article.link.localeCompare(b.article.link))
  const select = (items: typeof pool, distinctPublishers: boolean) => {
    const seen = new Set<string>(), titles = new Set<string>()
    return items.filter(({ article }) => {
      const publisher = article.sourceId ?? article.source
      if (distinctPublishers && seen.has(publisher) || titles.has(normalize(article.title))) return false
      seen.add(publisher); titles.add(normalize(article.title)); return true
    }).slice(0, 3)
  }
  const teamResults = teams.map((team, i) => ({ name: team.name, articles: select(pool.filter(p => !!p.topics[i]), false).map(p => ({ ...p.article, topic: p.topics[i]! })) }))
  // A preview can include a team's injury/lineup update, even if the opponent is not in its headline.
  const matchSelection = select(pool, true)
  for (const side of [0, 1]) {
    if (matchSelection.some(p => p.topics[side])) continue
    const otherSide = pool.find(p => p.topics[side] && !matchSelection.slice(0, 2).some(s => s.article.sourceId === p.article.sourceId))
    if (otherSide && matchSelection.length >= 2) matchSelection.splice(2, 1, otherSide)
  }
  const matchArticles = matchSelection.map(p => p.article)
  return { articles: matchArticles, teams: teamResults }
}
