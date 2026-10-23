// Sport-agnostic shapes the app works with. Each provider (server/providers/*) maps its raw
// API JSON into these; raw JSON never reaches the browser except through the debug proxy.

export type SportId = 'hockey' | 'football'
export type ProviderId = 'liiga' | 'football-data'
export type DataSource = 'live' | 'snapshot'

export interface Competition {
  /** Our URL-safe id, e.g. "liiga", "premier-league". */
  id: string
  sport: SportId
  provider: ProviderId
  name: string
  country: string
  emblem: string | null
  /** False when the provider is not configured (missing key) or the plan does not cover it. */
  available: boolean
  /** Why it is unavailable, for the UI. */
  unavailableReason: string | null
  /** Whether match data includes scoring events (scorer, minute); football free tier has none. */
  hasScoringEvents: boolean
}

export interface PlayerRef {
  id: number | null
  name: string
}

export interface TeamListItem {
  /** Globally unique: "<competition>:<team>", e.g. "liiga:karpat", "premier-league:57". */
  key: string
  competitionId: string
  name: string
  shortName: string
  abbr: string
  town: string | null
  venue: string | null
  logo: string | null
}

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'

/** How a finished match was decided. Hockey: overtime/shootout. Football: extra-time/penalties. */
export type FinishType = 'regulation' | 'overtime' | 'shootout' | 'extra-time' | 'penalties'

export interface ScoringEvent {
  id: string
  side: 'home' | 'away'
  /** 1-based period (hockey) or half (football); overtime / extra time continue the count. */
  period: number | null
  /** Seconds from the start of the match (football: minute * 60). */
  clock: number
  /** Display label, e.g. "49:46" (hockey) or "45+2'" (football). */
  clockLabel: string
  scorer: PlayerRef
  assists: PlayerRef[]
  /** Normalised tags across sports. */
  tags: Array<'power-play' | 'short-handed' | 'empty-net' | 'penalty' | 'own-goal' | 'game-winner'>
  /** Raw provider codes, kept for traceability (Liiga: YV, AV, TM, ...; football-data: REGULAR, OWN, PENALTY). */
  rawTypes: string[]
  homeScore: number
  awayScore: number
  clipUrl: string | null
}

export interface MatchTeam {
  /** Same key format as TeamListItem.key. */
  key: string
  name: string
  shortName: string
  logo: string | null
  /** Goals in regulation + overtime/extra time; shootout/penalty-shootout goals excluded. */
  score: number | null
  /** League position as reported by the provider at match time, if any. */
  rank: number | null
  /** Sport-specific numbers (xg, powerplayGoals, ...). Keys are stable; values come straight from the provider. */
  stats: Record<string, number | null>
}

export interface Match {
  /** "<competition>:<provider match id>". */
  key: string
  id: string
  competitionId: string
  sport: SportId
  season: string
  start: string
  status: MatchStatus
  finishType: FinishType | null
  round: number | null
  venue: string | null
  attendance: number | null
  home: MatchTeam
  away: MatchTeam
  /** Goals per period (hockey) or half (football), as far as the provider reports them. */
  periods: Array<{ home: number, away: number }>
  /**
   * Set when a shootout (hockey) or penalty shootout (football) decided the match. Tallies are null
   * when the provider does not report them. Hockey convention adds one goal to the winner's final
   * score; use formatScore() for display instead of adding it yourself.
   */
  shootout: { winner: 'home' | 'away', home: number | null, away: number | null } | null
  /** Empty when the provider plan has no event data (see Competition.hasScoringEvents). */
  goals: ScoringEvent[]
  /** Events the provider lists that did not change the score (disallowed goals, missed penalty shots). */
  notCounted: ScoringEvent[]
}

export interface StandingRow {
  rank: number
  teamKey: string
  name: string
  logo: string | null
  played: number
  won: number
  drawn: number
  lost: number
  /** Hockey only: wins/losses after regulation (OT or shootout). */
  overtimeWins: number | null
  overtimeLosses: number | null
  points: number
  goalsFor: number
  goalsAgainst: number
  /** Football: recent results, e.g. "W,D,L,W,W". */
  form: string | null
  extras: Record<string, number | null>
}

export interface Sourced<T> {
  data: T
  source: DataSource
}
