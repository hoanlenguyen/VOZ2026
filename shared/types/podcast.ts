// AI podcasts: a 20–30 second spoken summary of one match, one team or one league, written by an
// agent from the verified fact ledger, checked like the match stories, then read aloud by TTS.

import type { Fact, StoryCheck, StorySentence } from './story'

/** What an episode is about. Team and league episodes are the daily ones (scheduled task). */
export type PodcastSubject =
  | { kind: 'match', competitionId: string, matchId: string }
  | { kind: 'team', competitionId: string, teamKey: string }
  | { kind: 'league', competitionId: string }

export type PodcastTrigger = 'newsroom' | 'schedule'

export interface PodcastEpisode {
  /** URL- and file-safe: "<subject id>.<lang>" for matches, "<subject id>.<YYYY-MM-DD>.<lang>" for daily ones. */
  id: string
  /** "match-premier-league-2645271", "team-premier-league-349", "league-liiga". */
  subjectId: string
  subject: PodcastSubject
  /** Who or what the episode is about, as the reader sees it ("Ipswich Town", "Premier League"). */
  label: string
  competitionName: string
  /** Link to the match or league the episode covers. */
  href: string
  lang: 'en' | 'fi'
  title: string
  /** The checked script; each sentence cites its facts. Intro and outro lines are added by code. */
  sentences: StorySentence[]
  intro: string
  outro: string
  /** The facts the script cites (shown under the AI tag). */
  evidence: Fact[]
  /** Hash of all facts the writer got: a daily episode is only rewritten when they change. */
  factsHash: string
  check: StoryCheck
  audio: { url: string, bytes: number, seconds: number | null, voice: string, model: string } | null
  model: string
  trigger: PodcastTrigger
  generatedAt: string
}

export interface PodcastListResponse {
  episodes: PodcastEpisode[]
}

export interface PodcastSchedule {
  /** Subjects that get a new episode every morning (when their facts changed). */
  subjects: PodcastSubject[]
  langs: Array<'en' | 'fi'>
}

export interface PodcastRunResult {
  subjectId: string
  lang: 'en' | 'fi'
  status: 'created' | 'unchanged' | 'failed'
  episodeId: string | null
  error: string | null
}

export interface PodcastRun {
  at: string
  trigger: PodcastTrigger
  results: PodcastRunResult[]
}

export interface PodcastSubjectOption {
  subject: PodcastSubject
  subjectId: string
  label: string
  competitionName: string
}

export interface PodcastDesk {
  schedule: PodcastSchedule
  options: PodcastSubjectOption[]
  lastRun: PodcastRun | null
  /** UTC cron expression of the daily run (wrangler.jsonc triggers). */
  cron: string
}
