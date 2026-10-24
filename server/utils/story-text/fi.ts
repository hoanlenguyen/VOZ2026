// Finnish story wording. Team and league names stay in the basic form (no case endings): headlines
// use "Voittaja voittoon: Koti–Vieras 3–2" and labels like "Maalit (HIFK):", so any name reads right.
import type { StoryPhrases } from './types'

const list = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ja ${parts.at(-1)}` : parts[0])
const num = (v: number, decimals = 0) => v.toLocaleString('fi-FI', { maximumFractionDigits: decimals })
const points = (n: number) => `${n} ${n === 1 ? 'piste' : 'pistettä'}`

export const fi: StoryPhrases = {
  headline({ outcome, home, away, winner, score }) {
    const pair = `${home}–${away} ${score}`
    switch (outcome) {
      case 'draw': return `Tasapeli: ${pair}`
      case 'shootout': return `${winner} voittoon voittolaukauksin: ${pair}`
      case 'penalties': return `${winner} voittoon rangaistuspotkuilla: ${pair}`
      case 'overtime': return `${winner} voittoon jatkoajalla: ${pair}`
      case 'extra-time': return `${winner} voittoon jatkoajalla: ${pair}`
      case 'rout': return `${winner} jyräsi: ${pair}`
      case 'win': return `${winner} voittoon: ${pair}`
    }
  },
  comeback: (team, behind, sport) =>
    `${team} nousi voittoon ${behind.for}–${behind.against}-tappioasemasta ${sport === 'hockey' ? 'avauserän' : 'avauspuoliajan'} jälkeen.`,
  xg: (home, hx, away, ax) => `Maaliodottamat: ${home} ${num(hx, 2)} ja ${away} ${num(ax, 2)}.`,
  scorers: (team, scorers) => `Maalit (${team}): ${list(scorers)}.`,
  table: (team, rank, league, pts, played) =>
    `${league}: ${team} on nyt ${rank}. sijalla, ${points(pts)} ${played} ottelusta.`,
  attendance: (n, venue) => `Katsojia ${num(n)}${venue ? `, ${venue}` : ''}.`,
  previewHeadline: (home, away) => `Kärkikamppailu: ${home}–${away}`,
  previewSummary(h, a, venue) {
    const gap = Math.abs(h.points - a.points)
    return `${h.name} (${h.rank}., ${points(h.points)}) ja ${a.name} (${a.rank}., ${points(a.points)}) kohtaavat`
      + `${gap === 0 ? ' tasapisteissä' : `, ero ${points(gap)}`}.`
      + `${venue ? ` Paikka: ${venue}.` : ''}`
  },
}
