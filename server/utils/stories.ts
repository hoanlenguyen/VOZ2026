// Deterministic story templates: every phrase maps to a field in Match / StandingRow, so a
// story can never state something the data does not contain. This file picks the facts; the
// wording per language lives in ./story-text (en, fi), so both languages state the same facts. (AI-written stories come in Phase 1
// and are validated against the same facts.)

import type { CompetitionDef } from '#shared/utils/competitions'
import type { Story } from '#shared/types/stories'
import type { Lang } from '#shared/utils/format'
import type { Outcome, StoryPhrases } from './story-text/types'
import { en } from './story-text/en'
import { fi } from './story-text/fi'

const PHRASES: Record<Lang, StoryPhrases> = { en, fi }

/** Score from the winner's point of view ("3–0", "4–3"), as English headlines name the winner first. */
function winnerScore(m: Match, side: 'home' | 'away' | null): string {
  const s = displayScore(m)!
  return side === 'away' ? `${s.away}–${s.home}` : `${s.home}–${s.away}`
}

function tableLine(p: StoryPhrases, league: string, team: MatchTeam, table: Map<string, StandingRow>): string {
  const row = table.get(team.key)
  if (!row) return ''
  return p.table(team.shortName, row.rank, league, row.points, row.played)
}

function scorersLine(p: StoryPhrases, m: Match, side: 'home' | 'away'): string {
  const team = side === 'home' ? m.home : m.away
  const names = m.goals.filter(g => g.side === side && !g.tags.includes('own-goal')).map(g => g.scorer.name)
  if (!names.length) return ''
  const counts = new Map<string, number>()
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  return p.scorers(team.shortName, [...counts].map(([n, k]) => (k > 1 ? `${n} (${k})` : n)))
}

function resultStory(c: CompetitionDef, m: Match, table: Map<string, StandingRow>, lang: Lang): Story | null {
  const p = PHRASES[lang]
  const league = competitionName(c, lang)
  const hs = m.home.score
  const as = m.away.score
  if (hs === null || as === null) return null

  const sideWon = m.shootout ? m.shootout.winner : hs > as ? 'home' : as > hs ? 'away' : null
  const winner = sideWon === 'home' ? m.home : sideWon === 'away' ? m.away : null
  const loser = sideWon === 'home' ? m.away : sideWon === 'away' ? m.home : null
  const score = winnerScore(m, sideWon)
  const margin = Math.abs(hs - as)
  const rout = m.sport === 'hockey' ? 4 : 3

  let outcome: Outcome
  if (!winner || !loser) outcome = 'draw'
  else if (m.finishType === 'shootout') outcome = 'shootout'
  else if (m.finishType === 'penalties') outcome = 'penalties'
  else if (m.finishType === 'overtime') outcome = 'overtime'
  else if (m.finishType === 'extra-time') outcome = 'extra-time'
  else if (margin >= rout) outcome = 'rout'
  else outcome = 'win'
  const headline = p.headline({
    outcome,
    home: m.home.shortName,
    away: m.away.shortName,
    winner: winner?.shortName ?? '',
    loser: loser?.shortName ?? '',
    winnerScore: score,
    score: formatScore(m, lang),
  })

  const lines: string[] = []
  // Comeback: the side trailing after the first period/half won the match.
  const first = m.periods[0]
  if (winner && first && first.home !== first.away) {
    const ledFirst = first.home > first.away ? 'home' : 'away'
    if (ledFirst !== sideWon) {
      const [w, l] = sideWon === 'home' ? [first.home, first.away] : [first.away, first.home]
      lines.push(p.comeback(winner.shortName, { for: w, against: l }, m.sport))
    }
  }
  if (m.home.stats.xg != null && m.away.stats.xg != null) {
    lines.push(p.xg(m.home.shortName, m.home.stats.xg, m.away.shortName, m.away.stats.xg))
  }
  if (winner) lines.push(scorersLine(p, m, sideWon!))
  else lines.push(scorersLine(p, m, 'home'), scorersLine(p, m, 'away'))
  if (winner) lines.push(tableLine(p, league, winner, table))
  if (m.attendance) lines.push(p.attendance(m.attendance, m.venue))

  const ageHours = (Date.now() - Date.parse(m.start)) / 3_600_000
  return {
    id: `r-${m.key}`,
    kind: 'result',
    sport: m.sport,
    competitionId: c.id,
    competitionName: league,
    headline,
    headlineOrigin: 'template',
    summary: lines.filter(Boolean).join(' '),
    time: m.start,
    href: `/match/${c.id}/${m.id}`,
    match: m,
    weight: 100 - ageHours + (c.provider === 'liiga' ? 12 : 0) + Math.min(margin, 4) * 2 + (m.finishType && m.finishType !== 'regulation' ? 4 : 0),
  }
}

function previewStory(c: CompetitionDef, m: Match, table: Map<string, StandingRow>, lang: Lang): Story | null {
  const p = PHRASES[lang]
  const h = table.get(m.home.key)
  const a = table.get(m.away.key)
  if (!h || !a) return null
  const top = Math.ceil(table.size / 3)
  if (h.rank > top || a.rank > top) return null

  const headline = p.previewHeadline(m.home.shortName, m.away.shortName)
  const summary = p.previewSummary(
    { name: m.home.shortName, rank: h.rank, points: h.points },
    { name: m.away.shortName, rank: a.rank, points: a.points },
    m.venue,
  )
  const hoursAway = (Date.parse(m.start) - Date.now()) / 3_600_000
  return {
    id: `p-${m.key}`,
    kind: 'preview',
    sport: m.sport,
    competitionId: c.id,
    competitionName: competitionName(c, lang),
    headline,
    headlineOrigin: 'template',
    summary,
    time: m.start,
    href: `/match/${c.id}/${m.id}`,
    match: m,
    weight: 90 - hoursAway + (c.provider === 'liiga' ? 12 : 0) - Math.max(h.rank, a.rank),
  }
}

/** Results from the last `days` days and top-table previews for the next 3 days. */
export function buildStories(c: CompetitionDef, matches: Match[], standings: StandingRow[], days = 4, lang: Lang = 'en'): Story[] {
  const table = new Map(standings.map(r => [r.teamKey, r]))
  const now = Date.now()
  const stories: Story[] = []
  for (const m of matches) {
    const t = Date.parse(m.start)
    if (m.status === 'finished' && now - t < days * 86_400_000) {
      const s = resultStory(c, m, table, lang)
      if (s) stories.push(s)
    }
    else if (m.status === 'scheduled' && t > now && t - now < 3 * 86_400_000) {
      const s = previewStory(c, m, table, lang)
      if (s) stories.push(s)
    }
  }
  return stories
}
