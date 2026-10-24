// Table movement since each team's last game: the official table with every team's most recent
// result taken off (points, goal difference, goals for), ranked again, compared with today's ranks.
// A team without a finished game in our data gets demo movement (stable per team, flagged mocked).
import type { Match, StandingRow } from '#shared/types/sports'

function mockMove(teamKey: string): number {
  let h = 0
  for (const c of teamKey) h = (h * 31 + c.charCodeAt(0)) | 0
  return [0, 1, -1, 2, -2, 0, 1][Math.abs(h) % 7]!
}

export function withMovement(rows: StandingRow[], season: Match[]): StandingRow[] {
  const last = new Map<string, Match>()
  for (const m of season) {
    if (m.status !== 'finished') continue
    for (const side of ['home', 'away'] as const) {
      const prev = last.get(m[side].key)
      if (!prev || m.start > prev.start) last.set(m[side].key, m)
    }
  }
  const before = rows.map((r) => {
    const m = last.get(r.teamKey)
    const side = m && (m.home.key === r.teamKey ? 'home' : 'away')
    const o = m && side ? matchOutcome(m, side) : null
    if (!m || !side || !o) return { r, points: r.points, gd: r.goalsFor - r.goalsAgainst, gf: r.goalsFor, known: false }
    const us = m[side].score ?? 0
    const them = (side === 'home' ? m.away : m.home).score ?? 0
    return { r, points: r.points - o.points, gd: r.goalsFor - r.goalsAgainst - (us - them), gf: r.goalsFor - us, known: true }
  })
  const ranked = [...before].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.r.rank - b.r.rank)
  const prevRank = new Map(ranked.map((x, i) => [x.r.teamKey, i + 1]))
  return before.map(x => x.known
    ? { ...x.r, movement: prevRank.get(x.r.teamKey)! - x.r.rank, movementMocked: false }
    : { ...x.r, movement: mockMove(x.r.teamKey), movementMocked: true })
}
