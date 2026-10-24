// Newsroom control of match stories, made on /newsroom/stories/:id: the AI story, the newsroom's
// edited version or hidden, and its audience. One map per language in "kvcache" (Workers KV in
// production, memory in dev), by match key, like the hidden-story list in moderation.ts.
// Edited bodies are sanitised here on save (allowlist below), never trusted from the browser; the match
// page renders them with v-html. `audience` decides who reads them: 'everyone' (free and signed-out
// readers too) or 'subscribers' (premium; others get the opening as the paywall teaser).
import type { H3Event } from 'h3'
import { FilterXSS } from 'xss'
import type { Lang } from '#shared/utils/format'
import type { StoryLength, StoryTone } from '#shared/types/story'
import type { ArticleAudience, CoverImage, MatchStoryControl, StoryCover, StoryMode } from '#shared/types/stories'

export const STORY_ID = /^[rp]-[\w-]+:\w+$/

// Tags the editor toolbar can produce (blocks, inline marks, lists, links); everything else is
// stripped with its text kept, <script>/<style> with their content.
const html = new FilterXSS({
  whiteList: {
    p: [], br: [], h2: [], h3: [], blockquote: [], ul: [], ol: [], li: [],
    strong: [], em: [], u: [], s: [], a: ['href', 'title'],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  onTagAttr(tag, name, value) {
    // Links: web, mail or site-relative only (xss already drops javascript: and friends).
    if (tag === 'a' && name === 'href' && !/^(https?:\/\/|mailto:|\/(?!\/))/i.test(value.trim())) return ''
  },
})

export function sanitizeArticle(body: string): string {
  return html.process(body).replace(/<p>\s*(&nbsp;| )?\s*<\/p>/g, '').trim()
}

export function plainText(htmlText: string): string {
  return htmlText
    .replace(/<\/(p|h2|h3|li|blockquote)>|<br\s*\/?>/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The opening two sentences of an HTML body's paragraphs (headings and lists left out). */
export function excerpt(htmlText: string): string {
  const text = [...htmlText.matchAll(/<p>(.*?)<\/p>/gs)].map(m => plainText(m[1]!)).join(' ')
  const sentences = text.match(/[^.!?]+[.!?]+/g)
  return sentences ? sentences.slice(0, 2).join('').trim() : text.slice(0, 240)
}

const audienceOf = (v: unknown): ArticleAudience => (v === 'subscribers' ? 'subscribers' : 'everyone')
const line = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Readers' default when the newsroom has not touched a match story. */
export const DEFAULT_STORY_CONTROL: Pick<MatchStoryControl, 'mode' | 'audience' | 'length' | 'tone'> = { mode: 'ai', audience: 'subscribers', length: 'standard', tone: 'neutral' }
const MODES: StoryMode[] = ['ai', 'edited', 'hidden']
const LENGTHS: StoryLength[] = ['short', 'standard', 'long']
const TONES: StoryTone[] = ['neutral', 'home-fan', 'away-fan', 'analyst']
const controlKey = (lang: Lang) => `newsroom:match-stories:${lang}`

/** Validates a match story control; the edited version needs a headline and text. */
export function cleanStoryControl(input: Record<string, unknown> | undefined, by: string): MatchStoryControl {
  const mode = MODES.includes(input?.mode as StoryMode) ? input!.mode as StoryMode : 'ai'
  const headline = line(input?.headline, 160)
  const body = sanitizeArticle(typeof input?.body === 'string' ? input.body.slice(0, 40_000) : '')
  if (mode === 'edited' && (!headline || !plainText(body))) {
    throw createError({ statusCode: 400, statusMessage: 'The edited match story needs a headline and text' })
  }
  return {
    mode,
    audience: audienceOf(input?.audience),
    length: LENGTHS.includes(input?.length as StoryLength) ? input!.length as StoryLength : 'standard',
    tone: TONES.includes(input?.tone as StoryTone) ? input!.tone as StoryTone : 'neutral',
    headline,
    body,
    cover: cleanCover(input?.cover),
    by,
    at: new Date().toISOString(),
  }
}

/** A cover needs a stored image id and alt text; the PUT handler checks the image exists. */
function cleanCover(input: unknown): StoryCover | null {
  const c = input as Record<string, unknown> | null | undefined
  if (!c || typeof c.id !== 'string' || !IMAGE_ID.test(c.id)) return null
  const alt = line(c.alt, 200)
  if (!alt) throw createError({ statusCode: 400, statusMessage: 'The cover image needs alt text' })
  return { id: c.id, alt, credit: line(c.credit, 120) }
}

/** The cover as pages show it; it belongs to the match, so it shows whatever the story mode. */
export function coverOf(control: MatchStoryControl | null): CoverImage | null {
  const c = control?.cover
  return c ? { src: imageUrl(c.id), alt: c.alt, credit: c.credit } : null
}

/** The control with defaults filled in (controls saved before length/tone existed lack them). */
export function controlSettings(control: MatchStoryControl | null) {
  return { ...DEFAULT_STORY_CONTROL, ...control }
}

export async function storyControls(lang: Lang): Promise<Record<string, MatchStoryControl>> {
  const map = await useStorage('kvcache').getItem<Record<string, MatchStoryControl>>(controlKey(lang)).catch(() => null)
  return map && typeof map === 'object' ? map : {}
}

export async function matchStoryControl(matchKey: string, lang: Lang): Promise<MatchStoryControl | null> {
  return (await storyControls(lang))[matchKey] ?? null
}

export async function saveMatchStoryControl(lang: Lang, matchKey: string, control: MatchStoryControl | null) {
  const map = await storyControls(lang)
  if (control) map[matchKey] = control
  else delete map[matchKey]
  await useStorage('kvcache').setItem(controlKey(lang), map)
}

// Preview drafts: the editor's unsaved control, kept for an hour, so the real match page can be
// shown with it (?draft=<id>&as=subscriber|free) before publishing.
const DRAFT_ID = /^[a-f0-9-]{36}$/
const DRAFT_TTL = 3600
const draftKey = (id: string) => `newsroom:draft:${id}`

export async function saveDraft(matchKey: string, control: MatchStoryControl): Promise<string> {
  const id = crypto.randomUUID()
  await useStorage('kvcache').setItem(draftKey(id), { matchKey, control }, { ttl: DRAFT_TTL })
  return id
}

/**
 * Who is reading and which control applies. Normally the session's entitlements and the published
 * control; for a newsroom account previewing a draft of this match, the draft and a simulated
 * subscriber or free reader (never newsroom), so the page shows exactly what that reader gets.
 */
export async function readerContext(event: H3Event, matchKey: string, lang: Lang) {
  const info = await sessionInfo(event)
  const q = getQuery(event)
  if (info.entitlements.newsroom && typeof q.draft === 'string' && DRAFT_ID.test(q.draft)) {
    const draft = await useStorage('kvcache').getItem<{ matchKey: string, control: MatchStoryControl }>(draftKey(q.draft)).catch(() => null)
    if (draft?.matchKey === matchKey) {
      return { entitlements: entitlements(q.as === 'free' ? 'free' : 'subscriber'), control: draft.control, preview: true }
    }
  }
  return { entitlements: info.entitlements, control: await matchStoryControl(matchKey, lang), preview: false }
}
