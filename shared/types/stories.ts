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
  /** Set when a newsroom editor rewrote the story (headline / summary come from the edit). */
  edited?: { by: string, at: string, audience: ArticleAudience }
}

/** Who may read a newsroom article on the match page: everyone, or subscribers (premium) only. */
export type ArticleAudience = 'everyone' | 'subscribers'

/** A newsroom editor's version of a front-page story, per language. `body` is sanitised HTML. */
export interface StoryEdit {
  headline: string
  summary: string
  body: string
  audience: ArticleAudience
  /** Editor's display name. */
  by: string
  at: string
}

/** The editor's article as the match page shows it. */
export interface NewsroomArticle {
  headline: string
  body: string
  audience: ArticleAudience
  by: string
  at: string
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

/** What readers get in a match's "Match story" section: the checked AI story, the newsroom's
 *  edited version, or nothing. */
export type StoryMode = 'ai' | 'edited' | 'hidden'

/** Newsroom control of a match story, per language. Without one: the AI story, for subscribers. */
export interface MatchStoryControl {
  mode: StoryMode
  audience: ArticleAudience
  /** The edited version (mode 'edited'); `body` is sanitised HTML. Kept when switching modes. */
  headline: string
  body: string
  by: string
  at: string
}

/** The story section as the match API sends it to this reader (null: no section). */
export interface MatchStorySection {
  mode: StoryMode
  audience: ArticleAudience
  /** The newsroom's version when mode is 'edited'. */
  edited: NewsroomArticle | null
}
