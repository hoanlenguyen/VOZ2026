import type { Match, SportId, StandingRow } from './sports.ts'
import type { StoryLength, StoryTone } from './story.ts'

/**
 * A news item on the landing page. Every sentence is built from data fields; an AI headline and
 * subtitle replace the template headline only after passing the headline checker.
 */
export interface Story {
  id: string
  kind: 'result' | 'preview'
  sport: SportId
  competitionId: string
  competitionName: string
  headline: string
  /** AI-written dek under the headline (only with an AI headline). */
  subtitle?: string
  /** "agent": headline and subtitle written by the AI headline desk and checked; "template": from data templates. */
  headlineOrigin: 'agent' | 'template'
  summary: string
  /** ISO time the story is about (kick-off / puck drop). */
  time: string
  /** Link to the match page. */
  href: string
  match: Pick<Match, 'sport' | 'home' | 'away' | 'shootout' | 'finishType' | 'status' | 'start'>
  /** Ordering weight: higher is more prominent. */
  weight: number
  /** Cover image the newsroom set for the match story; cards show the data visual without one. */
  cover?: { src: string, alt: string }
  /** Public discussion totals (comments, story likes), when the match has a discussion. */
  engagement?: { comments: number, likes: number }
}

/** Who may read a match story: everyone, or subscribers (premium) only. */
export type ArticleAudience = 'everyone' | 'subscribers'

/** The newsroom's edited match story as the match page shows it. `body` is sanitised HTML. */
export interface EditedMatchStory {
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
  /** The AI version readers get (mode 'ai'). */
  length: StoryLength
  tone: StoryTone
  /** The edited version (mode 'edited'); `body` is sanitised HTML. Kept when switching modes. */
  headline: string
  body: string
  /** Cover image (uploaded to the newsroom image store): replaces the match graphic on the match
   *  page and the front-page card. */
  cover: StoryCover | null
  by: string
  at: string
}

export interface StoryCover {
  /** Image id in the newsroom image store; served at /api/images/:id. */
  id: string
  alt: string
  credit: string
}

/** The story section as the match API sends it to this reader (null: no section). */
export interface MatchStorySection {
  mode: StoryMode
  audience: ArticleAudience
  /** The published AI version (mode 'ai'). */
  length: StoryLength
  tone: StoryTone
  /** The newsroom's version when mode is 'edited'. */
  edited: EditedMatchStory | null
  /** The story's headline (the match page title); null when the AI story is not written yet. */
  headline: string | null
  /** When the story was written (AI) or published (edited); null until the AI story exists. */
  publishedAt: string | null
}

/** A cover image as pages show it. */
export interface CoverImage { src: string, alt: string, credit: string }

/** A story's newsroom status: unpublished changes saved (draft), ready for review (preview),
 *  published or automatic (live), or taken off the front page and match page (hidden). */
export type StoryStatus = 'live' | 'preview' | 'draft' | 'hidden'

/** Unpublished editor changes to a match story, per language. */
export interface PendingEdit {
  control: MatchStoryControl
  /** 'draft': work in progress; 'review': ready for review (status "preview"). */
  state: 'draft' | 'review'
  by: string
  at: string
}
