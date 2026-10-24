// Checks an AI-written title + subtitle against the facts it cites. Pure code (no Nuxt imports),
// tested under plain Node. Same rules as the story checker for numbers and people, plus headline
// rules: name a team as the data writes it, no clickbait, no claims the cited facts do not make.

import type { Fact, StoryCheck } from '../types/story.ts'
import type { HeadlineDraft } from '../types/headline.ts'
import { numbersIn } from './story-check.ts'

export interface HeadlineContext {
  facts: Fact[]
  /** People and places that must be backed by a cited fact when mentioned. */
  names: string[]
  /** Team names as the match writes them (short and full); at least one must appear unchanged. */
  teams: string[]
  lang: 'en' | 'fi'
}

type WordRange = [min: number, max: number]
export const HEADLINE_WORDS: WordRange = [3, 14]
export const SUBTITLE_WORDS: WordRange = [8, 40]

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const mentions = (text: string, form: string) => new RegExp(`(^|[^a-z])${escape(form)}([^a-z]|$)`).test(text)
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length


function supported(n: string, factNumbers: string[]): boolean {
  const decimals = n.includes('.') ? n.split('.')[1]!.length : 0
  const v = Number(n)
  return factNumbers.some(f => Number(f) === v || Number(Number(f).toFixed(decimals)) === v)
}

function nameForms(name: string): string[] {
  const parts = name.split(/\s+/)
  const forms = new Set([name])
  if (parts.length > 1 && parts.at(-1)!.length >= 4) forms.add(parts.at(-1)!)
  return [...forms].map(fold)
}

const BANNED: Array<[RegExp, string]> = [
  [/["“”„«»]/, 'contains a quotation; quotes are not allowed'],
  [/\b(said|says|told|according to|admitted|claimed|vows?|slams?)\b|\b(sanoi|kertoi|myönsi|totesi|lupaa)\b/i, 'attributes speech to someone; we have no quotes'],
  [/\binjur|loukkaan|loukkaa/i, 'mentions an injury; injuries are not in the facts'],
  [/you won'?t believe|\bshocking\b|\bthis is why\b|\bwhat happened next\b|et usko|järkyttäv/i, 'is clickbait'],
]

/** Claims that need a cited fact saying the same (matched against the English fact text). */
const CLAIMS: Array<{ re: RegExp, needs: RegExp | null, what: string }> = [
  { re: /\brecord|ennätys|ennätyk/i, needs: /\brecord\b/i, what: 'a record' },
  { re: /\bhistor|histori/i, needs: null, what: 'history; only this season is in our data' },
  { re: /\bunbeaten|\binvincible|tappioton|tappiottom|voittamaton/i, needs: /unbeaten/i, what: 'an unbeaten run' },
  { re: /\bstreak|\bin a row\b|\bstraight (wins|defeats|losses)|putki|peräkkäi/i, needs: /in a row|unbeaten/i, what: 'a streak' },
  { re: /\bfirst time|\bfirst ever|ensimmäistä kertaa|ensimmäinen kerta/i, needs: /\bfirst\b/i, what: 'a first' },
  { re: /\bcomeback|came from behind|from behind|nousu|kirivoitto|käänsi/i, needs: /came from behind/i, what: 'a comeback' },
  { re: /\bupset|\bgiant[- ]kill|yllätys/i, needs: /places below|more expected goals/i, what: 'an upset' },
  { re: /\brevenge|revanssi|kosto/i, needs: /lost the previous meeting/i, what: 'revenge' },
  { re: /\blate winner|\blate goal|\blast[- ]gasp|myöhäi|loppuhetk|viime hetk/i, needs: /decisive goal late/i, what: 'a late winner' },
  { re: /\btop of the table|\bleaders?\b|\bsummit|kärkipaikka|sarjakärki|kärjessä/i, needs: /\b1st\b/, what: 'the top of the table' },
  { re: /\bbottom of the table|\brock[- ]bottom|jumbo|viimeisenä/i, needs: /in the .* table/i, what: 'the bottom of the table' },
]

export function checkHeadline(draft: HeadlineDraft, ctx: HeadlineContext): StoryCheck {
  const issues: string[] = []
  const byId = new Map(ctx.facts.map(f => [f.id, f]))
  const known = [...new Set(draft.facts)].filter(id => byId.has(id))
  const unknown = draft.facts.filter(id => !byId.has(id))
  const headline = draft.headline.trim()
  const subtitle = draft.subtitle.trim()
  const both = `${headline}\n${subtitle}`

  if (!headline) issues.push('The headline is empty.')
  if (!subtitle) issues.push('The subtitle is empty.')
  const [hMin, hMax] = HEADLINE_WORDS
  const [sMin, sMax] = SUBTITLE_WORDS
  if (headline && (words(headline) < hMin || words(headline) > hMax)) issues.push(`The headline has ${words(headline)} words; it needs ${hMin}–${hMax}.`)
  if (subtitle && (words(subtitle) < sMin || words(subtitle) > sMax)) issues.push(`The subtitle has ${words(subtitle)} words; it needs ${sMin}–${sMax}.`)
  if (headline.endsWith('?')) issues.push('The headline is a question; state what happened instead.')
  if ((both.match(/!/g) ?? []).length > 1) issues.push('Use at most one exclamation mark.')
  if (/[A-ZÅÄÖ]{4,}\s+[A-ZÅÄÖ]{4,}/.test(both.replace(new RegExp(ctx.teams.map(escape).join('|') || '^$', 'g'), ''))) issues.push('Do not write words in capitals.')

  if (unknown.length) issues.push(`Unknown fact ids: ${unknown.join(', ')}.`)
  if (!known.length) issues.push('The headline cites no valid fact; cite every fact it relies on.')

  const citedText = known.map(id => byId.get(id)!.text).join(' \n ')
  const citedFolded = fold(citedText)
  const citedNumbers = numbersIn(citedText)
  for (const n of numbersIn(both)) {
    if (!supported(n, citedNumbers)) issues.push(`"${n}" is not in the cited facts (${known.join(', ') || 'none'}).`)
  }

  const text = fold(both)
  for (const name of ctx.names) {
    const forms = nameForms(name)
    if (forms.some(f => mentions(text, f)) && !forms.some(f => mentions(citedFolded, f))) {
      issues.push(`It names ${name}, but the cited facts do not mention them.`)
    }
  }
  if (!ctx.teams.some(t => both.toLowerCase().includes(t.toLowerCase()))) {
    issues.push(`Name at least one team exactly as written: ${[...new Set(ctx.teams)].join(', ')}.`)
  }

  for (const [re, why] of BANNED) if (re.test(both)) issues.push(`It ${why}.`)
  for (const c of CLAIMS) {
    if (c.re.test(both) && !(c.needs && c.needs.test(citedText))) {
      issues.push(`It claims ${c.what}, but no cited fact says so.`)
    }
  }
  return { passed: issues.length === 0, issues, factsUsed: known.length }
}
