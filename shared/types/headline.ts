// AI headlines: a title and a subtitle for a match post, written from the fact ledger (plus the
// "edge" facts on each side's advantages) and checked before anyone sees them.

import type { Fact } from './story.ts'

export interface HeadlineDraft {
  headline: string
  subtitle: string
  /** Ids of the facts the title and subtitle rely on. */
  facts: string[]
}

export interface MatchHeadline {
  matchKey: string
  lang: 'en' | 'fi'
  /** Match state it was written for: "ft-<home>-<away>-<finish>" or "pre-<hash of the pre-match facts>". */
  state?: string
  headline: string
  subtitle: string
  /** The cited facts, kept with the headline so its evidence travels with it through the cache. */
  evidence: Fact[]
  model: string
  generatedAt: string
}

export interface HeadlineResponse {
  /** Null when no checked AI headline exists (no API key, or the writer failed): show the score title. */
  headline: MatchHeadline | null
  cached: boolean
}
