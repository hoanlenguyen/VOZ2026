// Extra match detail that only richer data sources provide (mock "deep data" matches today):
// event timeline, line-ups and officials. Labels are written by VOZ from structured fields.

export type TimelineKind =
  | 'goal' | 'yellow' | 'red' | 'sub' | 'var'
  | 'shot-saved' | 'shot-missed' | 'shot-blocked' | 'offside' | 'corner'
  | 'half-time' | 'full-time'

export interface TimelineEvent {
  id: string
  /** Display minute, e.g. "45+2'". Null for period markers without a minute. */
  minute: string | null
  /** For ordering: 45+2' -> 45.02. */
  order: number
  side: 'home' | 'away' | null
  kind: TimelineKind
  /** Short label written by VOZ in the reader's language, e.g. "Goal" / "Maali". Display only. */
  label: string
  player: string | null
  /** Assist, player substituted off, etc., with its own label, in the reader's language. Display only. */
  detail: string | null
  /** Structured facts behind the label and detail; code reads these, never the text. */
  goalType: 'regular' | 'own' | 'penalty' | null
  assist: string | null
  playerOff: string | null
  /** Running score after a goal, or the score at a period marker. */
  score: string | null
  /** Key events (goals, cards, subs, VAR, period ends) vs. chances and set pieces. */
  key: boolean
}

export interface LineupPlayer {
  name: string
  number: number | null
  position: string | null
  captain: boolean
}

export interface TeamLineup {
  formation: string | null
  manager: string | null
  /** Formation rows from goalkeeper to forwards, player names. */
  rows: string[][]
  starters: LineupPlayer[]
  substitutes: LineupPlayer[]
}

export interface MatchDetailExtras {
  source: { name: string, url: string | null, note: string | null }
  referee: string | null
  timeline: TimelineEvent[]
  lineups: { home: TeamLineup, away: TeamLineup } | null
}
