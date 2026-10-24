// AI match preview ("paper") for an upcoming match: an agent reads the News section's trusted-outlet
// articles (VOZ's own validated summaries of them, never the publisher text) and VOZ's pre-match
// facts, then writes a sourced analysis: team news and injuries, each side's strengths and
// weaknesses, what the press says, and insights.

export type PaperSectionKind = 'team-news' | 'home' | 'away' | 'press' | 'insight'

/** A source the paper may cite: an article (a1…: headline + VOZ summary) or a VOZ fact (f1…). */
export interface PaperSource {
  id: string
  kind: 'article' | 'fact'
  /** Article: headline and, once read, VOZ's summary of it; fact: its text. */
  text: string
  title: string | null
  outlet: string | null
  url: string | null
  publishedAt: string | null
}

export interface PaperSentence {
  text: string
  sources: string[]
}

export interface PaperSection {
  kind: PaperSectionKind
  sentences: PaperSentence[]
}

export interface PaperDraft {
  headline: string
  standfirst: PaperSentence
  sections: PaperSection[]
}

export interface PaperStep { turn: number, tool: string, summary: string, ms: number }

export interface MatchPaper extends PaperDraft {
  matchKey: string
  lang: 'en' | 'fi'
  /** Only the sources the paper cites. */
  sources: PaperSource[]
  articlesRead: number
  model: string
  generatedAt: string
  trace: PaperStep[]
}

export interface PaperResponse {
  /** 'none': not enough coverage (3 articles from 2 outlets) yet; 'unavailable': reading or writing failed. */
  status: 'ok' | 'none' | 'unavailable'
  paper: MatchPaper | null
  /** Free and signed-out readers: headline and standfirst only. */
  locked: boolean
}
