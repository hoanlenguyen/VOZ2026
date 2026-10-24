// Checks an AI press roundup before anyone sees it. Pure code (no Nuxt imports), tested in tests/.
// The roundup is written from other outlets' headlines and VOZ facts, so:
// - every sentence cites at least one source, and a sentence that uses a press headline names its
//   outlet (claims stay attributed, never stated as VOZ's own);
// - every number and every capitalised name in a sentence appears in the sources it cites (no
//   invented players, injuries or figures); the headline may only use names and numbers from the sources;
// - no quotations; at least two different outlets; a length range per language.

import type { RoundupDraft, RoundupSource } from '../types/roundup.ts'
import { numbersIn } from './story-check.ts'

export interface RoundupCheck { passed: boolean, issues: string[] }

export interface RoundupContext {
  sources: RoundupSource[]
  /** Team and competition names, always allowed. */
  names: string[]
  lang: 'en' | 'fi'
}

export const ROUNDUP_WORDS = { en: [80, 220], fi: [60, 180] } as const

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
// Capitalised words that are not names (sentence openers, days, months, common English words).
const COMMON = new Set(['the', 'a', 'an', 'and', 'but', 'with', 'after', 'before', 'ahead', 'both', 'their', 'his', 'her', 'its', 'meanwhile',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december', 'storm', 'voz', 'reports', 'according', 'in', 'on', 'at', 'for', 'as', 'it', 'there'])

function supported(n: string, pool: string[]): boolean {
  const decimals = n.includes('.') ? n.split('.')[1]!.length : 0
  return pool.some(f => Number(f) === Number(n) || Number(Number(f).toFixed(decimals)) === Number(n))
}

/** Capitalised words (candidate names); in sentences the sentence-opening word is skipped, in a headline every word counts. */
function namesIn(text: string, everyWord = false): string[] {
  return [...text.matchAll(/[\p{Lu}][\p{L}'’-]+/gu)]
    .filter((m) => {
      if (everyWord) return true
      const before = text.slice(0, m.index).trimEnd()
      return before !== '' && !/[.!?:]$/.test(before)
    })
    .map(m => m[0].replace(/['’]s$/, ''))
    .filter(w => !COMMON.has(fold(w)))
}

export function checkRoundup(draft: RoundupDraft, ctx: RoundupContext): RoundupCheck {
  const issues: string[] = []
  const byId = new Map(ctx.sources.map(s => [s.id, s]))
  const textOf = (s: RoundupSource) => `${s.text} ${s.outlet ?? ''}`
  const allText = fold(ctx.sources.map(textOf).join(' \n ') + ' ' + ctx.names.join(' '))
  const allNumbers = numbersIn(ctx.sources.map(s => s.text).join(' '))
  // Finnish inflects names ("Barcolan", "Szoboszlaille"): a name may carry a case ending of up to 4
  // letters after a stem of at least 4 letters that the sources contain.
  const allowed = (word: string, pool: string) => {
    const w = fold(word)
    if (pool.includes(w)) return true
    if (ctx.lang !== 'fi') return false
    for (let cut = 1; cut <= 4 && w.length - cut >= 4; cut++) if (pool.includes(w.slice(0, -cut))) return true
    return false
  }

  if (!draft.headline.trim()) issues.push('The headline is empty.')
  if (draft.headline.trim().split(/\s+/).length > 14) issues.push('The headline is longer than 14 words.')
  if (/["“”]/.test(draft.headline)) issues.push('The headline contains a quotation.')
  for (const n of numbersIn(draft.headline)) if (!supported(n, allNumbers)) issues.push(`The headline uses "${n}", which no source contains.`)
  // Headline: every capitalised word must be in the sources; its first word may instead be any word
  // the body uses (an ordinary word like "Myrsky" / "Storm"); the body's own names are checked below.
  const body = fold(draft.sentences.map(x => x.text).join(' '))
  namesIn(draft.headline, true).forEach((w, i) => {
    if (allowed(w, allText) || (i === 0 && draft.headline.trimStart().startsWith(w) && allowed(w, body))) return
    issues.push(`The headline names "${w}", which no source contains.`)
  })

  if (!draft.sentences.length) issues.push('The roundup has no sentences.')
  const outlets = new Set<string>()
  draft.sentences.forEach((s, i) => {
    const label = `Sentence ${i + 1}`
    const cited = s.sources.map(id => byId.get(id)).filter((x): x is RoundupSource => !!x)
    const unknown = s.sources.filter(id => !byId.has(id))
    if (unknown.length) issues.push(`${label} cites unknown sources: ${unknown.join(', ')}.`)
    if (!cited.length) {
      issues.push(`${label} cites no valid source; every sentence must cite at least one.`)
      return
    }
    const press = cited.filter(c => c.kind === 'press')
    press.forEach(c => outlets.add(c.outlet ?? ''))
    if (press.length && !press.some(c => c.outlet && fold(s.text).includes(fold(c.outlet)))) {
      issues.push(`${label} uses a press headline but does not name its outlet (${press.map(c => c.outlet).join(', ')}).`)
    }
    const pool = fold(cited.map(textOf).join(' \n ') + ' ' + ctx.names.join(' '))
    const numbers = numbersIn(cited.map(c => c.text).join(' '))
    for (const n of numbersIn(s.text)) if (!supported(n, numbers)) issues.push(`${label} uses "${n}", but its cited sources do not contain that number.`)
    for (const w of namesIn(s.text)) if (!allowed(w, pool)) issues.push(`${label} names "${w}", which its cited sources do not mention.`)
    if (/["“”]/.test(s.text)) issues.push(`${label} contains a quotation; quotes are not allowed.`)
  })
  if (outlets.size < 2) issues.push('The roundup must cite at least two different outlets.')

  const words = draft.sentences.reduce((n, s) => n + s.text.trim().split(/\s+/).length, 0)
  const [min, max] = ROUNDUP_WORDS[ctx.lang]
  if (draft.sentences.length && (words < min || words > max)) issues.push(`The roundup has ${words} words; it needs ${min}–${max}.`)
  return { passed: issues.length === 0, issues }
}
