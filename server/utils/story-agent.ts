// Single-agent story writer with a harness.
//
// The agent (GPT-6 Luna by default) works only through three tools: get_facts (the verified fact
// ledger), check_story (the same checker the harness uses) and submit_story. The harness owns
// everything else: turn and time budgets, the final check, the trace, and a deterministic
// template fallback, so a failed or slow run can never publish an unchecked story.

import type { AgentStep, Fact, FactSection, MatchStory, StoryDraft, StoryLength, StoryTone } from '#shared/types/story'
import type { Lang } from '#shared/utils/format'
import type { FunctionTool, ResponseItem } from './llm'

const MAX_TURNS = 8
const TIME_BUDGET_MS = 90_000
const SECTIONS: FactSection[] = ['result', 'timeline', 'stats', 'form', 'table', 'h2h', 'context']

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'Headline, at most 14 words.' },
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          facts: { type: 'array', items: { type: 'string' }, description: 'Ids of the facts this sentence relies on, e.g. ["f3","f12"].' },
          paragraph: { type: 'integer', description: 'Paragraph number starting at 1.' },
        },
        required: ['text', 'facts', 'paragraph'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'sentences'],
  additionalProperties: false,
}

const TOOLS: FunctionTool[] = [
  {
    type: 'function',
    name: 'get_facts',
    description: 'Returns the verified facts about this match, each with an id (f1, f2, …). These are the only facts you may use.',
    parameters: {
      type: 'object',
      properties: { sections: { type: 'array', items: { type: 'string', enum: SECTIONS }, description: 'Fact sections to fetch; ask for all you need in one call.' } },
      required: ['sections'],
      additionalProperties: false,
    },
    strict: true,
  },
  { type: 'function', name: 'check_story', description: 'Checks a draft against the facts and lists every problem. Use it before submitting.', parameters: DRAFT_SCHEMA, strict: true },
  { type: 'function', name: 'submit_story', description: 'Publishes the story. It is checked again; if it fails you get the problems back and must fix them.', parameters: DRAFT_SCHEMA, strict: true },
]

const LENGTH_BRIEF: Record<StoryLength, string> = {
  short: 'Short: 30–60 words in 2–3 sentences, one paragraph. For a push alert or a card.',
  standard: 'Standard: 100–160 words in 5–8 sentences, 2 paragraphs.',
  long: 'Long read: 200–320 words in 9–15 sentences, 3–4 paragraphs, covering how the game unfolded, the numbers, form and the table.',
}

// Finnish words are longer (cases, compounds): the checker's Finnish ranges are about 20 % lower.
const LENGTH_BRIEF_FI: Record<StoryLength, string> = {
  short: 'Short: 25–50 words in 2–3 sentences, one paragraph. For a push alert or a card.',
  standard: 'Standard: 80–130 words in 5–8 sentences, 2 paragraphs.',
  long: 'Long read: 160–260 words in 9–15 sentences, 3–4 paragraphs, covering how the game unfolded, the numbers, form and the table.',
}

function toneBrief(tone: StoryTone, home: string, away: string): string {
  return {
    'neutral': 'Neutral match report for a general sports reader: balanced, clear, no cheering for either side.',
    'home-fan': `Written for ${home} supporters: warm and partisan towards ${home}, honest about what went wrong, never mocking ${away}.`,
    'away-fan': `Written for ${away} supporters: warm and partisan towards ${away}, honest about what went wrong, never mocking ${home}.`,
    'analyst': 'Analyst voice: what the numbers say (xG, shots, possession, chances, formations, form, table), measured and precise.',
  }[tone]
}

const instructions = (lang: Lang) => `You write sports match stories for VOZ, a Finnish sports media app. Accuracy matters more than style.

Process:
1. Call get_facts once with every section you need.
2. Write the story from those facts only.
3. Call check_story and fix every problem it reports.
4. Call submit_story with the final version.

Rules:
- Every sentence cites the ids of the facts it relies on. Each number and each person you mention must appear in the cited facts.
- Write every number as digits (2, not "two"). You may round a cited number (49.4% -> 49%) but never compute new numbers unless a fact states them.
- Use only facts from get_facts. Do not invent quotes, injuries, motives, crowd reactions, weather, or anything about earlier seasons.
- No quotation marks. Do not say anyone said, admitted or claimed anything.
- Tone may change word choice and emphasis, never the facts.
- ${lang === 'fi'
    ? 'Write in Finnish (the facts are in English; translate them, never their numbers or names). Team names exactly as given in the facts, in the basic form without case endings (write "HIFK voitti Kärpät", not "HIFK:n" or "Kärppien"). Natural Finnish sports journalism, not a word-for-word translation.'
    : 'English only. Team names as given in the facts.'}`

export interface StoryAgentInput {
  match: Match
  competitionName: string
  facts: Fact[]
  names: string[]
  length: StoryLength
  tone: StoryTone
  lang: Lang
}

/** Deterministic story from the facts themselves, used when the agent cannot produce a checked one. */
export function templateStory(input: StoryAgentInput): StoryDraft {
  const pick = (section: FactSection, n: number) => input.facts.filter(f => f.section === section).slice(0, n)
  const n = { short: 1, standard: 2, long: 3 }[input.length]
  const chosen = [...pick('result', n + 1), ...pick('timeline', n + 1), ...pick('stats', n), ...pick('table', n), ...pick('h2h', 1)]
  const m = input.match
  return {
    headline: `${m.home.shortName} ${m.home.score}–${m.away.score} ${m.away.shortName}`,
    sentences: chosen.map((f, i) => ({ text: f.text, facts: [f.id], paragraph: Math.floor(i / 4) + 1 })),
  }
}

export async function runStoryAgent(input: StoryAgentInput): Promise<MatchStory> {
  const started = Date.now()
  const { model } = llmConfig()
  const ctx = { facts: input.facts, names: input.names, length: input.length, lang: input.lang }
  const trace: AgentStep[] = []
  const usage = { inputTokens: 0, outputTokens: 0, turns: 0, ms: 0 }
  const { home, away } = input.match
  const brief = [
    `Match: ${input.competitionName}, ${home.name} ${home.score}–${away.score} ${away.name}.`,
    `Length: ${(input.lang === 'fi' ? LENGTH_BRIEF_FI : LENGTH_BRIEF)[input.length]}`,
    `Tone: ${toneBrief(input.tone, home.shortName, away.shortName)}`,
    `Fact sections available: ${SECTIONS.join(', ')}.`,
  ].join('\n')

  const items: ResponseItem[] = [{ role: 'user', content: brief }]
  let published: StoryDraft | null = null
  let lastIssues: string[] = []
  let failure: string | null = null

  const runTool = (name: string, args: Record<string, unknown>): { output: unknown, summary: string } => {
    if (name === 'get_facts') {
      const want = new Set((args.sections as FactSection[] | undefined)?.length ? args.sections as FactSection[] : SECTIONS)
      const facts = input.facts.filter(f => want.has(f.section)).map(f => ({ id: f.id, section: f.section, text: f.text }))
      return { output: { facts }, summary: `Read ${facts.length} facts (${[...want].join(', ')})` }
    }
    const draft = args as unknown as StoryDraft
    const check = checkStory(draft, ctx)
    lastIssues = check.issues
    if (name === 'check_story') {
      return { output: check, summary: check.passed ? `Draft checked: passed (${check.factsUsed} facts cited)` : `Draft checked: ${check.issues.length} problems` }
    }
    if (name === 'submit_story') {
      if (check.passed) published = draft
      return {
        output: check.passed ? { published: true } : { published: false, issues: check.issues },
        summary: check.passed ? `Submitted: passed the final check (${check.factsUsed} facts cited)` : `Submit rejected: ${check.issues.length} problems`,
      }
    }
    return { output: { error: `Unknown tool ${name}` }, summary: `Unknown tool ${name}` }
  }

  try {
    for (let turn = 1; turn <= MAX_TURNS && !published; turn++) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        failure = 'time budget used up'
        break
      }
      usage.turns = turn
      const t0 = Date.now()
      const res = await respond({ instructions: instructions(input.lang), input: items, tools: TOOLS, tool_choice: 'required', parallel_tool_calls: false, max_output_tokens: 6000 })
      usage.inputTokens += res.usage?.input_tokens ?? 0
      usage.outputTokens += res.usage?.output_tokens ?? 0
      // Reasoning and call items go back verbatim, as the Responses API requires.
      items.push(...res.output)
      type Call = { type: 'function_call', call_id: string, name: string, arguments: string }
      const calls = res.output.filter(o => (o as { type?: string }).type === 'function_call') as Call[]
      if (!calls.length) {
        items.push({ role: 'developer', content: 'Use the tools. Finish by calling submit_story.' })
        trace.push({ turn, tool: '(none)', summary: 'Answered without a tool call; reminded to use the tools', ms: Date.now() - t0 })
        continue
      }
      for (const call of calls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.arguments || '{}')
        }
        catch {
          items.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify({ error: 'Arguments were not valid JSON.' }) })
          continue
        }
        const { output, summary } = runTool(call.name, args)
        trace.push({ turn, tool: call.name, summary, ms: Date.now() - t0 })
        items.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output) })
      }
    }
    if (!published && !failure) failure = `no checked story after ${MAX_TURNS} turns${lastIssues.length ? ` (last problems: ${lastIssues.slice(0, 2).join(' ')})` : ''}`
  }
  catch (err) {
    failure = (err as Error).message
  }
  usage.ms = Date.now() - started

  const base = { matchKey: input.match.key, length: input.length, tone: input.tone, lang: input.lang, generatedAt: new Date().toISOString(), trace, usage }
  if (published) {
    return { ...base, ...(published as StoryDraft), origin: 'agent', model, check: checkStory(published, ctx), fallbackReason: null }
  }
  const fallback = templateStory(input)
  // The template is the facts themselves, which are English.
  return { ...base, lang: 'en', ...fallback, origin: 'template', model: null, check: checkStory(fallback, { ...ctx, length: 'long', lang: 'en' }), fallbackReason: failure }
}
