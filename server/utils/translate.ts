// Translation agent for text VOZ does not write itself (other outlets' headlines), via the OpenAI
// Responses API client shared with the story agent (server/utils/llm.ts; NUXT_OPENAI_API_KEY / NUXT_OPENAI_MODEL).
// - Every result is cached in "kvcache" (Workers KV in production, memory in dev) for 30 days, and
//   concurrent requests for the same text share one call: a text is sent to the model only once.
// - All uncached texts of a request go in one chat call.
// - Number guard: a translation must contain exactly the numbers of the original (scores, minutes),
//   otherwise the original is kept and nothing is cached, so it is retried later.
// - Any failure (no token, timeout, bad JSON) returns the originals; callers never break.

import type { Lang } from '#shared/utils/format'

export interface Translation {
  text: string
  /** True when the text differs from the original. */
  translated: boolean
}

const TTL_SECONDS = 30 * 86_400
const MAX_CALLS_PER_MINUTE = 20
const LANGUAGE: Record<Lang, string> = { en: 'English', fi: 'Finnish' }

const inflight = new Map<string, Promise<string | null>>()
const callTimes: number[] = []

async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Same digit groups in the same multiset: "1-1", "45+2'" and "3–0" must survive translation. */
export function keepsNumbers(original: string, translation: string): boolean {
  const nums = (s: string) => (s.match(/\d+/g) ?? []).sort().join(',')
  return translation.trim().length > 0 && nums(original) === nums(translation)
}

function underRateLimit(): boolean {
  const now = Date.now()
  while (callTimes.length && now - callTimes[0]! > 60_000) callTimes.shift()
  if (callTimes.length >= MAX_CALLS_PER_MINUTE) return false
  callTimes.push(now)
  return true
}

/** One chat call for a batch of texts; null when the call fails or the answer does not fit. */
async function callModel(texts: string[], target: Lang): Promise<string[] | null> {
  if (!llmConfig().key || !underRateLimit()) return null
  const system = [
    `Translate each sports news headline into ${LANGUAGE[target]}.`,
    'Keep team, player, club and competition names unchanged. Keep every number and score exactly as written.',
    `If a headline is already in ${LANGUAGE[target]}, return it unchanged.`,
    'Reply only with JSON {"translations": [...]} with one string per headline, in the same order.',
  ].join(' ')
  console.info(`[translate] model call: ${texts.length} text(s) -> ${target}`)
  try {
    const res = await respond({ instructions: system, input: [{ role: 'user', content: JSON.stringify(texts) }], tools: [] })
    // The answer is the output_text of the "message" item (a "reasoning" item comes before it).
    const message = res.output.find(o => 'type' in o && o.type === 'message') as { content?: Array<{ type: string, text?: string }> } | undefined
    const content = message?.content?.find(c => c.type === 'output_text')?.text ?? ''
    const json = JSON.parse(content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1)) as { translations?: unknown }
    const out = json.translations
    return Array.isArray(out) && out.length === texts.length && out.every(t => typeof t === 'string') ? out as string[] : null
  }
  catch (err) {
    console.warn(`[translate] ${(err as Error).message}`)
    return null
  }
}

/** Translates texts into `target`, from cache where possible. Order and length match `texts`. */
export async function translateTexts(texts: string[], target: Lang): Promise<Translation[]> {
  if (!texts.length) return []
  const { model } = llmConfig()
  const storage = useStorage('kvcache')
  const keys = await Promise.all(texts.map(async t => `tr:v1:${target}:${model}:${await sha256(t)}`))
  const results = new Map<string, Promise<string | null>>()

  // 1. Cache hits and calls already in flight.
  const missing: number[] = []
  await Promise.all(keys.map(async (key, i) => {
    if (results.has(key)) return
    const pending = inflight.get(key)
    if (pending) return results.set(key, pending)
    const cached = await storage.getItem<string>(key).catch(() => null)
    if (typeof cached === 'string') return results.set(key, Promise.resolve(cached))
    missing.push(i)
  }))

  // 2. One model call for everything else; each text gets its own promise so other requests can share it.
  const todo = [...new Map(missing.map(i => [keys[i]!, texts[i]!])).entries()]
  if (todo.length) {
    const batch = callModel(todo.map(([, text]) => text), target)
    todo.forEach(([key, original], j) => {
      const one = batch.then(async (out) => {
        const t = out?.[j]?.trim()
        if (!t || !keepsNumbers(original, t)) return null
        await storage.setItem(key, t, { ttl: TTL_SECONDS }).catch(err => console.warn(`[translate] cache: ${(err as Error).message}`))
        return t
      }).finally(() => inflight.delete(key))
      inflight.set(key, one)
      results.set(key, one)
    })
  }

  return Promise.all(texts.map(async (original, i) => {
    const t = await results.get(keys[i]!)
    return t && t !== original.trim() ? { text: t, translated: true } : { text: original, translated: false }
  }))
}
