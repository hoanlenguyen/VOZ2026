// Normalised shapes the app works with. Raw Liiga JSON stays on the server.

export interface PlayerRef {
  id: number
  name: string
}

export type FinishType = 'regulation' | 'overtime' | 'shootout'

export interface GoalEvent {
  eventId: number
  side: 'home' | 'away'
  period: number
  /** Seconds from the start of the game. */
  gameTime: number
  scorer: PlayerRef
  assists: PlayerRef[]
  /** Raw Liiga goal type codes, e.g. YV (power play), AV (short-handed), TM (empty net). */
  types: string[]
  homeScore: number
  awayScore: number
  winningGoal: boolean
  scorerSeasonGoals: number | null
  clipUrl: string | null
  thumbnailUrl: string | null
}

export interface TeamInGame {
  id: string
  slug: string | null
  name: string
  logo: string | null
  score: number
  xg: number | null
  powerplayGoals: number | null
  powerplayChances: number | null
  shortHandedGoals: number | null
  /** League rank at the time of the game, as reported by Liiga. */
  ranking: number | null
}

export interface GameSummary {
  id: number
  season: number
  serie: string
  start: string
  started: boolean
  ended: boolean
  finishType: FinishType | null
  gameWeek: number | null
  spectators: number | null
  rink: string | null
  home: TeamInGame
  away: TeamInGame
  /** Goals scored in regulation and overtime, in order. */
  goals: GoalEvent[]
  /** The deciding shootout goal (type VL); the final score includes +1 for its side. */
  shootoutWinner: GoalEvent | null
  /** Goal events Liiga lists that did not change the score (disallowed, missed penalty shot, ...). */
  notCounted: GoalEvent[]
}

export interface StandingRow {
  rank: number
  teamId: string
  slug: string | null
  name: string
  logo: string | null
  games: number
  wins: number
  overtimeWins: number
  losses: number
  overtimeLosses: number
  points: number
  goalsFor: number
  goalsAgainst: number
  powerplayPct: number | null
  penaltyKillPct: number | null
}

export interface TeamListItem {
  id: string
  slug: string
  name: string
  abbr: string
  town: string
  logo: string | null
}
