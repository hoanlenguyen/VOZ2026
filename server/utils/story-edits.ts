// Newsroom control of match stories, made on /newsroom/stories/:id: the AI story, the newsroom's
// edited version or hidden, and its audience. One map per language in "kvcache" (Workers KV in
// production, memory in dev), by match key, like the hidden-story list in moderation.ts.
// Edited bodies are sanitised here on save (allowlist below), never trusted from the browser; the match
// page renders them with v-html. `audience` decides who reads them: 'everyone' (free and signed-out
// readers too) or 'subscribers' (premium; others get the opening as the paywall teaser).
import { FilterXSS } from 'xss'
import type { Lang } from '#shared/utils/format'
import type { ArticleAudience, MatchStoryControl, StoryCover, StoryMode } from '#shared/types/stories'

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
export const DEFAULT_STORY_CONTROL: Pick<MatchStoryControl, 'mode' | 'audience'> = { mode: 'ai', audience: 'subscribers' }
const MODES: StoryMode[] = ['ai', 'edited', 'hidden']
const controlKey = (lang: Lang) => `newsroom:match-stories:${lang}`

/** Validates a match story control; the edited version needs a headline and text. */
export function cleanStoryControl(input: Record<string, unknown> | undefined, by: string): MatchStoryControl {
  const mode = MODES.includes(input?.mode as StoryMode) ? input!.mode as StoryMode : 'ai'
  const headline = line(input?.headline, 160)
  const body = sanitizeArticle(typeof input?.body === 'string' ? input.body.slice(0, 40_000) : '')
  if (mode === 'edited' && (!headline || !plainText(body))) {
    throw createError({ statusCode: 400, statusMessage: 'The edited match story needs a headline and text' })
  }
  return { mode, audience: audienceOf(input?.audience), headline, body, cover: cleanCover(input?.cover), by, at: new Date().toISOString() }
}

/** A cover needs a stored image id and alt text; the PUT handler checks the image exists. */
function cleanCover(input: unknown): StoryCover | null {
  const c = input as Record<string, unknown> | null | undefined
  if (!c || typeof c.id !== 'string' || !IMAGE_ID.test(c.id)) return null
  const alt = line(c.alt, 200)
  if (!alt) throw createError({ statusCode: 400, statusMessage: 'The cover image needs alt text' })
  return { id: c.id, alt, credit: line(c.credit, 120) }
}

/** The cover as pages show it (null when the story is hidden). */
export function coverOf(control: MatchStoryControl | null) {
  const c = control?.mode !== 'hidden' ? control?.cover : null
  return c ? { src: imageUrl(c.id), alt: c.alt, credit: c.credit } : null
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
