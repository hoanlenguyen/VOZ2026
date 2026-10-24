// Checks an AI-written story against the fact ledger before anyone sees it. Pure code (no Nuxt
// imports) so tests run under plain Node. Every number and every person named in a sentence must
// appear in the facts that sentence cites; quotes, injury claims and attributed speech are refused.

import type { Fact, StoryCheck, StoryDraft, StoryLength } from '../types/story.ts'

export interface CheckContext {
  facts: Fact[]
  /** People and places that must be backed by a cited fact when mentioned (players, managers, referee, venue). */
  names: string[]
  length: StoryLength
}

/** Word-count range per length (body text, headline excluded). */
export const LENGTH_WORDS: Record<StoryLength, [number, number]> = {
  short: [20, 75],
  standard: [80, 190],
  long: [170, 360],
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const NUMBER_WORDS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
}

/** Numbers written in a text: digits ("2.29", "1–1", "45+2", "8th") and number words two–twenty. */
export function numbersIn(text: string): string[] {
  const out = [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map(m => m[0].replace(',', '.'))
  for (const w of fold(text).match(/[a-z]+/g) ?? []) {
    if (NUMBER_WORDS[w] !== undefined) out.push(String(NUMBER_WORDS[w]))
  }
  return out
}

/** A story number matches a fact number exactly or as a rounding of it (49.4 -> "49"). */
function supported(n: string, factNumbers: string[]): boolean {
  const decimals = n.includes('.') ? n.split('.')[1]!.length : 0
  const v = Number(n)
  return factNumbers.some((f) => {
    const fv = Number(f)
    return fv === v || Number(fv.toFixed(decimals)) === v
  })
}

/** Ways a person can be mentioned: full name, surname, or a distinctive single name. */
function nameForms(name: string): string[] {
  const parts = name.split(/\s+/)
  const forms = new Set([name])
  if (parts.length > 1 && parts.at(-1)!.length >= 4) forms.add(parts.at(-1)!)
  if (parts.length > 2 && parts[0]!.length >= 5) forms.add(parts[0]!)
  return [...forms].map(fold)
}

const mentions = (text: string, form: string) => new RegExp(`(^|[^a-z])${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(text)

const BANNED: Array<[RegExp, string, 'quote' | 'speech' | 'injury']> = [
  [/["“”]/, 'contains a quotation; quotes are not allowed', 'quote'],
  [/\b(said|says|told|according to|admitted|claimed)\b/i, 'attributes speech to someone; we have no quotes', 'speech'],
  [/\binjur/i, 'mentions an injury; injuries are not in the facts', 'injury'],
]

export function checkStory(draft: StoryDraft, ctx: CheckContext): StoryCheck {
  const issues: string[] = []
  const byId = new Map(ctx.facts.map(f => [f.id, f]))
  const allFactText = fold(ctx.facts.map(f => f.text).join(' \n '))
  const allNumbers = numbersIn(ctx.facts.map(f => f.text).join(' '))
  const people = ctx.names.map(n => ({ name: n, forms: nameForms(n) }))
  const cited = new Set<string>()

  if (!draft.headline.trim()) issues.push('The headline is empty.')
  if (draft.headline.split(/\s+/).length > 14) issues.push('The headline is longer than 14 words.')
  for (const n of numbersIn(draft.headline)) {
    if (!supported(n, allNumbers)) issues.push(`The headline uses "${n}", which no fact contains.`)
  }
  for (const p of people) {
    const h = fold(draft.headline)
    if (p.forms.some(f => mentions(h, f)) && !p.forms.some(f => mentions(allFactText, f))) {
      issues.push(`The headline names ${p.name}, who is not in the facts.`)
    }
  }

  if (!draft.sentences.length) issues.push('The story has no sentences.')
  draft.sentences.forEach((s, i) => {
    const label = `Sentence ${i + 1}`
    const known = s.facts.filter(id => byId.has(id))
    const unknown = s.facts.filter(id => !byId.has(id))
    if (unknown.length) issues.push(`${label} cites unknown fact ids: ${unknown.join(', ')}.`)
    if (!known.length) {
      issues.push(`${label} cites no valid fact; every sentence must cite at least one.`)
      return
    }
    known.forEach(id => cited.add(id))
    const citedText = known.map(id => byId.get(id)!.text).join(' \n ')
    const citedFolded = fold(citedText)
    const citedNumbers = numbersIn(citedText)

    for (const n of numbersIn(s.text)) {
      if (!supported(n, citedNumbers)) issues.push(`${label} uses "${n}", but its cited facts (${known.join(', ')}) do not contain that number.`)
    }
    const text = fold(s.text)
    for (const p of people) {
      if (p.forms.some(f => mentions(text, f)) && !p.forms.some(f => mentions(citedFolded, f))) {
        issues.push(`${label} names ${p.name}, but its cited facts (${known.join(', ')}) do not mention them.`)
      }
    }
    for (const [re, why] of BANNED) {
      if (re.test(s.text)) issues.push(`${label} ${why}.`)
    }
  })

  const words = draft.sentences.reduce((n, s) => n + s.text.trim().split(/\s+/).length, 0)
  const [min, max] = LENGTH_WORDS[ctx.length]
  if (draft.sentences.length && (words < min || words > max)) {
    issues.push(`The story has ${words} words; the ${ctx.length} length needs ${min}–${max}.`)
  }
  return { passed: issues.length === 0, issues, factsUsed: cited.size }
}

/** One problem in a newsroom edit; `sentence` 0 is the headline, then 1, 2, ... */
export interface EditIssue {
  kind: 'number' | 'name' | 'quote' | 'speech' | 'injury'
  sentence: number
  /** The number or person concerned (number / name issues). */
  value?: string
}

export interface EditCheck {
  issues: EditIssue[]
  /** Facts the text appears to use: they share a person, or a number of two or more characters. */
  factIds: string[]
}

/** Splits plain text into sentences (for edit checks and their messages). */
export function sentencesOf(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
}

/**
 * Checks text a newsroom editor wrote in place of the AI story. It cites no facts, so every number
 * and every person named must appear somewhere in the match facts; quotes, speech and injuries are
 * flagged as in checkStory. Advisory: the editor sees the issues while writing.
 */
export function checkEdit(headline: string, sentences: string[], ctx: Pick<CheckContext, 'facts' | 'names'>): EditCheck {
  const issues: EditIssue[] = []
  const allNumbers = numbersIn(ctx.facts.map(f => f.text).join(' '))
  const allFactText = fold(ctx.facts.map(f => f.text).join(' \n '))
  const people = ctx.names.map(n => ({ name: n, forms: nameForms(n) }))
  const usedNumbers = new Set<string>()
  const usedPeople = new Set<string>()

  ;[headline, ...sentences].forEach((text, sentence) => {
    for (const n of new Set(numbersIn(text))) {
      if (supported(n, allNumbers)) usedNumbers.add(n)
      else issues.push({ kind: 'number', sentence, value: n })
    }
    const folded = fold(text)
    for (const p of people) {
      if (!p.forms.some(f => mentions(folded, f))) continue
      if (p.forms.some(f => mentions(allFactText, f))) usedPeople.add(p.name)
      else issues.push({ kind: 'name', sentence, value: p.name })
    }
    for (const [re, , kind] of BANNED) {
      if (re.test(text)) issues.push({ kind, sentence })
    }
  })

  const distinctive = [...usedNumbers].filter(n => n.length >= 2)
  const factIds = ctx.facts.filter((f) => {
    const text = fold(f.text)
    return [...usedPeople].some(name => nameForms(name).some(form => mentions(text, form)))
      || distinctive.some(n => numbersIn(f.text).some(x => Number(x) === Number(n)))
  }).map(f => f.id)
  return { issues, factIds }
}
