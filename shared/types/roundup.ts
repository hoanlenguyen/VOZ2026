// AI press roundup for an upcoming match: a breaking-news style headline and a short pre-match
// article written from other outlets' headlines (attributed, linked) and VOZ's own pre-match facts.

/** A source the roundup may cite: a press headline (h1…) or a VOZ fact (f1…). */
export interface RoundupSource {
  id: string
  kind: 'press' | 'fact'
  /** Headline (press) or fact text. */
  text: string
  /** Press: the outlet name, link and time. */
  outlet: string | null
  url: string | null
  publishedAt: string | null
}

export interface RoundupSentence {
  text: string
  /** Ids of the sources the sentence relies on. */
  sources: string[]
  paragraph: number
}

export interface RoundupDraft {
  headline: string
  sentences: RoundupSentence[]
}

export interface PressRoundup extends RoundupDraft {
  matchKey: string
  lang: 'en' | 'fi'
  /** Only the sources the roundup cites, in citation order. */
  sources: RoundupSource[]
  model: string
  generatedAt: string
}

export interface RoundupResponse {
  /** 'none': not enough press coverage yet; 'unavailable': press search or model off. */
  status: 'ok' | 'none' | 'unavailable'
  roundup: PressRoundup | null
  /** Free and signed-out readers: headline and opening only. */
  locked: boolean
}
