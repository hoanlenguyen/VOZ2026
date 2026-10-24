import type { NewsSourceAttribution, NewsSourceCheck, NewsSourcePolicy } from './news-source.ts'

export type TeamNewsTopic = 'form' | 'players' | 'injuries'
export type NewsPhase = 'upcoming' | 'streaming' | 'post-match' | 'postponed' | 'cancelled'

export interface NewsMatchState {
  key: string
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'
  start: string
  home: { name: string, score: number | null }
  away: { name: string, score: number | null }
}

export interface NewsCachePolicy {
  phase: NewsPhase
  discoverySeconds: number
  summarySeconds: number
  pollSeconds: number
}

/** Discovery metadata only. AI text is fetched separately after a reader clicks. */
export interface NewsItem extends NewsSourceAttribution {
  id: string
  title: string
  link: string
  source: string
  publishedAt: string
  topic?: TeamNewsTopic
}

export interface NewsGroup {
  key: 'match' | 'home' | 'away'
  title: string
  articles: NewsItem[]
  note: string | null
  sourceChecks?: NewsSourceCheck[]
}

export interface NewsCoverage {
  newsPhase: 'pre-match' | 'post-match'
  groups: NewsGroup[]
  checkedAt: string
  summaryAvailable: boolean
  match: NewsMatchState
  policy: NewsCachePolicy
  revision: string
  sourcePolicy?: NewsSourcePolicy
}

export interface MatchNewsDigest {
  revision: string
  phase: NewsPhase
  summary: string
  sources: NewsItem[]
  generatedAt: string
  checkedAt: string
  expiresAt: string
  cached: boolean
}

export interface NewsSummary {
  articleId: string
  summary: string
  source: { title: string, name: string, link: string, publishedAt: string }
  generatedAt: string
  expiresAt: string
  cached: boolean
}
