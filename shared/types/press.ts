/** A press headline about a match. Only headline, source and link: we never republish article text. */
export interface PressArticle {
  title: string
  url: string
  source: string
  publishedAt: string
  /** Published before or after kick-off / puck drop. */
  timing: 'before' | 'after'
  /** True when `title` was machine-translated into the reader's language; `originalTitle` is the outlet's own. */
  translated: boolean
  originalTitle: string | null
}

export interface PressResult {
  status: 'ok' | 'none' | 'unavailable'
  articles: PressArticle[]
  /** Shown when status is not "ok". */
  note: string | null
}
