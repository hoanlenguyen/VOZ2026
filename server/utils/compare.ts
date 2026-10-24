// Match-page comparison: the match itself (goals, then MatchTeam.stats when the provider has them),
// and both teams' season records before kick-off, counted from the competition's results.
// Points: football 3 / 1 / 0, a penalty shootout counts as a draw; Liiga 3 for a win in regulation,
// 2 for a win in overtime or shootout, 1 for a loss after regulation, 0 for a loss in regulation.

import type { CompetitionDef } from '#shared/utils/competitions'
import type { CompareGroup, CompareRow, FormResult, MatchCompare } from '#shared/types/compare'
import type { Lang } from '#shared/utils/format'
import { COMPARE_TEXT } from './compare-text'

type Text = (typeof COMPARE_TEXT)[Lang]

export interface TeamRecord {
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
export function matchOutcome(m: Match, side: 'home' | 'away'): { result: FormResult, points: number } | null {
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

export function seasonRecord(season: Match[], teamKey: string, before: string, side: 'home' | 'away'): TeamRecord {
  const r: TeamRecord = {
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
    cleanSheets: 0, failedToScore: 0, venuePoints: 0, venuePlayed: 0, results: [], points: [],
  }
  const games = season
    .filter(m => m.status === 'finished' && m.start < before && (m.home.key === teamKey || m.away.key === teamKey))
    .sort((a, b) => a.start.localeCompare(b.start))
  for (const m of games) {
    const atHome = m.home.key === teamKey
    const o = matchOutcome(m, atHome ? 'home' : 'away')
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

function thisMatch(m: Match, tx: Text): CompareGroup | null {
  if (m.status !== 'finished' || m.home.score === null || m.away.score === null) return null
  const rows = [row('goals', tx.goals, m.home.score, m.away.score)]
  m.periods.forEach((p, i) => {
    const label = tx.periods[m.sport][i]
    if (label) rows.push(row(`period-${i + 1}`, label, p.home, p.away))
  })
  if (m.shootout?.home != null && m.shootout.away != null) rows.push(row('penalties', tx.penalties, m.shootout.home, m.shootout.away))
  const winner = m.shootout ? m[m.shootout.winner].shortName : null
  const note = winner ? tx.shootoutWon(winner, m.sport) : null
  return { id: 'match', title: tx.thisMatch, note, rows }
}

/** MatchTeam.stats keys we know how to show, in display order. */
// Labels per language are in compare-text.ts, by the same key.
const STAT_ROWS: Array<{ key: string, better?: CompareRow['better'], decimals?: number, unit?: string }> = [
  { key: 'possessionPct', decimals: 0, unit: '%' },
  { key: 'xg', decimals: 2 },
  { key: 'shots' },
  { key: 'shotsOnTarget' },
  { key: 'bigChances' },
  { key: 'corners' },
  { key: 'blockedShots' },
  { key: 'faceoffWins' },
  { key: 'passes' },
  { key: 'tackles' },
  { key: 'saves' },
  { key: 'fouls', better: 'lower' },
  { key: 'offsides', better: 'none' },
  { key: 'yellowCards', better: 'lower' },
  { key: 'powerplayGoals' },
  { key: 'powerplayChances' },
  { key: 'shortHandedGoals' },
  { key: 'penaltyMinutes', better: 'lower' },
  { key: 'distanceKm', better: 'none', decimals: 1, unit: ' km' },
]

const share = (x: number, y: number) => (x + y ? (x / (x + y)) * 100 : 0)

function matchStats(m: Match, tx: Text): CompareGroup | null {
  // Before puck drop the stats endpoint answers with zeros.
  if (m.status === 'scheduled') return null
  const h = m.home.stats
  const a = m.away.stats
  const both = (k: string) => h[k] != null && a[k] != null
  const rows: CompareRow[] = []
  // Derived shares go first: they read like the possession / accuracy bars of a TV graphic.
  if (both('puckControlSeconds')) {
    rows.push(row('puck-control', tx.rows['puck-control']!, share(h.puckControlSeconds!, a.puckControlSeconds!), share(a.puckControlSeconds!, h.puckControlSeconds!), 'higher', 0, '%'))
  }
  for (const s of STAT_ROWS) {
    if (both(s.key)) rows.push(row(s.key, tx.rows[s.key] ?? s.key, h[s.key]!, a[s.key]!, s.better, s.decimals, s.unit))
    if (s.key === 'passes' && both('passes') && both('passesCompleted') && h.passes && a.passes) {
      rows.push(row('pass-accuracy', tx.rows['pass-accuracy']!, (h.passesCompleted! / h.passes!) * 100, (a.passesCompleted! / a.passes!) * 100, 'higher', 0, '%'))
    }
  }
  if (!rows.length) return null
  return {
    id: 'stats',
    title: tx.matchStats,
    note: both('puckControlSeconds') ? tx.puckNote : null,
    rows,
  }
}

function beforeKickOff(c: CompetitionDef, h: TeamRecord, a: TeamRecord, tx: Text, league: string): CompareGroup {
  const note = !h.played && !a.played ? tx.noGamesYet(league) : tx.gamesBefore(league, c.sport, h.played, a.played)
  const r = tx.rows
  const rows = [
    row('points', r.points!, sum(h.points), sum(a.points)),
    row('ppg', r.ppg!, perGame(sum(h.points), h.played), perGame(sum(a.points), a.played), 'higher', 2),
    row('venue-ppg', r['venue-ppg']!, perGame(h.venuePoints, h.venuePlayed), perGame(a.venuePoints, a.venuePlayed), 'higher', 2),
    row('won', r.won!, h.won, a.won),
    row('lost', r.lost!, h.lost, a.lost, 'lower'),
    row('scored', r.scored!, h.goalsFor, a.goalsFor),
    row('conceded', r.conceded!, h.goalsAgainst, a.goalsAgainst, 'lower'),
    row('gpg', r.gpg!, perGame(h.goalsFor, h.played), perGame(a.goalsFor, a.played), 'higher', 2),
    row('clean-sheets', tx.cleanSheets(c.sport), h.cleanSheets, a.cleanSheets),
    row('failed-to-score', tx.failedToScore(c.sport), h.failedToScore, a.failedToScore, 'lower'),
  ]
  return { id: 'season', title: tx.beforeStart(c.sport), note, rows }
}

function lastFive(h: TeamRecord, a: TeamRecord, tx: Text): CompareGroup | null {
  if (!h.played && !a.played) return null
  return {
    id: 'form',
    title: tx.lastFive,
    note: null,
    rows: [row('form-points', tx.rows['form-points']!, sum(h.points.slice(-5)), sum(a.points.slice(-5)))],
  }
}

/** Earlier meetings of the two teams in this competition and season. */
function meetings(season: Match[], m: Match, tx: Text): CompareGroup | null {
  const earlier = season.filter(x => x.status === 'finished' && x.start < m.start && x.home.score !== null && x.away.score !== null
    && ((x.home.key === m.home.key && x.away.key === m.away.key) || (x.home.key === m.away.key && x.away.key === m.home.key)))
  if (!earlier.length) return null
  let home = 0
  let away = 0
  let drawn = 0
  for (const x of earlier) {
    const result = matchOutcome(x, x.home.key === m.home.key ? 'home' : 'away')?.result
    if (result === 'W') home++
    else if (result === 'L') away++
    else drawn++
  }
  return {
    id: 'meetings',
    title: tx.meetings,
    note: tx.meetingsNote(earlier.length, drawn),
    rows: [row('meetings-won', tx.rows['meetings-won']!, home, away)],
  }
}

export function buildCompare(c: CompetitionDef, m: Match, season: Match[], lang: Lang = 'en'): MatchCompare | null {
  const tx = COMPARE_TEXT[lang]
  const h = seasonRecord(season, m.home.key, m.start, 'home')
  const a = seasonRecord(season, m.away.key, m.start, 'away')
  const groups = [thisMatch(m, tx), matchStats(m, tx), beforeKickOff(c, h, a, tx, competitionName(c, lang)), lastFive(h, a, tx), meetings(season, m, tx)]
    .filter((g): g is CompareGroup => g !== null)
  return { groups, form: { home: h.results.slice(-5), away: a.results.slice(-5) } }
}
