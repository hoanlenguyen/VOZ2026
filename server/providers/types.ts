import type { CompetitionDef } from '#shared/utils/competitions'
import type { Match, Sourced, StandingRow, TeamListItem } from '#shared/types/sports'

export type MatchState = 'finished' | 'upcoming'

/** One upstream data source. Each method maps raw API JSON into the shared sport-agnostic types. */
export interface SportProvider {
  /** Null when usable; otherwise why not (missing key, paid plan needed). */
  unavailableReason(c: CompetitionDef): string | null
  hasScoringEvents: boolean
  emblem(c: CompetitionDef): string | null
  teams(c: CompetitionDef): Promise<Sourced<TeamListItem[]>>
  standings(c: CompetitionDef): Promise<Sourced<StandingRow[]>>
  /** All matches of the current season, sorted by start time. */
  matches(c: CompetitionDef, opts: { teamKey?: string, state?: MatchState }): Promise<Sourced<Match[]>>
  match(c: CompetitionDef, id: string): Promise<Sourced<Match>>
}
