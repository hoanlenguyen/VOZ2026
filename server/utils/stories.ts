// Deterministic story templates: every phrase maps to a field in Match / StandingRow, so a
// story can never state something the data does not contain. (AI-written stories come in Phase 1
// and are validated against the same facts.)

import type { CompetitionDef } from '#shared/utils/competitions'
import type { Story } from '#shared/types/stories'

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

// League names used without "the" in running text.
const NO_ARTICLE = new Set(['Liiga', 'LaLiga', 'Serie A', 'Ligue 1', 'Primeira Liga', 'Veikkausliiga'])
const inLeague = (c: CompetitionDef) => (NO_ARTICLE.has(c.name) ? c.name : `the ${c.name}`)

/** Score from the winner's point of view ("3–0", "4–3"), as headlines name the winner first. */
function winnerScore(m: Match, side: 'home' | 'away' | null): string {
  const [h, a] = formatScore(m).split(/,? /)[0]!.split('–')
  return side === 'away' ? `${a}–${h}` : `${h}–${a}`
}

function tableLine(c: CompetitionDef, team: MatchTeam, table: Map<string, StandingRow>): string {
  const row = table.get(team.key)
  if (!row) return ''
  return `${team.shortName} are now ${ordinal(row.rank)} in ${inLeague(c)} with ${row.points} points from ${row.played} games.`
}

function scorersLine(m: Match, side: 'home' | 'away'): string {
  const team = side === 'home' ? m.home : m.away
  const names = m.goals.filter(g => g.side === side && !g.tags.includes('own-goal')).map(g => g.scorer.name)
  if (!names.length) return ''
  const counts = new Map<string, number>()
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  const parts = [...counts].map(([n, k]) => (k > 1 ? `${n} (${k})` : n))
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]
  return `${team.shortName} goals: ${list}.`
}

function resultStory(c: CompetitionDef, m: Match, table: Map<string, StandingRow>): Story | null {
  const hs = m.home.score
  const as = m.away.score
  if (hs === null || as === null) return null

  const sideWon = m.shootout ? m.shootout.winner : hs > as ? 'home' : as > hs ? 'away' : null
  const winner = sideWon === 'home' ? m.home : sideWon === 'away' ? m.away : null
  const loser = sideWon === 'home' ? m.away : sideWon === 'away' ? m.home : null
  const score = winnerScore(m, sideWon)
  const margin = Math.abs(hs - as)
  const rout = m.sport === 'hockey' ? 4 : 3

  let headline: string
  if (!winner || !loser) headline = `${m.home.shortName} and ${m.away.shortName} draw ${score}`
  else if (m.finishType === 'shootout') headline = `${winner.shortName} beat ${loser.shortName} in a shootout`
  else if (m.finishType === 'penalties') headline = `${winner.shortName} beat ${loser.shortName} on penalties`
  else if (m.finishType === 'overtime') headline = `${winner.shortName} edge ${loser.shortName} ${score} in overtime`
  else if (m.finishType === 'extra-time') headline = `${winner.shortName} beat ${loser.shortName} ${score} after extra time`
  else if (margin >= rout) headline = `${winner.shortName} thrash ${loser.shortName} ${score}`
  else headline = `${winner.shortName} beat ${loser.shortName} ${score}`

  const lines: string[] = []
  // Comeback: the side trailing after the first period/half won the match.
  const first = m.periods[0]
  if (winner && first && first.home !== first.away) {
    const ledFirst = first.home > first.away ? 'home' : 'away'
    if (ledFirst !== sideWon) {
      const [w, l] = sideWon === 'home' ? [first.home, first.away] : [first.away, first.home]
      lines.push(`${winner.shortName} came back after trailing ${w}–${l} at the end of the first ${m.sport === 'hockey' ? 'period' : 'half'}.`)
    }
  }
  if (m.home.stats.xg != null && m.away.stats.xg != null) {
    const xg = (v: number) => Math.round(v * 100) / 100
    lines.push(`Expected goals: ${m.home.shortName} ${xg(m.home.stats.xg)}, ${m.away.shortName} ${xg(m.away.stats.xg)}.`)
  }
  if (winner) lines.push(scorersLine(m, sideWon!))
  else lines.push(scorersLine(m, 'home'), scorersLine(m, 'away'))
  if (winner) lines.push(tableLine(c, winner, table))
  if (m.attendance) lines.push(`${m.attendance.toLocaleString('en-GB')} spectators${m.venue ? ` at ${m.venue}` : ''}.`)

  const ageHours = (Date.now() - Date.parse(m.start)) / 3_600_000
  return {
    id: `r-${m.key}`,
    kind: 'result',
    sport: m.sport,
    competitionId: c.id,
    competitionName: c.name,
    headline,
    summary: lines.filter(Boolean).join(' '),
    time: m.start,
    href: `/match/${c.id}/${m.id}`,
    match: m,
    weight: 100 - ageHours + (c.provider === 'liiga' ? 12 : 0) + Math.min(margin, 4) * 2 + (m.finishType && m.finishType !== 'regulation' ? 4 : 0),
  }
}

function previewStory(c: CompetitionDef, m: Match, table: Map<string, StandingRow>): Story | null {
  const h = table.get(m.home.key)
  const a = table.get(m.away.key)
  if (!h || !a) return null
  const top = Math.ceil(table.size / 3)
  if (h.rank > top || a.rank > top) return null

  const gap = Math.abs(h.points - a.points)
  const headline = `${m.home.shortName} host ${m.away.shortName} in a top-of-the-table meeting`
  const summary = `${m.home.shortName} (${ordinal(h.rank)}, ${h.points} pts) meet ${m.away.shortName} (${ordinal(a.rank)}, ${a.points} pts)`
    + `${gap === 0 ? ', level on points' : `, ${gap} point${gap === 1 ? '' : 's'} apart`}.`
    + `${m.venue ? ` Venue: ${m.venue}.` : ''}`
  const hoursAway = (Date.parse(m.start) - Date.now()) / 3_600_000
  return {
    id: `p-${m.key}`,
    kind: 'preview',
    sport: m.sport,
    competitionId: c.id,
    competitionName: c.name,
    headline,
    summary,
    time: m.start,
    href: `/match/${c.id}/${m.id}`,
    match: m,
    weight: 90 - hoursAway + (c.provider === 'liiga' ? 12 : 0) - Math.max(h.rank, a.rank),
  }
}

/** Results from the last `days` days and top-table previews for the next 3 days. */
export function buildStories(c: CompetitionDef, matches: Match[], standings: StandingRow[], days = 4): Story[] {
  const table = new Map(standings.map(r => [r.teamKey, r]))
  const now = Date.now()
  const stories: Story[] = []
  for (const m of matches) {
    const t = Date.parse(m.start)
    if (m.status === 'finished' && now - t < days * 86_400_000) {
      const s = resultStory(c, m, table)
      if (s) stories.push(s)
    }
    else if (m.status === 'scheduled' && t > now && t - now < 3 * 86_400_000) {
      const s = previewStory(c, m, table)
      if (s) stories.push(s)
    }
  }
  return stories
}
