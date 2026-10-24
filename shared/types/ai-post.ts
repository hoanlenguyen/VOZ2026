// AI match posts: written by the newsroom agent (server/utils/newsroom-agent.ts) from SportWorld
// matches (simulated match data), waiting for the newsroom to check them before readers see them.

import type { Lang } from '../utils/format.ts'
import type { Fact, MatchStory } from './story.ts'

export type AiPostStatus = 'writing' | 'pending' | 'approved' | 'rejected' | 'failed'

/** Another outlet's coverage of the fixture: attribution only (headline, source, link), never their text. */
export interface AiPostPress {
  title: string
  source: string
  link: string
  publishedAt: string
  /** What it is about: this fixture, or recent news of one of the teams (named in `team`). */
  about: 'match' | 'home' | 'away'
  team: string | null
}

export interface AiPostMatch {
  home: string
  away: string
  score: { home: number, away: number }
  start: string
  venue: string | null
}

export interface AiPost {
  id: string
  matchKey: string
  competitionId: string
  competitionName: string
  matchId: string
  status: AiPostStatus
  createdAt: string
  updatedAt: string
  trigger: AgentTrigger
  /** Always true today: posts come from SportWorld, whose match details are simulated. */
  simulated: boolean
  match: AiPostMatch
  /** The checked story per language (standard length, neutral tone). */
  stories: Partial<Record<Lang, MatchStory>>
  facts: Fact[]
  names: string[]
  press: AiPostPress[]
  /** Why there is no or little press context, when the search said so. */
  pressNote: string | null
  error: string | null
}

export interface AiPostSummary {
  id: string
  status: AiPostStatus
  createdAt: string
  competitionId: string
  competitionName: string
  matchId: string
  headline: string
  match: AiPostMatch
  /** "template" when the agent could not write a checked story and the facts were used as they are. */
  origin: 'agent' | 'template' | null
  langs: Lang[]
  pressCount: number
  error: string | null
}

export type AgentTrigger = 'schedule' | 'manual'

export interface AgentSettings {
  enabled: boolean
  /** Minutes between runs; the cron checks every AGENT_CRON tick. */
  intervalMinutes: number
  langs: Lang[]
}

export interface AgentRunResult {
  matchId: string
  label: string
  status: 'created' | 'failed'
  postId: string | null
  error: string | null
}

export interface AgentRun {
  at: string
  trigger: AgentTrigger
  results: AgentRunResult[]
  /** SportWorld matches still without a post after this run. */
  waiting: number
}

export interface AgentDesk {
  settings: AgentSettings
  cron: string
  lastRun: AgentRun | null
  nextRunAt: string | null
  waiting: number
  posts: AiPostSummary[]
  aiConfigured: boolean
}
