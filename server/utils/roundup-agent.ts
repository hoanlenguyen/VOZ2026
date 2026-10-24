// AI press roundup for an upcoming match: one Responses call (no tools) writes a breaking-news style
// headline and a short pre-match article from the "What the press says" headlines (h1…, the
// outlets' own titles, published before kick-off) and VOZ's pre-match facts (f1…). checkRoundup()
// (shared/utils/roundup-check.ts) must pass: claims attributed to their outlet, every number and
// name in the cited sources, no quotes; one retry with the problems, then nothing is shown.
// We never republish article text: only headlines go in, and the roundup links each outlet.
// Cache: memory -> kvcache (6 h), keyed by match, language, model and the set of headlines.

import type { Lang } from '#shared/utils/format'
import type { CompetitionDef } from '#shared/utils/competitions'
import type { PressArticle } from '#shared/types/press'
import type { PressRoundup, RoundupDraft, RoundupSource } from '#shared/types/roundup'
import type { ResponseItem } from './llm'

const PROMPT_VERSION = 'r4'
const TTL_SECONDS = 6 * 3600
const MIN_HEADLINES = 3
const MAX_CALLS_PER_MINUTE = 20
const memory = new Map<string, PressRoundup>()
const inFlight = new Map<string, Promise<PressRoundup | null>>()
const callTimes: number[] = []
const LANGUAGE: Record<Lang, string> = { en: 'English', fi: 'Finnish' }

function hash(s: string): string {
  let h = 0x811C9DC5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

function underRateLimit(): boolean {
  const now = Date.now()
  while (callTimes.length && now - callTimes[0]! > 60_000) callTimes.shift()
  if (callTimes.length >= MAX_CALLS_PER_MINUTE) return false
  callTimes.push(now)
  return true
}

export interface RoundupInput {
  competition: CompetitionDef
  match: Match
  season: Match[]
  articles: PressArticle[]
}

interface Prepared extends RoundupInput {
  key: string
  sources: RoundupSource[]
  names: string[]
}

/** Sources (press headlines before kick-off, then pre-match facts) and the cache key; null without enough press. */
export function prepareRoundup(input: RoundupInput, lang: Lang): Prepared | null {
  const press = input.articles.filter(a => a.timing === 'before')
  if (press.length < MIN_HEADLINES) return null
  const sources: RoundupSource[] = press.map((a, i) => ({
    id: `h${i + 1}`, kind: 'press', text: a.originalTitle ?? a.title, outlet: a.source, url: a.url, publishedAt: a.publishedAt,
  }))
  const { edge } = matchFacts(input.competition, input.match, null, input.season)
  edge.forEach((f, i) => sources.push({ id: `f${i + 1}`, kind: 'fact', text: f.text, outlet: null, url: null, publishedAt: null }))
  const m = input.match
  const names = [m.home.name, m.home.shortName, m.away.name, m.away.shortName, input.competition.name]
  const key = `roundup:${PROMPT_VERSION}:${lang}:${llmConfig().model}:${m.key}:${hash(sources.map(s => s.text).join('\n'))}`
  return { ...input, key, sources, names }
}

function instructions(lang: Lang): string {
  return `You are the breaking-news desk of VOZ, a sports news app. Before a match, write a short pre-match news piece that pulls together what other outlets are reporting, from their headlines only, plus VOZ's verified facts.

Write:
- A headline in a breaking-news style: the most newsworthy development itself (a fitness doubt, team news, a postponement risk, a prediction), 6–12 words, present tense, specific. State the news, not who reported it: no outlet name in the headline (the body attributes it). No clickbait, no questions, no exclamation marks.
- Two or three short paragraphs, 90–200 words in all, in ${LANGUAGE[lang]}: first the main development, then the other reported news (injuries, returns, team news, risks, predictions), then the matchup from the facts (table, form).

Rules (a checker rejects anything else):
- Every sentence cites the sources it uses (h1… press headlines, f1… facts).
- A sentence that uses a press headline names that outlet in the sentence ("…, Liverpool Echo reports", "according to Sports Mole"). Report, never confirm: what an outlet says is the outlet's report, not a fact.
- Use only what the headlines and facts say. Every number and every person you name must appear in a source the sentence cites. Do not add details, reasons, durations or quotes.
- No quotation marks. Cite at least two different outlets. Do not comment on the sources themselves (what a headline does or does not say); just report the news.
- Keep team names exactly as in the sources${lang === 'fi' ? ' and in the basic form, without case endings' : ''}. Keep only names (people, teams, outlets, named storms) as written; translate every ordinary word${lang === 'fi' ? ' into Finnish (Storm Boelo is "myrsky Boelo", not "Stormi Boelo")' : ''}.

Reply only with JSON: {"headline": "...", "paragraphs": [[{"text": "...", "sources": ["h1"]}, ...], ...]}.`
}

function brief(p: Prepared): string {
  const m = p.match
  return [
    `${p.competition.name}: ${m.home.shortName} v ${m.away.shortName}, kick-off ${m.start}.`,
    'Press headlines (published before kick-off):',
    ...p.sources.filter(s => s.kind === 'press').map(s => `${s.id} [${s.outlet}] ${s.text}`),
    'VOZ facts:',
    ...p.sources.filter(s => s.kind === 'fact').map(s => `${s.id} ${s.text}`),
  ].join('\n')
}

function parseDraft(output: Array<{ type?: string, [k: string]: unknown }>): RoundupDraft | null {
  const message = output.find(o => o.type === 'message') as { content?: Array<{ type: string, text?: string }> } | undefined
  const text = message?.content?.find(c => c.type === 'output_text')?.text ?? ''
  try {
    const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { headline?: unknown, paragraphs?: unknown }
    if (typeof j.headline !== 'string' || !Array.isArray(j.paragraphs)) return null
    const sentences = j.paragraphs.flatMap((para, pi) => (Array.isArray(para) ? para : []).map((s: { text?: unknown, sources?: unknown }) => ({
      text: typeof s?.text === 'string' ? s.text.trim() : '',
      sources: Array.isArray(s?.sources) ? s.sources.filter((x): x is string => typeof x === 'string') : [],
      paragraph: pi + 1,
    }))).filter(s => s.text)
    return { headline: j.headline.trim(), sentences }
  }
  catch {
    return null
  }
}

async function write(p: Prepared, lang: Lang): Promise<PressRoundup | null> {
  if (!llmConfig().key) return null
  const ctx = { sources: p.sources, names: p.names, lang }
  const input: ResponseItem[] = [{ role: 'user', content: brief(p) }]
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!underRateLimit()) return null
    const res = await respond({ instructions: instructions(lang), input, tools: [], max_output_tokens: 4000 })
    const draft = parseDraft(res.output as Array<{ type?: string }>)
    const check = draft ? checkRoundup(draft, ctx) : { passed: false, issues: ['The reply was not the JSON asked for.'] }
    if (draft && check.passed) {
      const used = new Set(draft.sentences.flatMap(s => s.sources))
      return {
        ...draft,
        matchKey: p.match.key,
        lang,
        sources: p.sources.filter(s => used.has(s.id)),
        model: llmConfig().model,
        generatedAt: new Date().toISOString(),
      }
    }
    console.info(`[roundup] ${p.match.key} ${lang} attempt ${attempt + 1} rejected: ${check.issues.slice(0, 3).join(' ')}`)
    input.push(...(res.output as ResponseItem[]), { role: 'user', content: `The checker rejected it. Fix these and reply with the full JSON again:\n- ${check.issues.join('\n- ')}` })
  }
  return null
}

/** From the cache only (free readers never start a model call). */
export async function cachedRoundup(p: Prepared): Promise<PressRoundup | null> {
  const mem = memory.get(p.key)
  if (mem) return mem
  const kv = await useStorage('kvcache').getItem<PressRoundup>(p.key).catch(() => null)
  if (kv) memory.set(p.key, kv)
  return kv
}

/** Cached, or written now (concurrent requests share one run); only checked roundups are cached. */
export async function pressRoundup(p: Prepared, lang: Lang): Promise<PressRoundup | null> {
  const hit = await cachedRoundup(p)
  if (hit) return hit
  let run = inFlight.get(p.key)
  if (!run) {
    run = write(p, lang)
      .then(async (r) => {
        if (r) {
          memory.set(p.key, r)
          await useStorage('kvcache').setItem(p.key, r, { ttl: TTL_SECONDS }).catch(err => console.warn(`[roundup] KV write failed: ${(err as Error).message}`))
        }
        return r
      })
      .catch((err) => {
        console.warn(`[roundup] ${(err as Error).message}`)
        return null
      })
      .finally(() => inFlight.delete(p.key))
    inFlight.set(p.key, run)
  }
  return run
}
