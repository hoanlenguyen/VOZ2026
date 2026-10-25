// Mock fan communities (demo): invented groups and members, posts written for the demo.

export interface Community {
  id: string
  name: string
  /** Competition the community follows (crest-free badge colour comes from the sport). */
  competitionId: string
  sport: 'football' | 'hockey'
  description: string
  members: number
}

export interface CommunityPoll {
  question: string
  options: Array<{ label: string, votes: number }>
}

/** Drawn mock pictures (app/components/news/CommunityImage.vue); never photos from other sites. */
export type CommunityImageKind = 'stadium' | 'coach' | 'tactics' | 'shotmap' | 'powerplay' | 'rink'

export interface CommunityPost {
  id: string
  communityId: string
  author: string
  /** Moderators get a badge. */
  role: 'member' | 'moderator'
  at: string
  title: string | null
  text: string
  poll: CommunityPoll | null
  /** A drawn picture with its alt text (in the post's language). */
  image: { kind: CommunityImageKind, alt: string } | null
  likes: number
  replies: number
  tags: string[]
  /** The language the member wrote in (posts are not translated). */
  lang: 'en' | 'fi'
}

export interface CommunitiesFeed {
  communities: Community[]
  posts: CommunityPost[]
  mock: true
}
