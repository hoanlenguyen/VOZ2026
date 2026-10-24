// Newsroom edits of front-page stories: headline, summary and an article body written in the
// TinyMCE editor on /newsroom/stories/:id. One map per language in "kvcache" (Workers KV in
// production, memory in dev), like the hidden-story list in moderation.ts.
// - The body is sanitised here on save (allowlist below), never trusted from the browser; the match
//   page renders it with v-html.
// - `audience` decides who reads the article on the match page: 'everyone' (free and signed-out
//   readers too) or 'subscribers' (premium; others get it in the paywall teaser).
import { FilterXSS } from 'xss'
import type { Lang } from '#shared/utils/format'
import type { ArticleAudience, NewsroomArticle, StoryEdit } from '#shared/types/stories'

const key = (lang: Lang) => `newsroom:story-edits:${lang}`
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

const line = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Validates and cleans an edit sent by the browser; throws 400 on a missing headline. */
export function cleanEdit(input: Record<string, unknown> | undefined, by: string): StoryEdit {
  const headline = line(input?.headline, 160)
  if (!headline) throw createError({ statusCode: 400, statusMessage: 'Headline is required' })
  const body = sanitizeArticle(typeof input?.body === 'string' ? input.body.slice(0, 40_000) : '')
  const audience: ArticleAudience = input?.audience === 'subscribers' ? 'subscribers' : 'everyone'
  return { headline, summary: line(input?.summary, 600), body, audience, by, at: new Date().toISOString() }
}

export async function storyEdits(lang: Lang): Promise<Record<string, StoryEdit>> {
  const map = await useStorage('kvcache').getItem<Record<string, StoryEdit>>(key(lang)).catch(() => null)
  return map && typeof map === 'object' ? map : {}
}

export async function saveStoryEdit(lang: Lang, id: string, edit: StoryEdit | null) {
  const map = await storyEdits(lang)
  if (edit) map[id] = edit
  else delete map[id]
  await useStorage('kvcache').setItem(key(lang), map)
}

/** The newsroom article for a match (result story first, then preview), or null. */
export async function articleForMatch(matchKey: string, lang: Lang): Promise<NewsroomArticle | null> {
  const map = await storyEdits(lang)
  const edit = map[`r-${matchKey}`] ?? map[`p-${matchKey}`]
  if (!edit?.body) return null
  return { headline: edit.headline, body: edit.body, audience: edit.audience, by: edit.by, at: edit.at }
}
