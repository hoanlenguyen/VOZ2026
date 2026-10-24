import type { NewsSourceAttribution, NewsSourceCheck, NewsSourcePolicy } from './news-source.ts'

/** A small, attributed preview of a verified publisher page. */
export interface MatchNewsArticle extends NewsSourceAttribution {
  title: string
  link: string
  summary: string
  source: string
  publishedAt: string
}

export interface MatchNewsResult {
  matchId: string | null
  status: 'ok' | 'partial' | 'none' | 'unavailable'
  articles: MatchNewsArticle[]
  note: string | null
  checkedAt: string
  sourcePolicy?: NewsSourcePolicy
  sourceChecks?: NewsSourceCheck[]
}
