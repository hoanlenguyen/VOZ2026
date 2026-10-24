// Discussion under a match story: comments (one level of replies) and likes, per match key, in
// "kvcache" (Workers KV in production, memory in dev). Subscribers and the newsroom read, post and
// like; the newsroom also hides and deletes. Totals (visible comments, story likes) are public and
// kept in one "engagement" map so the front page reads them all at once.
// Demo: a match without a stored thread starts from data/comments/<competition>-<id>.json.
import type { H3Event } from 'h3'
import type { CommentRole, Discussion, Engagement, PublicComment } from '#shared/types/comments'

interface StoredComment {
  id: string
  author: { id: string, name: string, role: CommentRole }
  text: string
  at: string
  parentId: string | null
  hidden: boolean
  likedBy: string[]
  /** Demo likes from the seed file, added to likedBy.length. */
  likesBase?: number
}

interface Thread {
  comments: StoredComment[]
  storyLikedBy: string[]
  storyLikesBase?: number
}

const MAX_COMMENTS = 500
const RATE_MS = 15_000
const lastPost = new Map<string, number>()
const threadKey = (matchKey: string) => `thread:${matchKey}`
const seedName = (matchKey: string) => `${matchKey.replace(':', '-')}.json`

/** The match key of a match route (the mock "deep data" match and its provider twin share one). */
export async function routeMatchKey(event: H3Event): Promise<string> {
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  const season = await provider.matches(def, {}).then(r => r.data, () => [])
  const mock = await findMockMatch(def, id, season)
  return mock?.match.key ?? `${def.id}:${id}`
}

export async function loadThread(matchKey: string): Promise<Thread> {
  const stored = await useStorage('kvcache').getItem<Thread>(threadKey(matchKey)).catch(() => null)
  if (stored) return stored
  const seed = await useStorage('assets:comments').getItem<Thread>(seedName(matchKey)).catch(() => null)
  return seed ? structuredClone(seed) : { comments: [], storyLikedBy: [] }
}

const likesOf = (c: StoredComment) => c.likedBy.length + (c.likesBase ?? 0)

export function engagementOf(thread: Thread): Engagement {
  return {
    comments: thread.comments.filter(c => !c.hidden).length,
    likes: thread.storyLikedBy.length + (thread.storyLikesBase ?? 0),
  }
}

export async function saveThread(matchKey: string, thread: Thread) {
  thread.comments = thread.comments.slice(-MAX_COMMENTS)
  const storage = useStorage('kvcache')
  const map = (await storage.getItem<Record<string, Engagement>>('engagement').catch(() => null)) ?? {}
  map[matchKey] = engagementOf(thread)
  await Promise.all([storage.setItem(threadKey(matchKey), thread), storage.setItem('engagement', map)])
}

/** Public totals for every match with a discussion (stored ones, then demo seeds not yet stored). */
export async function engagementMap(): Promise<Record<string, Engagement>> {
  const map = { ...((await useStorage('kvcache').getItem<Record<string, Engagement>>('engagement').catch(() => null)) ?? {}) }
  const seeds = await useStorage('assets:comments').getKeys().catch(() => [] as string[])
  await Promise.all(seeds.filter(k => k.endsWith('.json')).map(async (k) => {
    const matchKey = k.replace(/-(\d+)\.json$/, ':$1')
    if (map[matchKey]) return
    const seed = await useStorage('assets:comments').getItem<Thread>(k).catch(() => null)
    if (seed) map[matchKey] = engagementOf(seed)
  }))
  return map
}

/** The thread as this reader may see it: hidden comments only for the newsroom; no account ids. */
export function discussionFor(thread: Thread, accountId: string, newsroom: boolean): Discussion {
  const visible = thread.comments.filter(c => newsroom || !c.hidden)
  const toPublic = (c: StoredComment): PublicComment => ({
    id: c.id, author: { name: c.author.name, role: c.author.role }, mine: c.author.id === accountId,
    text: c.text, at: c.at, parentId: c.parentId, hidden: c.hidden, likes: likesOf(c), likedByMe: c.likedBy.includes(accountId),
  })
  return { comments: visible.map(toPublic), storyLikedByMe: thread.storyLikedBy.includes(accountId), engagement: engagementOf(thread) }
}

export function addComment(thread: Thread, author: StoredComment['author'], input: Record<string, unknown> | undefined) {
  const last = lastPost.get(author.id) ?? 0
  if (Date.now() - last < RATE_MS) throw createError({ statusCode: 429, statusMessage: 'Wait a moment before posting again' })
  const cleaned = cleanCommentText(input?.text)
  if ('error' in cleaned) throw createError({ statusCode: 400, statusMessage: `Comment ${cleaned.error}` })
  const parentId = typeof input?.parentId === 'string' ? input.parentId : null
  if (parentId) {
    const parent = thread.comments.find(c => c.id === parentId)
    if (!parent || parent.parentId) throw createError({ statusCode: 400, statusMessage: 'Reply to a top-level comment' })
  }
  lastPost.set(author.id, Date.now())
  thread.comments.push({ id: crypto.randomUUID(), author, text: cleaned.text, at: new Date().toISOString(), parentId, hidden: false, likedBy: [] })
}

export function findComment(thread: Thread, id: string): StoredComment {
  const c = thread.comments.find(x => x.id === id)
  if (!c) throw createError({ statusCode: 404, statusMessage: 'Comment not found' })
  return c
}

/** Deleting a top-level comment removes its replies too. */
export function removeComment(thread: Thread, id: string) {
  thread.comments = thread.comments.filter(c => c.id !== id && c.parentId !== id)
}

export function setLike(list: string[], accountId: string, liked: boolean): string[] {
  const without = list.filter(x => x !== accountId)
  return liked ? [...without, accountId] : without
}

/** Signed-in subscriber or newsroom account, as the comment author. */
export async function commenter(event: H3Event) {
  const { account, entitlements } = await requireEntitlement(event, 'premium')
  return { id: account!.id, name: account!.name, role: (entitlements.newsroom ? 'newsroom' : 'reader') as CommentRole, newsroom: entitlements.newsroom }
}
