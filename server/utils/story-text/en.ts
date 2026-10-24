// English story wording (the original templates).
import type { StoryPhrases } from './types'

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

// League names used without "the" in running text.
const NO_ARTICLE = new Set(['Liiga', 'LaLiga', 'Serie A', 'Ligue 1', 'Primeira Liga', 'Veikkausliiga'])
const inLeague = (league: string) => (NO_ARTICLE.has(league) ? league : `the ${league}`)
const list = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0])
const xg = (v: number) => Math.round(v * 100) / 100

export const en: StoryPhrases = {
  headline({ outcome, home, away, winner, loser, winnerScore }) {
    switch (outcome) {
      case 'draw': return `${home} and ${away} draw ${winnerScore}`
      case 'shootout': return `${winner} beat ${loser} in a shootout`
      case 'penalties': return `${winner} beat ${loser} on penalties`
      case 'overtime': return `${winner} edge ${loser} ${winnerScore} in overtime`
      case 'extra-time': return `${winner} beat ${loser} ${winnerScore} after extra time`
      case 'rout': return `${winner} thrash ${loser} ${winnerScore}`
      case 'win': return `${winner} beat ${loser} ${winnerScore}`
    }
  },
  comeback: (team, behind, sport) =>
    `${team} came back after trailing ${behind.for}–${behind.against} at the end of the first ${sport === 'hockey' ? 'period' : 'half'}.`,
  xg: (home, hx, away, ax) => `Expected goals: ${home} ${xg(hx)}, ${away} ${xg(ax)}.`,
  scorers: (team, scorers) => `${team} goals: ${list(scorers)}.`,
  table: (team, rank, league, points, played) =>
    `${team} are now ${ordinal(rank)} in ${inLeague(league)} with ${points} points from ${played} games.`,
  attendance: (n, venue) => `${n.toLocaleString('en-GB')} spectators${venue ? ` at ${venue}` : ''}.`,
  previewHeadline: (home, away) => `${home} host ${away} in a top-of-the-table meeting`,
  previewSummary(h, a, venue) {
    const gap = Math.abs(h.points - a.points)
    return `${h.name} (${ordinal(h.rank)}, ${h.points} pts) meet ${a.name} (${ordinal(a.rank)}, ${a.points} pts)`
      + `${gap === 0 ? ', level on points' : `, ${gap} point${gap === 1 ? '' : 's'} apart`}.`
      + `${venue ? ` Venue: ${venue}.` : ''}`
  },
}
