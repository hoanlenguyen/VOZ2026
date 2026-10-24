// Checks an AI match preview ("paper") before anyone sees it. Pure code (no Nuxt imports), tested.
// - The required sections are there: team news, both teams' strengths and weaknesses, insights.
// - Every sentence (standfirst included) cites at least one source; a sentence that uses an article
//   names its outlet (reports stay the outlet's, never VOZ's own claims).
// - Every number and every capitalised name in a sentence appears in the sources it cites (no invented
//   players, injuries or figures); Finnish names may carry a case ending.
// - No quotations; at least two outlets cited; a length range per language.

import type { PaperDraft, PaperSectionKind, PaperSource } from '../types/match-paper.ts'
import { numbersIn } from './story-check.ts'

export interface PaperCheck { passed: boolean, issues: string[] }
export interface PaperContext { sources: PaperSource[], names: string[], lang: 'en' | 'fi' }

export const PAPER_WORDS = { en: [200, 650], fi: [150, 520] } as const
export const REQUIRED_SECTIONS: PaperSectionKind[] = ['team-news', 'home', 'away', 'insight']

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
// Capitalised words that are not names (sentence parts, days, months, common words).
const COMMON = new Set(['the', 'a', 'an', 'and', 'but', 'with', 'after', 'before', 'ahead', 'both', 'their', 'his', 'her', 'its', 'meanwhile',
  'however', 'still', 'that', 'this', 'these', 'those', 'if', 'when', 'while', 'without', 'despite', 'given', 'yet', 'so', 'expect', 'watch',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december', 'storm', 'voz', 'reports', 'according', 'in', 'on', 'at', 'for', 'as', 'it', 'there'])

function supported(n: string, pool: string[]): boolean {
  const decimals = n.includes('.') ? n.split('.')[1]!.length : 0
  return pool.some(f => Number(f) === Number(n) || Number(Number(f).toFixed(decimals)) === Number(n))
}

/** Capitalised words; in sentences the sentence-opening word is skipped, in a headline every word counts. */
function namesIn(text: string, everyWord = false): string[] {
  return [...text.matchAll(/[\p{Lu}][\p{L}'’-]+/gu)]
    .filter((m) => {
      if (everyWord) return true
      const before = text.slice(0, m.index).trimEnd()
      return before !== '' && !/[.!?:;]$/.test(before)
    })
    .map(m => m[0].replace(/['’]s$/, ''))
    .filter(w => !COMMON.has(fold(w)))
}

export function checkPaper(draft: PaperDraft, ctx: PaperContext): PaperCheck {
  const issues: string[] = []
  const byId = new Map(ctx.sources.map(s => [s.id, s]))
  const textOf = (s: PaperSource) => `${s.title ?? ''} ${s.text} ${s.outlet ?? ''}`
  const allText = fold(ctx.sources.map(textOf).join(' \n ') + ' ' + ctx.names.join(' '))
  const allNumbers = numbersIn(ctx.sources.map(s => `${s.title ?? ''} ${s.text}`).join(' '))
  // Finnish inflects names ("Kompanyn", "Bayernille"): a stem of at least 4 letters plus up to 4 more.
  const allowed = (word: string, pool: string) => {
    const w = fold(word)
    if (pool.includes(w)) return true
    if (ctx.lang !== 'fi') return false
    for (let cut = 1; cut <= 4 && w.length - cut >= 4; cut++) if (pool.includes(w.slice(0, -cut))) return true
    return false
  }

  const sentences = [
    { label: 'The standfirst', s: draft.standfirst },
    ...draft.sections.flatMap(sec => sec.sentences.map((s, i) => ({ label: `${sec.kind} sentence ${i + 1}`, s }))),
  ]
  const body = fold(sentences.map(x => x.s?.text ?? '').join(' '))

  if (!draft.headline?.trim()) issues.push('The headline is empty.')
  else {
    if (draft.headline.trim().split(/\s+/).length > 14) issues.push('The headline is longer than 14 words.')
    if (/["“”]/.test(draft.headline)) issues.push('The headline contains a quotation.')
    for (const n of numbersIn(draft.headline)) if (!supported(n, allNumbers)) issues.push(`The headline uses "${n}", which no source contains.`)
    // Its first word may instead be any word the body uses (an ordinary word); the body's names are checked below.
    namesIn(draft.headline, true).forEach((w, i) => {
      if (allowed(w, allText) || (i === 0 && draft.headline.trimStart().startsWith(w) && allowed(w, body))) return
      issues.push(`The headline names "${w}", which no source contains.`)
    })
  }

  for (const kind of REQUIRED_SECTIONS) {
    if (!draft.sections.some(sec => sec.kind === kind && sec.sentences.length)) issues.push(`The section "${kind}" is missing or empty.`)
  }

  const outlets = new Set<string>()
  for (const { label, s } of sentences) {
    if (!s?.text?.trim()) {
      issues.push(`${label} is empty.`)
      continue
    }
    const cited = (s.sources ?? []).map(id => byId.get(id)).filter((x): x is PaperSource => !!x)
    const unknown = (s.sources ?? []).filter(id => !byId.has(id))
    if (unknown.length) issues.push(`${label} cites unknown sources: ${unknown.join(', ')}.`)
    if (!cited.length) {
      issues.push(`${label} cites no valid source; every sentence must cite at least one.`)
      continue
    }
    const articles = cited.filter(c => c.kind === 'article')
    articles.forEach(c => outlets.add(c.outlet ?? ''))
    if (articles.length && !articles.some(c => c.outlet && fold(s.text).includes(fold(c.outlet)))) {
      issues.push(`${label} uses an article but does not name its outlet (${articles.map(c => c.outlet).join(', ')}).`)
    }
    const pool = fold(cited.map(textOf).join(' \n ') + ' ' + ctx.names.join(' '))
    const numbers = numbersIn(cited.map(c => `${c.title ?? ''} ${c.text}`).join(' '))
    for (const n of numbersIn(s.text)) if (!supported(n, numbers)) issues.push(`${label} uses "${n}", but its cited sources do not contain that number.`)
    for (const w of namesIn(s.text)) if (!allowed(w, pool)) issues.push(`${label} names "${w}", which its cited sources do not mention.`)
    if (/["“”]/.test(s.text)) issues.push(`${label} contains a quotation; quotes are not allowed.`)
  }
  if (outlets.size < 2) issues.push('The paper must cite articles from at least two different outlets.')

  const words = sentences.reduce((n, x) => n + (x.s?.text?.trim().split(/\s+/).length ?? 0), 0)
  const [min, max] = PAPER_WORDS[ctx.lang]
  if (words < min || words > max) issues.push(`The paper has ${words} words; it needs ${min}–${max}.`)
  return { passed: issues.length === 0, issues }
}
