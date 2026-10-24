import type { Match, SportId, StandingRow } from './sports.ts'

/** A news item on the landing page. Every sentence is built from data fields, never free text. */
export interface Story {
  id: string
  kind: 'result' | 'preview'
  sport: SportId
  competitionId: string
  competitionName: string
  headline: string
  summary: string
  /** ISO time the story is about (kick-off / puck drop). */
  time: string
  /** Link to the match page. */
  href: string
  match: Pick<Match, 'sport' | 'home' | 'away' | 'shootout' | 'finishType' | 'status' | 'start'>
  /** Ordering weight: higher is more prominent. */
  weight: number
}

export interface TickerFixture {
  key: string
  /** Match page link. */
  href: string
  start: string
  home: { name: string, logo: string | null }
  away: { name: string, logo: string | null }
}

export interface LandingData {
  generatedAt: string
  stories: Story[]
  ticker: Array<{
    competitionId: string
    competitionName: string
    sport: SportId
    country: string
    /** Official competition emblem; null when the provider has none (the UI shows a monogram). */
    emblem: string | null
    fixtures: TickerFixture[]
  }>
  tables: Array<{ competitionId: string, competitionName: string, rows: StandingRow[] }>
  /** Competitions that failed to load (rate limit, offline without snapshot). */
  missing: string[]
}
