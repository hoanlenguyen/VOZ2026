// Wording for the story templates in server/utils/stories.ts. stories.ts decides which facts a story
// states; a phrase set only words them, so every language states exactly the same facts.

export type Outcome = 'draw' | 'shootout' | 'penalties' | 'overtime' | 'extra-time' | 'rout' | 'win'

export interface StoryPhrases {
  /**
   * `home`, `away`, `winner`, `loser`: short team names. `winnerScore`: winner's goals first ("3–0");
   * `score`: home–away with the language's suffix ("3–2 vl").
   */
  headline(o: { outcome: Outcome, home: string, away: string, winner: string, loser: string, winnerScore: string, score: string }): string
  /** The winner trailed `behind` after the first period / half. */
  comeback(team: string, behind: { for: number, against: number }, sport: SportId): string
  xg(home: string, homeXg: number, away: string, awayXg: number): string
  /** `scorers`: "Name" or "Name (2)", in order. */
  scorers(team: string, scorers: string[]): string
  table(team: string, rank: number, league: string, points: number, played: number): string
  attendance(spectators: number, venue: string | null): string
  previewHeadline(home: string, away: string): string
  previewSummary(home: { name: string, rank: number, points: number }, away: { name: string, rank: number, points: number }, venue: string | null): string
}
