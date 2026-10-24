// Match-page comparison: the match itself (goals, then MatchTeam.stats when the provider has them),
// and both teams' season records before kick-off, counted from the competition's results.
// Points: football 3 / 1 / 0, a penalty shootout counts as a draw; Liiga 3 for a win in regulation,
// 2 for a win in overtime or shootout, 1 for a loss after regulation, 0 for a loss in regulation.

import type { CompetitionDef } from '#shared/utils/competitions'
import type { CompareGroup, CompareRow, FormResult, MatchCompare } from '#shared/types/compare'

interface TeamRecord {
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  cleanSheets: number
  failedToScore: number
  /** Points and games in this team's matches on the same side (home team at home, away team away). */
  venuePoints: number
  venuePlayed: number
  results: FormResult[]
  /** Points from each result, same order as results. */
  points: number[]
}

/** Result and league points for one side of a finished match. */
function outcome(m: Match, side: 'home' | 'away'): { result: FormResult, points: number } | null {
  const us = m[side]
  const them = side === 'home' ? m.away : m.home
  if (us.score === null || them.score === null) return null
  if (m.sport === 'hockey') {
    const won = us.score !== them.score ? us.score > them.score : m.shootout?.winner === side
    const late = m.finishType === 'overtime' || m.finishType === 'shootout'
    return won ? { result: 'W', points: late ? 2 : 3 } : { result: 'L', points: late ? 1 : 0 }
  }
  if (us.score === them.score) return { result: 'D', points: 1 }
  return us.score > them.score ? { result: 'W', points: 3 } : { result: 'L', points: 0 }
}

const perGame = (n: number, games: number) => (games ? n / games : 0)

function record(season: Match[], teamKey: string, before: string, side: 'home' | 'away'): TeamRecord {
  const r: TeamRecord = {
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
    cleanSheets: 0, failedToScore: 0, venuePoints: 0, venuePlayed: 0, results: [], points: [],
  }
  const games = season
    .filter(m => m.status === 'finished' && m.start < before && (m.home.key === teamKey || m.away.key === teamKey))
    .sort((a, b) => a.start.localeCompare(b.start))
  for (const m of games) {
    const atHome = m.home.key === teamKey
    const o = outcome(m, atHome ? 'home' : 'away')
    if (!o) continue
    const us = atHome ? m.home : m.away
    const them = atHome ? m.away : m.home
    const { result } = o
    r.played++
    r[result === 'W' ? 'won' : result === 'D' ? 'drawn' : 'lost']++
    // Liiga's table (like formatScore) credits the shootout winner with one goal.
    const bonus = (s: 'home' | 'away') => (m.sport === 'hockey' && m.shootout?.winner === s ? 1 : 0)
    const gf = us.score! + bonus(atHome ? 'home' : 'away')
    const ga = them.score! + bonus(atHome ? 'away' : 'home')
    r.goalsFor += gf
    r.goalsAgainst += ga
    if (ga === 0) r.cleanSheets++
    if (gf === 0) r.failedToScore++
    if (atHome === (side === 'home')) {
      r.venuePlayed++
      r.venuePoints += o.points
    }
    r.results.push(result)
    r.points.push(o.points)
  }
  return r
}

const row = (id: string, label: string, home: number, away: number, better: CompareRow['better'] = 'higher', decimals = 0, unit = ''): CompareRow =>
  ({ id, label, home, away, better, decimals, unit })
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

const PERIOD_LABELS = {
  football: ['1st half goals', '2nd half goals', 'Extra-time goals'],
  hockey: ['1st period goals', '2nd period goals', '3rd period goals', 'Overtime goals'],
}

function thisMatch(m: Match): CompareGroup | null {
  if (m.status !== 'finished' || m.home.score === null || m.away.score === null) return null
  const rows = [row('goals', 'Goals', m.home.score, m.away.score)]
  m.periods.forEach((p, i) => {
    const label = PERIOD_LABELS[m.sport][i]
    if (label) rows.push(row(`period-${i + 1}`, label, p.home, p.away))
  })
  if (m.shootout?.home != null && m.shootout.away != null) rows.push(row('penalties', 'Penalty shootout', m.shootout.home, m.shootout.away))
  const winner = m.shootout ? m[m.shootout.winner].shortName : null
  const note = winner ? `${winner} won the ${m.sport === 'hockey' ? 'shootout' : 'penalty shootout'}.` : null
  return { id: 'match', title: 'This match', note, rows }
}

/** MatchTeam.stats keys we know how to show, in display order. */
const STAT_ROWS: Array<{ key: string, label: string, better?: CompareRow['better'], decimals?: number, unit?: string }> = [
  { key: 'xg', label: 'Expected goals (xG)', decimals: 2 },
  { key: 'shots', label: 'Shots' },
  { key: 'blockedShots', label: 'Blocked shots' },
  { key: 'faceoffWins', label: 'Faceoffs won' },
  { key: 'passes', label: 'Passes' },
  { key: 'powerplayGoals', label: 'Power-play goals' },
  { key: 'powerplayChances', label: 'Power plays' },
  { key: 'shortHandedGoals', label: 'Short-handed goals' },
  { key: 'penaltyMinutes', label: 'Penalty minutes', better: 'lower' },
  { key: 'distanceKm', label: 'Distance skated', better: 'none', decimals: 1, unit: ' km' },
]

const share = (x: number, y: number) => (x + y ? (x / (x + y)) * 100 : 0)

function matchStats(m: Match): CompareGroup | null {
  // Before puck drop the stats endpoint answers with zeros.
  if (m.status === 'scheduled') return null
  const h = m.home.stats
  const a = m.away.stats
  const both = (k: string) => h[k] != null && a[k] != null
  const rows: CompareRow[] = []
  // Derived shares go first: they read like the possession / accuracy bars of a TV graphic.
  if (both('puckControlSeconds')) {
    rows.push(row('puck-control', 'Puck control', share(h.puckControlSeconds!, a.puckControlSeconds!), share(a.puckControlSeconds!, h.puckControlSeconds!), 'higher', 0, '%'))
  }
  for (const s of STAT_ROWS) {
    if (both(s.key)) rows.push(row(s.key, s.label, h[s.key]!, a[s.key]!, s.better, s.decimals, s.unit))
    if (s.key === 'passes' && both('passes') && both('passesCompleted') && h.passes && a.passes) {
      rows.push(row('pass-accuracy', 'Pass accuracy', (h.passesCompleted! / h.passes!) * 100, (a.passesCompleted! / a.passes!) * 100, 'higher', 0, '%'))
    }
  }
  if (!rows.length) return null
  return {
    id: 'stats',
    title: 'Match stats',
    note: both('puckControlSeconds') ? 'Puck control leaves out time when neither team had the puck.' : null,
    rows,
  }
}

// Seeded PRNG (mulberry32): the same match always gets the same sample numbers.
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Demo-only football match stats for when the provider has none (football-data free plan).
 * Bounded to typical top-flight ranges and kept consistent with the real score
 * (shots on target >= goals, shots > shots on target). Marked `sample` so the UI labels it.
 */
function sampleFootballStats(m: Match): CompareGroup | null {
  if (m.sport !== 'football' || m.status !== 'finished' || m.home.score === null || m.away.score === null) return null
  const rand = seeded(Number(m.id) || m.id.length)
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
  const possession = int(35, 65)
  const side = (goals: number, share: number) => {
    const onTarget = goals + int(1, 5)
    const passes = Math.round((share / 100) * int(820, 1000))
    return {
      shots: onTarget + int(3, 9),
      onTarget,
      corners: int(1, 9),
      fouls: int(7, 16),
      yellow: int(0, 4),
      red: rand() < 0.07 ? 1 : 0,
      offsides: int(0, 4),
      passes,
      accuracy: Math.round(Math.min(92, 70 + share / 5 + int(-3, 3))),
    }
  }
  const h = side(m.home.score, possession)
  const a = side(m.away.score, 100 - possession)
  return {
    id: 'stats',
    title: 'Match stats',
    note: 'Sample stats are demo numbers: our football data plan has no match stats yet. Not used in stories.',
    rows: [
      row('possession', 'Possession', possession, 100 - possession, 'higher', 0, '%'),
      row('shots', 'Shots', h.shots, a.shots),
      row('on-target', 'Shots on target', h.onTarget, a.onTarget),
      row('corners', 'Corners', h.corners, a.corners),
      row('passes', 'Passes', h.passes, a.passes),
      row('pass-accuracy', 'Pass accuracy', h.accuracy, a.accuracy, 'higher', 0, '%'),
      row('fouls', 'Fouls', h.fouls, a.fouls, 'lower'),
      row('yellow', 'Yellow cards', h.yellow, a.yellow, 'lower'),
      row('red', 'Red cards', h.red, a.red, 'lower'),
      row('offsides', 'Offsides', h.offsides, a.offsides, 'lower'),
    ].map(r => ({ ...r, sample: true })),
  }
}

function beforeKickOff(c: CompetitionDef, h: TeamRecord, a: TeamRecord): CompareGroup {
  const start = c.sport === 'hockey' ? 'puck drop' : 'kick-off'
  const games = c.sport === 'hockey' ? 'games' : 'matches'
  const note = !h.played && !a.played
    ? `Neither team had played in ${c.name} yet this season.`
    : `${c.name} ${games} this season before ${start}: ${h.played} and ${a.played} played.`
  const rows = [
    row('points', 'Points', sum(h.points), sum(a.points)),
    row('ppg', 'Points per game', perGame(sum(h.points), h.played), perGame(sum(a.points), a.played), 'higher', 2),
    row('venue-ppg', 'Points per game home / away', perGame(h.venuePoints, h.venuePlayed), perGame(a.venuePoints, a.venuePlayed), 'higher', 2),
    row('won', 'Wins', h.won, a.won),
    row('lost', 'Defeats', h.lost, a.lost, 'lower'),
    row('scored', 'Goals scored', h.goalsFor, a.goalsFor),
    row('conceded', 'Goals conceded', h.goalsAgainst, a.goalsAgainst, 'lower'),
    row('gpg', 'Goals per game', perGame(h.goalsFor, h.played), perGame(a.goalsFor, a.played), 'higher', 2),
    row('clean-sheets', c.sport === 'hockey' ? 'Shutouts' : 'Clean sheets', h.cleanSheets, a.cleanSheets),
    row('failed-to-score', c.sport === 'hockey' ? 'Shut out' : 'Failed to score', h.failedToScore, a.failedToScore, 'lower'),
  ]
  return { id: 'season', title: `Before ${start}`, note, rows }
}

function lastFive(h: TeamRecord, a: TeamRecord): CompareGroup | null {
  if (!h.played && !a.played) return null
  return {
    id: 'form',
    title: 'Last five matches',
    note: null,
    rows: [row('form-points', 'Points from last 5', sum(h.points.slice(-5)), sum(a.points.slice(-5)))],
  }
}

/** Earlier meetings of the two teams in this competition and season. */
function meetings(season: Match[], m: Match): CompareGroup | null {
  const earlier = season.filter(x => x.status === 'finished' && x.start < m.start && x.home.score !== null && x.away.score !== null
    && ((x.home.key === m.home.key && x.away.key === m.away.key) || (x.home.key === m.away.key && x.away.key === m.home.key)))
  if (!earlier.length) return null
  let home = 0
  let away = 0
  let drawn = 0
  for (const x of earlier) {
    const result = outcome(x, x.home.key === m.home.key ? 'home' : 'away')?.result
    if (result === 'W') home++
    else if (result === 'L') away++
    else drawn++
  }
  return {
    id: 'meetings',
    title: 'Earlier meetings this season',
    note: `${earlier.length} match${earlier.length === 1 ? '' : 'es'}${drawn ? `, ${drawn} drawn` : ''}.`,
    rows: [row('meetings-won', 'Wins', home, away)],
  }
}

export function buildCompare(c: CompetitionDef, m: Match, season: Match[]): MatchCompare | null {
  const h = record(season, m.home.key, m.start, 'home')
  const a = record(season, m.away.key, m.start, 'away')
  // Goals and in-game stats form one "This match" group; a live game has stats but no final score yet.
  const official = matchStats(m)
  const stats = official ?? sampleFootballStats(m)
  let match = thisMatch(m)
  if (stats) {
    match = match
      ? { ...match, rows: [...match.rows, ...stats.rows], note: [match.note, stats.note].filter(Boolean).join(' ') || null }
      : { ...stats, id: 'match', title: 'This match' }
  }
  const groups = [match, beforeKickOff(c, h, a), lastFive(h, a), meetings(season, m)]
    .filter((g): g is CompareGroup => g !== null)
  return {
    groups,
    matchStats: official ? 'official' : stats ? 'sample' : null,
    form: { home: h.results.slice(-5), away: a.results.slice(-5) },
  }
}
