// Minute-by-minute commentary for the match page. Today only hand-written demo feeds exist
// (server/utils/commentary.ts); they are labelled as samples and never feed the stories.

export type CommentaryKind = 'kick-off' | 'chance' | 'save' | 'corner' | 'offside' | 'card' | 'goal' | 'half-time' | 'full-time'

export interface CommentaryEntry {
  id: string
  /** Match minute; `added` is stoppage time ("45+2'"). */
  minute: number
  added: number | null
  kind: CommentaryKind
  side: 'home' | 'away' | null
  text: string
  /** Running score after a goal. */
  score: { home: number, away: number } | null
}

export interface MatchCommentary {
  /** True for invented demo commentary. */
  sample: boolean
  entries: CommentaryEntry[]
}
