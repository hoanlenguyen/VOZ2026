// AI match stories: written by an agent from a ledger of verified facts, checked sentence by sentence.

export type StoryLength = 'short' | 'standard' | 'long'
export type StoryTone = 'neutral' | 'home-fan' | 'away-fan' | 'analyst'
export type FactSection = 'result' | 'timeline' | 'stats' | 'form' | 'table' | 'h2h' | 'context' | 'edge'

/** One verified statement. The agent may only state what facts say, and cites them by id. */
export interface Fact {
  id: string
  section: FactSection
  text: string
}

export interface StorySentence {
  text: string
  /** Ids of the facts this sentence relies on. */
  facts: string[]
  /** Paragraph number, starting at 1. */
  paragraph: number
}

export interface StoryDraft {
  headline: string
  sentences: StorySentence[]
}

export interface StoryCheck {
  passed: boolean
  issues: string[]
  /** Distinct facts cited by the story. */
  factsUsed: number
}

/** One step of the agent run, kept for the "How this was made" panel. */
export interface AgentStep {
  turn: number
  tool: string
  summary: string
  ms: number
}

export interface MatchStory extends StoryDraft {
  matchKey: string
  length: StoryLength
  tone: StoryTone
  /** "agent" when the AI story passed the check; "template" when the harness fell back. */
  origin: 'agent' | 'template'
  model: string | null
  generatedAt: string
  check: StoryCheck
  trace: AgentStep[]
  usage: { inputTokens: number, outputTokens: number, turns: number, ms: number }
  /** Why the harness used the template, when it did. */
  fallbackReason: string | null
}

export interface StoryResponse {
  story: MatchStory
  facts: Fact[]
  cached: boolean
}
