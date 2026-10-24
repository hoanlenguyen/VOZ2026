// AI headline desk: writes a title and a subtitle for a match post (front-page card and match page)
// from the fact ledger plus the "edge" facts (each side's advantages, form, meetings this season).
//
// One model call per match and language (no tools: the facts are small enough to send), checked by
// checkHeadline(); one retry with the problems listed, then give up. Only checked headlines are
// returned and cached, so a failure always leaves the score/template title in place.
//
// Cache: memory -> kvcache (Workers KV in production) -> bundled data/headlines/ (pre-written by
// `npm run warm:stories`, re-checked against today's facts), shared by the landing page and the
// match page, so whatever is generated is reused everywhere. Key: prompt version, language, model,
// match and its state (final score, or a hash of the pre-match facts for upcoming games).

import type { H3Event } from 'h3'
import type { CompetitionDef } from '#shared/utils/competitions'
import type { MatchDetailExtras } from '#shared/types/match-detail'
import type { HeadlineDraft, MatchHeadline } from '#shared/types/headline'
import type { Fact } from '#shared/types/story'
import type { Lang } from '#shared/utils/format'
import type { ResponseItem } from './llm'

/** Bump after changing the instructions or the facts the writer gets: it invalidates cached headlines. */
const HEADLINE_PROMPT_VERSION = 'v2'
const TTL_FINISHED = 30 * 86_400
const TTL_UPCOMING = 2 * 86_400
const MAX_CALLS_PER_MINUTE = 30
const MEMORY_LIMIT = 2000

const memory = new Map<string, MatchHeadline>()
const inFlight = new Map<string, Promise<MatchHeadline | null>>()
const callTimes: number[] = []

export interface HeadlineInput {
  competition: CompetitionDef
  match: Match
  extras: MatchDetailExtras | null
  season: Match[]
}

interface Prepared extends HeadlineInput {
  key: string
  state: string
  lang: Lang
  facts: Fact[]
  names: string[]
  teams: string[]
}

/** FNV-1a, as in story-cache.ts. */
function hash(s: string): string {
  let h = 0x811C9DC5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

function prepare(input: HeadlineInput, lang: Lang): Prepared {
  const { competition: c, match: m, extras, season } = input
  const base = buildFacts(c, m, extras, season)
  const edge = buildEdgeFacts(c, m, season, base.length)
  const facts = [...base, ...edge].filter((f) => {
    // Upcoming games: of the result facts only the venue applies.
    if (m.status !== 'finished' && f.section === 'result') return f.text.startsWith('Venue')
    // buildFacts' form points are football's 3/1/0; for hockey the edge facts carry Liiga's points.
    return !(c.sport === 'hockey' && f.section === 'form')
  })
  // The final score keys a finished game (the landing list and the match page agree on it even when
  // one has more detail); an upcoming game is keyed by its pre-match facts, which change with form.
  const state = m.status === 'finished' ? `ft-${m.home.score}-${m.away.score}-${m.finishType ?? ''}` : `pre-${hash(edge.map(f => f.text).join('\n'))}`
  const key = `hl:${HEADLINE_PROMPT_VERSION}:${lang}:${llmConfig().model}:${c.id}:${m.id}:${state}`
  return { ...input, key, state, lang, facts, names: factNames(m, extras), teams: [m.home.shortName, m.away.shortName, m.home.name, m.away.name] }
}

function underRateLimit(): boolean {
  const now = Date.now()
  while (callTimes.length && now - callTimes[0]! > 60_000) callTimes.shift()
  if (callTimes.length >= MAX_CALLS_PER_MINUTE) return false
  callTimes.push(now)
  return true
}

const LANGUAGE: Record<Lang, string> = { en: 'English', fi: 'Finnish' }

function instructions(lang: Lang): string {
  return `You are the headline desk of VOZ, a Finnish sports news app. Write one title and one subtitle for a match post that make readers want to open it, using only the verified facts you are given.

What to look for (only when a fact states it):
- Finished match: the drama of the result first: a comeback, a late decisive goal, an upset against the table or the expected goals, a rout, revenge for an earlier meeting this season, a streak extended or ended.
- Upcoming match: the matchup: the table gap, form against form, attack against defence, home record against away record, how their earlier meetings this season went.
- The subtitle explains the title with each side's edge: one or two concrete numbers from the facts.

Style:
- ${LANGUAGE[lang]}. Lively sports-desk voice: strong verbs, present tense in the title, specific not generic. No clickbait, no questions, at most one exclamation mark, no capitals for emphasis.
- Title 4–12 words; subtitle 12–35 words, one or two sentences.
- Name teams exactly as written in the facts${lang === 'fi' ? ' and keep them in the basic form, without case endings (write "HIFK kaatoi Kärpät", not "HIFK:n" or "Kärppien")' : ''}.

Accuracy (a checker rejects anything else):
- Every number and every person you mention must appear in a fact you cite. Write numbers as digits${lang === 'fi' ? ', with a decimal comma (2,29, not 2.29)' : ''}. Never compute new numbers.
- No quotes, speech, injuries, emotions, crowd reactions, or anything about earlier seasons ("history", "record") unless a cited fact says it.
- Words like comeback, streak, unbeaten, upset, revenge, late winner, top of the table need a cited fact that states exactly that.

Reply only with JSON: {"headline": "...", "subtitle": "...", "facts": ["f1", ...]} where facts lists the ids of every fact you used.`
}

function brief(p: Prepared): string {
  const m = p.match
  const what = m.status === 'finished' ? `Finished: ${m.home.shortName} ${m.home.score}–${m.away.score} ${m.away.shortName}` : `Upcoming: ${m.home.shortName} v ${m.away.shortName}`
  return [`${p.competition.name}, ${p.competition.sport}. ${what}.`, 'Facts:', ...p.facts.map(f => `${f.id} [${f.section}] ${f.text}`)].join('\n')
}

function parseDraft(output: Array<{ type?: string, [k: string]: unknown }>): HeadlineDraft | null {
  const message = output.find(o => o.type === 'message') as { content?: Array<{ type: string, text?: string }> } | undefined
  const text = message?.content?.find(c => c.type === 'output_text')?.text ?? ''
  try {
    const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as Partial<HeadlineDraft>
    if (typeof j.headline !== 'string' || typeof j.subtitle !== 'string' || !Array.isArray(j.facts)) return null
    return { headline: j.headline.trim(), subtitle: j.subtitle.trim(), facts: j.facts.filter((x): x is string => typeof x === 'string') }
  }
  catch {
    return null
  }
}

async function write(p: Prepared, lang: Lang): Promise<MatchHeadline | null> {
  const ctx = { facts: p.facts, names: p.names, teams: p.teams, lang }
  const input: ResponseItem[] = [{ role: 'user', content: brief(p) }]
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!underRateLimit()) return null
    const res = await respond({ instructions: instructions(lang), input, tools: [], max_output_tokens: 3000 })
    const draft = parseDraft(res.output as Array<{ type?: string }>)
    const check = draft ? checkHeadline(draft, ctx) : { passed: false, issues: ['The reply was not the JSON asked for.'] }
    if (draft && check.passed) {
      const ids = new Set(draft.facts)
      return {
        matchKey: p.match.key,
        lang,
        state: p.state,
        headline: draft.headline,
        subtitle: draft.subtitle,
        evidence: p.facts.filter(f => ids.has(f.id)),
        model: llmConfig().model,
        generatedAt: new Date().toISOString(),
      }
    }
    console.info(`[headline] ${p.match.key} ${lang} attempt ${attempt + 1} rejected: ${check.issues.slice(0, 3).join(' ')}`)
    // Reasoning and message items go back verbatim, then the problems to fix.
    input.push(...res.output, { role: 'user', content: `The checker rejected it:\n- ${check.issues.join('\n- ')}\nFix every problem and reply with the JSON again.` })
  }
  return null
}

function remember(key: string, h: MatchHeadline) {
  if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value!)
  memory.set(key, h)
}

async function lookup(p: Prepared): Promise<MatchHeadline | null> {
  const mem = memory.get(p.key)
  if (mem) return mem
  const kv = await useStorage('kvcache').getItem<MatchHeadline>(p.key).catch(() => null)
  if (kv) {
    remember(p.key, kv)
    return kv
  }
  // Pre-written for the demo: only for the same match state and model (any model without a key),
  // and only while its cited facts still read the same and it passes the check.
  const bundled = await useStorage('assets:headlines').getItem<MatchHeadline>(`${p.competition.id}:${p.match.id}.${p.lang}.json`).catch(() => null)
  const { key, model } = llmConfig()
  if (!bundled || bundled.state !== p.state || (key && bundled.model !== model)) return null
  const byId = new Map(p.facts.map(f => [f.id, f.text]))
  const sameFacts = bundled.evidence.every(e => byId.get(e.id) === e.text)
  const draft = { headline: bundled.headline, subtitle: bundled.subtitle, facts: bundled.evidence.map(e => e.id) }
  if (!sameFacts || !checkHeadline(draft, { facts: p.facts, names: p.names, teams: p.teams, lang: p.lang }).passed) return null
  remember(p.key, bundled)
  return bundled
}

/** A cached headline, or null; never calls the model. */
export async function cachedHeadline(input: HeadlineInput, lang: Lang): Promise<MatchHeadline | null> {
  return lookup(prepare(input, lang))
}

/** The cached headline, or a new one written now (null without an API key or when the writer fails). */
export async function matchHeadline(input: HeadlineInput, lang: Lang, opts: { fresh?: boolean } = {}): Promise<{ headline: MatchHeadline | null, cached: boolean }> {
  const p = prepare(input, lang)
  if (!opts.fresh) {
    const hit = await lookup(p)
    if (hit) return { headline: hit, cached: true }
  }
  if (!llmConfig().key) return { headline: null, cached: false }
  let run = inFlight.get(p.key)
  if (!run) {
    run = write(p, lang)
      .then(async (h) => {
        if (h) {
          remember(p.key, h)
          const ttl = p.match.status === 'finished' ? TTL_FINISHED : TTL_UPCOMING
          await useStorage('kvcache').setItem(p.key, h, { ttl }).catch(err => console.warn(`[headline] KV write failed: ${(err as Error).message}`))
        }
        return h
      })
      .catch((err) => {
        console.warn(`[headline] ${p.match.key}: ${(err as Error).message}`)
        return null
      })
      .finally(() => inFlight.delete(p.key))
    inFlight.set(p.key, run)
  }
  return { headline: await run, cached: false }
}

/** Writes missing headlines in the background (first `limit`, `concurrency` at a time), for the landing page. */
export function warmHeadlines(event: H3Event, inputs: HeadlineInput[], lang: Lang, limit = 12, concurrency = 3): void {
  if (!llmConfig().key || !inputs.length) return
  const queue = inputs.slice(0, limit)
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) await matchHeadline(next, lang)
  }
  const job = Promise.all(Array.from({ length: concurrency }, worker)).then(() => undefined)
  // Workers keeps the isolate alive for it after the response; in Node it simply runs on.
  event.waitUntil?.(job)
}
