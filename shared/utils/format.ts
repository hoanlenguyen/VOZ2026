import type { Match } from '../types/sports.ts'

/**
 * Display score in each sport's convention: hockey shootout wins count as one extra goal
 * ("4–3 SO"); football shows penalties separately ("1–1, 5–4 pens").
 */
export function formatScore(m: Pick<Match, 'sport' | 'home' | 'away' | 'shootout' | 'finishType'>): string {
  if (m.home.score === null || m.away.score === null) return '–'
  let home = m.home.score
  let away = m.away.score
  if (m.sport === 'hockey' && m.shootout) {
    if (m.shootout.winner === 'home') home++
    else away++
  }
  let text = `${home}–${away}`
  if (m.finishType === 'overtime') text += ' OT'
  if (m.finishType === 'shootout') text += ' SO'
  if (m.finishType === 'extra-time') text += ' AET'
  if (m.finishType === 'penalties' && m.shootout?.home != null && m.shootout.away != null) {
    text += `, ${m.shootout.home}–${m.shootout.away} pens`
  }
  return text
}
