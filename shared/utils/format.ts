import type { Match } from '../types/sports.ts'

/** UI and story languages. */
export type Lang = 'en' | 'fi'
export const LANGS: Lang[] = ['en', 'fi']
/** Intl locale per language: dates, numbers. */
export const INTL_LOCALE: Record<Lang, string> = { en: 'en-GB', fi: 'fi-FI' }

// Score suffixes per language. Finnish: ja = jatkoaika (overtime / extra time), vl = voittolaukaus, rp. = rangaistuspotkut.
const SUFFIX: Record<Lang, { overtime: string, shootout: string, extraTime: string, pens: (h: number, a: number) => string }> = {
  en: { overtime: ' OT', shootout: ' SO', extraTime: ' AET', pens: (h, a) => `, ${h}–${a} pens` },
  fi: { overtime: ' ja', shootout: ' vl', extraTime: ' ja', pens: (h, a) => `, rp. ${h}–${a}` },
}

/**
 * Display score in each sport's convention: hockey shootout wins count as one extra goal
 * ("4–3 SO", fi "4–3 vl"); football shows penalties separately ("1–1, 5–4 pens", fi "1–1, rp. 5–4").
 */
export function formatScore(m: Pick<Match, 'sport' | 'home' | 'away' | 'shootout' | 'finishType'>, lang: Lang = 'en'): string {
  const score = displayScore(m)
  if (!score) return '–'
  const sfx = SUFFIX[lang]
  let text = `${score.home}–${score.away}`
  if (m.finishType === 'overtime') text += sfx.overtime
  if (m.finishType === 'shootout') text += sfx.shootout
  if (m.finishType === 'extra-time') text += sfx.extraTime
  if (m.finishType === 'penalties' && m.shootout?.home != null && m.shootout.away != null) {
    text += sfx.pens(m.shootout.home, m.shootout.away)
  }
  return text
}

/** The displayed goal numbers (hockey shootout winner +1), or null before the match has a score. */
export function displayScore(m: Pick<Match, 'sport' | 'home' | 'away' | 'shootout'>): { home: number, away: number } | null {
  if (m.home.score === null || m.away.score === null) return null
  let home = m.home.score
  let away = m.away.score
  if (m.sport === 'hockey' && m.shootout) {
    if (m.shootout.winner === 'home') home++
    else away++
  }
  return { home, away }
}

/** Keeps scores like "1–1" on one line: word joiners around a dash between digits (free text such as AI headlines). */
export function keepScoresTogether(text: string): string {
  return text.replace(/(\d)([–-])(\d)/g, '$1\u2060$2\u2060$3')
}
