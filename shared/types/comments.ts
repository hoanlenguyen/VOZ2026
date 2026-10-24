// Discussion under a match story (subscribers and newsroom). Totals are public; the comments are not.

export type CommentRole = 'reader' | 'newsroom'

/** A comment as the reader gets it (no account ids). */
export interface PublicComment {
  id: string
  author: { name: string, role: CommentRole }
  /** Written by the signed-in reader (they may delete it). */
  mine: boolean
  text: string
  at: string
  /** Replies point to a top-level comment (one level). */
  parentId: string | null
  /** Hidden by the newsroom; only newsroom accounts receive hidden comments. */
  hidden: boolean
  likes: number
  likedByMe: boolean
}

/** Public totals: visible comments and likes on the story. */
export interface Engagement {
  comments: number
  likes: number
}

export interface Discussion {
  comments: PublicComment[]
  storyLikedByMe: boolean
  engagement: Engagement
}
