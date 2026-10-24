// A reader's favourites (/my-teams). Stored per account on the server (server/utils/preferences.ts).

export interface Preferences {
  /** Team keys, "<competition>:<team>". */
  teams: string[]
  /** Competition ids. */
  leagues: string[]
  /** Player keys, "<team key>:<player slug>". */
  players: string[]
}

/** What a reader can choose from (mock data today: the teams and players of the demo matches). */
export interface PreferenceOptions {
  teams: Array<{ key: string, name: string, shortName: string, logo: string | null, competitionId: string, competitionName: string }>
  leagues: Array<{ id: string, name: string, country: string, sport: string, available: boolean }>
  players: Array<{ key: string, name: string, number: number | null, position: string | null, teamKey: string }>
}
