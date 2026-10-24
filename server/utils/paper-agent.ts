// AI match preview ("paper") for an upcoming match: a tool-using agent reads the News section's
// trusted-outlet articles and VOZ's pre-match facts, then writes a sourced analysis.
// Tools: list_articles (headlines and outlets), read_article (VOZ's own validated summary of one
// article from the News pipeline, never the publisher's text), get_facts, check_paper, submit_paper.
// checkPaper() (shared/utils/paper-check.ts) must pass: required sections, every sentence cited,
// articles attributed to their outlet, names and numbers in the cited sources, no quotes.
// Harness: 12 turns / 150 s; nothing is shown unless a checked paper was submitted.
// Cache: memory -> kvcache (6 h), keyed by match, language, model and the articles and facts.

import type { Lang } from '#shared/utils/format'
import type { CompetitionDef } from '#shared/utils/competitions'
import type { NewsItem } from '#shared/types/news-coverage'
import type { MatchPaper, PaperDraft, PaperSource, PaperStep } from '#shared/types/match-paper'
import type { FunctionTool, ResponseItem } from './llm'

const PROMPT_VERSION = 'p1'
const TTL_SECONDS = 6 * 3600
const MAX_ARTICLES = 8
const MAX_TURNS = 12
const TIME_BUDGET_MS = 150_000
const memory = new Map<string, MatchPaper>()
const inFlight = new Map<string, Promise<MatchPaper | null>>()
const LANGUAGE: Record<Lang, string> = { en: 'English', fi: 'Finnish' }

function hash(s: string): string {
  let h = 0x811C9DC5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export interface PaperInput {
  competition: CompetitionDef
  match: Match
  season: Match[]
  /** The News section's coverage of this match and both teams. */
  articles: NewsItem[]
}

interface Prepared extends PaperInput {
  key: string
  items: Array<{ id: string, item: NewsItem }>
  sources: PaperSource[]
  names: string[]
}

/** Articles published before kick-off (newest first, at most 8) and facts; null without 3 articles from 2 outlets. */
export function preparePaper(input: PaperInput, lang: Lang): Prepared | null {
  const seen = new Set<string>()
  const before = input.articles
    .filter(a => a.publishedAt < input.match.start && !seen.has(a.link) && seen.add(a.link))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_ARTICLES)
  if (before.length < 3 || new Set(before.map(a => a.source)).size < 2) return null
  const items = before.map((item, i) => ({ id: `a${i + 1}`, item }))
  const { facts, edge } = matchFacts(input.competition, input.match, null, input.season)
  const factList = [...facts.filter(f => f.section !== 'result'), ...edge.filter(e => !facts.some(f => f.id === e.id))]
  const sources: PaperSource[] = [
    ...items.map(({ id, item }) => ({ id, kind: 'article' as const, title: item.title, text: '', outlet: item.source, url: item.link, publishedAt: item.publishedAt })),
    ...factList.map(f => ({ id: f.id, kind: 'fact' as const, title: null, text: f.text, outlet: null, url: null, publishedAt: null })),
  ]
  const m = input.match
  const names = [m.home.name, m.home.shortName, m.away.name, m.away.shortName, input.competition.name]
  const key = `paper:${PROMPT_VERSION}:${lang}:${llmConfig().model}:${m.key}:${hash([...items.map(x => `${x.item.id}:${x.item.contentHash ?? ''}`), ...factList.map(f => f.text)].join('\n'))}`
  return { ...input, key, items, sources, names }
}

const SENTENCE = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    sources: { type: 'array', items: { type: 'string' }, description: 'Ids of the articles (a1…) and facts (f1…) this sentence relies on.' },
  },
  required: ['text', 'sources'],
  additionalProperties: false,
}
const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'Breaking-news headline, 6–12 words.' },
    standfirst: SENTENCE,
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['team-news', 'home', 'away', 'press', 'insight'] },
          sentences: { type: 'array', items: SENTENCE },
        },
        required: ['kind', 'sentences'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'standfirst', 'sections'],
  additionalProperties: false,
}
const TOOLS: FunctionTool[] = [
  { type: 'function', name: 'list_articles', description: 'Lists the trusted-outlet articles about this match and both teams (id, outlet, headline, time).', parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }, strict: true },
  {
    type: 'function',
    name: 'read_article',
    description: 'Returns VOZ\'s own summary of one article (what it reports: injuries, team news, form, predictions). Read every article that may matter; several calls in one turn are fine.',
    parameters: { type: 'object', properties: { id: { type: 'string', description: 'Article id, e.g. "a2".' } }, required: ['id'], additionalProperties: false },
    strict: true,
  },
  { type: 'function', name: 'get_facts', description: 'Returns VOZ\'s verified pre-match facts (table, form, goals, home and away records), each with an id (f1…).', parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }, strict: true },
  { type: 'function', name: 'check_paper', description: 'Checks a draft and lists every problem. Use it before submitting.', parameters: DRAFT_SCHEMA, strict: true },
  { type: 'function', name: 'submit_paper', description: 'Publishes the paper. It is checked again; if it fails you get the problems back and must fix them.', parameters: DRAFT_SCHEMA, strict: true },
]

function instructions(lang: Lang): string {
  return `You are VOZ's match analyst. Before a match, read what trusted outlets are reporting and write a match preview paper with real insight.

Work with the tools: list_articles, then read_article for every article that may matter (team news, injuries, form, predictions), get_facts, then write, check_paper, fix, submit_paper.

The paper, in ${LANGUAGE[lang]}:
- headline: breaking-news style, the most important development (an injury, a coach absence, a postponement risk, a decisive form line), 6–12 words, present tense, no outlet name, no questions or exclamation marks.
- standfirst: one sentence that sets up the match and the main story.
- sections (each 2–5 sentences):
  - team-news: injuries, doubts, returns and availability, as reported.
  - home: the home team's strengths and weaknesses going in (facts first, reports where they add).
  - away: the same for the away team.
  - press: what the outlets are saying: analysis, predictions, talking points (skip if nothing).
  - insight: what it all means: where the match will be decided, which absence or trend matters most, what to watch. Reason from the cited facts and reports; mark it as analysis ("That points to…", "The key may be…"), never as certainty.
- 250–550 words in all.

Rules (a checker rejects anything else):
- Every sentence cites its sources (article ids a1…, fact ids f1…).
- A sentence that uses an article names that outlet in the sentence ("…, The Guardian reports", "according to BBC Sport"). Reports stay reports: keep doubts, rumours and injury news unconfirmed.
- Every number and every person you name must appear in a source the sentence cites; use what you read, never your own background knowledge. No quotation marks.
- Cite articles from at least two outlets. Keep team names exactly as in the sources${lang === 'fi' ? ', in the basic form without case endings; translate ordinary words into Finnish' : ''}.`
}

/** Writes the paper; null when no checked paper was submitted in time. */
async function write(p: Prepared, lang: Lang): Promise<MatchPaper | null> {
  if (!llmConfig().key) return null
  const started = Date.now()
  const sources = p.sources.map(s => ({ ...s }))
  const byId = new Map(sources.map(s => [s.id, s]))
  const ctx = () => ({ sources, names: p.names, lang })
  const trace: PaperStep[] = []
  let read = 0
  let published: PaperDraft | null = null
  const m = p.match
  const items: ResponseItem[] = [{ role: 'user', content: `${p.competition.name}: ${m.home.shortName} (home) v ${m.away.shortName} (away), kick-off ${m.start}. Write the match preview paper.` }]

  const runTool = async (name: string, args: Record<string, unknown>): Promise<{ output: unknown, summary: string }> => {
    if (name === 'list_articles') {
      return { output: { articles: p.items.map(({ id, item }) => ({ id, outlet: item.source, headline: item.title, publishedAt: item.publishedAt })) }, summary: `Listed ${p.items.length} articles` }
    }
    if (name === 'read_article') {
      const found = p.items.find(x => x.id === args.id)
      if (!found) return { output: { error: `Unknown article ${String(args.id)}` }, summary: `Unknown article ${String(args.id)}` }
      try {
        const s = await summarizeRegisteredNews(found.item.id)
        const src = byId.get(found.id)!
        if (!src.text) read++
        src.text = s.summary
        return { output: { id: found.id, outlet: found.item.source, headline: found.item.title, summary: s.summary }, summary: `Read ${found.id} (${found.item.source})` }
      }
      catch (err) {
        return { output: { id: found.id, error: 'This article cannot be read right now; use only its headline.' }, summary: `Could not read ${found.id}: ${(err as Error).message}` }
      }
    }
    if (name === 'get_facts') {
      const facts = sources.filter(s => s.kind === 'fact').map(s => ({ id: s.id, text: s.text }))
      return { output: { facts }, summary: `Read ${facts.length} facts` }
    }
    const draft = args as unknown as PaperDraft
    const check = checkPaper(draft, ctx())
    if (name === 'check_paper') return { output: check, summary: check.passed ? 'Draft checked: passed' : `Draft checked: ${check.issues.length} problems` }
    if (name === 'submit_paper') {
      if (check.passed) published = draft
      return { output: check.passed ? { published: true } : { published: false, issues: check.issues }, summary: check.passed ? 'Submitted: passed the final check' : `Submit rejected: ${check.issues.length} problems` }
    }
    return { output: { error: `Unknown tool ${name}` }, summary: `Unknown tool ${name}` }
  }

  for (let turn = 1; turn <= MAX_TURNS && !published; turn++) {
    if (Date.now() - started > TIME_BUDGET_MS) break
    const t0 = Date.now()
    const res = await respond({ instructions: instructions(lang), input: items, tools: TOOLS, tool_choice: 'required', parallel_tool_calls: true, max_output_tokens: 8000 })
    // Reasoning and call items go back verbatim, as the Responses API requires.
    items.push(...res.output)
    type Call = { type: 'function_call', call_id: string, name: string, arguments: string }
    const calls = res.output.filter(o => (o as { type?: string }).type === 'function_call') as Call[]
    if (!calls.length) {
      items.push({ role: 'developer', content: 'Use the tools. Finish by calling submit_paper.' })
      continue
    }
    // Several articles can be read at once.
    const outputs = await Promise.all(calls.map(async (call) => {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.arguments || '{}')
      }
      catch {
        return { call, output: { error: 'Arguments were not valid JSON.' }, summary: 'Invalid arguments' }
      }
      return { call, ...(await runTool(call.name, args)) }
    }))
    for (const { call, output, summary } of outputs) {
      trace.push({ turn, tool: call.name, summary, ms: Date.now() - t0 })
      items.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output) })
    }
  }
  if (!published) {
    console.info(`[paper] ${p.match.key} ${lang}: no checked paper (${trace.at(-1)?.summary ?? 'no steps'})`)
    return null
  }
  const draft = published as PaperDraft
  const used = new Set([draft.standfirst, ...draft.sections.flatMap(s => s.sentences)].flatMap(s => s.sources))
  return {
    ...draft,
    matchKey: p.match.key,
    lang,
    sources: sources.filter(s => used.has(s.id)),
    articlesRead: read,
    model: llmConfig().model,
    generatedAt: new Date().toISOString(),
    trace,
  }
}

/** From the cache only (free readers never start the agent). */
export async function cachedPaper(p: Prepared): Promise<MatchPaper | null> {
  const mem = memory.get(p.key)
  if (mem) return mem
  const kv = await useStorage('kvcache').getItem<MatchPaper>(p.key).catch(() => null)
  if (kv) memory.set(p.key, kv)
  return kv
}

/** Cached, or written now (concurrent requests share one run); only checked papers are cached. */
export async function matchPaper(p: Prepared, lang: Lang): Promise<MatchPaper | null> {
  const hit = await cachedPaper(p)
  if (hit) return hit
  let run = inFlight.get(p.key)
  if (!run) {
    run = write(p, lang)
      .then(async (paper) => {
        if (paper) {
          memory.set(p.key, paper)
          await useStorage('kvcache').setItem(p.key, paper, { ttl: TTL_SECONDS }).catch(err => console.warn(`[paper] KV write failed: ${(err as Error).message}`))
        }
        return paper
      })
      .catch((err) => {
        console.warn(`[paper] ${(err as Error).message}`)
        return null
      })
      .finally(() => inFlight.delete(p.key))
    inFlight.set(p.key, run)
  }
  return run
}
