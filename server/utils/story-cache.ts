// Story cache for the demo, fastest first:
//   1. memory   - per server instance, instant
//   2. kvcache  - Workers KV in production (shared by all instances), memory in dev
//   3. bundled  - stories pre-written by `npm run warm:stories` into data/stories/, shipped with the
//                 app, so the demo is instant from the first click even offline or without a key.
//                 They are re-checked against today's facts before use.
//   4. agent    - written now; concurrent requests for the same story share one run.
// Only stories written by the agent that passed the check are cached; template fallbacks are not.

import type { Fact, MatchStory, StoryLength, StoryTone } from '#shared/types/story'

const PROMPT_VERSION = 'v1'
const memory = new Map<string, MatchStory>()
const inFlight = new Map<string, Promise<MatchStory>>()

/** FNV-1a: a short, stable key for the story inputs (facts, variant, model, prompt version). */
function hash(s: string): string {
  let h = 0x811C9DC5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export interface StoryRequest {
  competitionId: string
  matchId: string
  length: StoryLength
  tone: StoryTone
  facts: Fact[]
  names: string[]
  generate: () => Promise<MatchStory>
  /** Skip every cache layer (dev only). */
  fresh?: boolean
}

const storyKey = (req: Omit<StoryRequest, 'generate' | 'fresh'>) =>
  `story:${PROMPT_VERSION}:${req.competitionId}:${req.matchId}:${req.length}-${req.tone}:${hash(JSON.stringify(req.facts) + llmConfig().model)}`

/** A story from the cache layers only (memory, KV, bundled); never runs the agent. */
export async function peekStory(req: Omit<StoryRequest, 'generate' | 'fresh'>): Promise<{ story: MatchStory, cached: 'memory' | 'kv' | 'bundled' } | null> {
  const key = storyKey(req)
  const mem = memory.get(key)
  if (mem) return { story: mem, cached: 'memory' }

  const kv = await useStorage('kvcache').getItem<MatchStory>(key).catch(() => null)
  if (kv) {
    memory.set(key, kv)
    return { story: kv, cached: 'kv' }
  }

  const bundled = await useStorage('assets:stories').getItem<MatchStory>(`${req.competitionId}:${req.matchId}:${req.length}-${req.tone}.json`).catch(() => null)
  if (bundled?.origin === 'agent' && checkStory(bundled, { facts: req.facts, names: req.names, length: req.length }).passed) {
    memory.set(key, bundled)
    return { story: bundled, cached: 'bundled' }
  }
  return null
}

export async function cachedStory(req: StoryRequest): Promise<{ story: MatchStory, cached: 'memory' | 'kv' | 'bundled' | false }> {
  const key = storyKey(req)
  if (!req.fresh) {
    const hit = await peekStory(req)
    if (hit) return hit
  }

  let run = inFlight.get(key)
  if (!run) {
    run = req.generate().finally(() => inFlight.delete(key))
    inFlight.set(key, run)
  }
  const story = await run
  if (story.origin === 'agent') {
    memory.set(key, story)
    await useStorage('kvcache').setItem(key, story).catch(err => console.warn(`[story] KV write failed: ${(err as Error).message}`))
  }
  return { story, cached: false }
}
