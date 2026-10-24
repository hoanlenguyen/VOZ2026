/** A press headline about a match. Only headline, source and link: we never republish article text. */
export interface PressArticle {
  title: string
  url: string
  source: string
  publishedAt: string
  /** Published before or after kick-off / puck drop. */
  timing: 'before' | 'after'
}

export interface PressResult {
  status: 'ok' | 'none' | 'unavailable'
  articles: PressArticle[]
  /** Shown when status is not "ok". */
  note: string | null
}
