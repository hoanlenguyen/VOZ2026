// Liiga (Finnish ice hockey) stats API -> shared sport-agnostic types.
// Only the raw fields the app uses are typed here; everything else is ignored.

import type { CompetitionDef } from '#shared/utils/competitions'
import type { FinishType, Match, MatchStatus, MatchTeam, PlayerRef, ScoringEvent, StandingRow, TeamListItem } from '#shared/types/sports'
import type { SportProvider } from './types'

interface RawPlayer { playerId: number, firstName: string, lastName: string }

interface RawGoal {
  eventId: number
  period: number
  gameTime: number
  scorerPlayer: RawPlayer | null
  scorerPlayerId: number
  assistantPlayers?: RawPlayer[]
  goalTypes?: string[]
  homeTeamScore: number
  awayTeamScore: number
  winningGoal?: boolean
  videoClipUrl?: string | null
}

interface RawTeamInGame {
  teamId: string
  teamName: string
  goals: number
  goalEvents?: RawGoal[]
  expectedGoals?: number | null
  powerplayGoals?: number | null
  powerplayInstances?: number | null
  shortHandedGoals?: number | null
  ranking?: number | null
  logos?: { darkBg?: string | null } | null
}

interface RawGame {
  id: number
  season: number
  serie: string
  start: string
  started: boolean
  ended: boolean
  finishedType?: string | null
  gameWeek?: number | null
  spectators?: number | null
  iceRink?: { name?: string | null } | null
  periods?: Array<{ index: number, homeTeamGoals: number, awayTeamGoals: number, category: string }>
  homeTeam: RawTeamInGame
  awayTeam: RawTeamInGame
}

interface RawStanding {
  teamId: string
  teamName: string
  teamLogos?: { darkBg?: string | null } | null
  ranking: number
  games: number
  wins: number
  overtimeWins: number
  losses: number
  ties: number
  overtimeLosses: number
  points: number
  goals: number
  goalsAgainst: number
  powerPlayPercentage?: string | null
  shortHandedPercentage?: string | null
}

// games/{season}/{id}/stats: one entry per period and team, plus puck control per period.
interface RawPeriodPlayer {
  distance?: number | null
  totalPasses?: number | null
  successfulPasses?: number | null
  period?: { blockedShots?: number | null } | null
}

interface RawPeriodTeam {
  shots: number
  faceOffWins: number
  penaltyMinutes: number
  totalDistanceTravelled?: number | null
  periodPlayerStats?: RawPeriodPlayer[]
}

interface RawGameStats {
  homeTeam?: RawPeriodTeam[]
  awayTeam?: RawPeriodTeam[]
  puckStats?: Array<{ homeTeamControlDuration: number, awayTeamControlDuration: number }>
}

const FINISH: Record<string, FinishType> = {
  ENDED_DURING_REGULAR_GAME_TIME: 'regulation',
  ENDED_DURING_EXTENDED_GAME_TIME: 'overtime',
  ENDED_DURING_WINNING_SHOT_COMPETITION: 'shootout',
}

const TAGS: Record<string, ScoringEvent['tags'][number]> = {
  YV: 'power-play',
  YV2: 'power-play',
  AV: 'short-handed',
  TM: 'empty-net',
  RL: 'penalty',
}

const season = () => Number(useRuntimeConfig().liigaSeason)

function teamKey(c: CompetitionDef, liigaTeamId: string): string {
  return `${c.id}:${findLiigaTeam(liigaTeamId)?.slug ?? liigaTeamId.split(':').pop()}`
}

function player(p: RawPlayer | null | undefined, fallbackId: number | null = null): PlayerRef {
  if (!p) return { id: fallbackId, name: 'Unknown' }
  return { id: p.playerId, name: `${p.firstName} ${p.lastName}`.trim() }
}

function pct(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 1000) / 10 : null
}

function clockLabel(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function event(g: RawGoal, side: 'home' | 'away'): ScoringEvent {
  const types = g.goalTypes ?? []
  const tags = types.map(t => TAGS[t]).filter((t): t is ScoringEvent['tags'][number] => !!t)
  if (g.winningGoal) tags.push('game-winner')
  return {
    id: String(g.eventId),
    side,
    period: g.period,
    clock: g.gameTime,
    clockLabel: clockLabel(g.gameTime),
    scorer: player(g.scorerPlayer, g.scorerPlayerId),
    assists: (g.assistantPlayers ?? []).map(p => player(p)),
    tags: [...new Set(tags)],
    rawTypes: types,
    homeScore: g.homeTeamScore,
    awayScore: g.awayTeamScore,
    clipUrl: g.videoClipUrl ?? null,
  }
}

function team(c: CompetitionDef, t: RawTeamInGame): MatchTeam {
  return {
    key: teamKey(c, t.teamId),
    name: t.teamName,
    shortName: findLiigaTeam(t.teamId)?.name ?? t.teamName,
    logo: t.logos?.darkBg ?? null,
    score: t.goals,
    rank: t.ranking ?? null,
    stats: {
      xg: t.expectedGoals ?? null,
      powerplayGoals: t.powerplayGoals ?? null,
      powerplayChances: t.powerplayInstances ?? null,
      shortHandedGoals: t.shortHandedGoals ?? null,
    },
  }
}

const total = <T>(rows: T[], f: (r: T) => number | null | undefined) => rows.reduce((sum, r) => sum + (f(r) ?? 0), 0)

/** Whole-game team numbers from the per-period stats; keys extend MatchTeam.stats. */
function gameStats(raw: RawGameStats, side: 'home' | 'away'): MatchTeam['stats'] {
  const periods = (side === 'home' ? raw.homeTeam : raw.awayTeam) ?? []
  if (!periods.length) return {}
  const players = periods.flatMap(p => p.periodPlayerStats ?? [])
  const puck = raw.puckStats ?? []
  return {
    shots: total(periods, p => p.shots),
    faceoffWins: total(periods, p => p.faceOffWins),
    penaltyMinutes: total(periods, p => p.penaltyMinutes),
    blockedShots: total(players, p => p.period?.blockedShots),
    passes: total(players, p => p.totalPasses),
    passesCompleted: total(players, p => p.successfulPasses),
    puckControlSeconds: puck.length
      ? Math.round(total(puck, p => (side === 'home' ? p.homeTeamControlDuration : p.awayTeamControlDuration)))
      : null,
    distanceKm: Math.round(total(periods, p => p.totalDistanceTravelled) / 100) / 10,
  }
}

function status(g: RawGame): MatchStatus {
  if (g.ended) return 'finished'
  return g.started ? 'live' : 'scheduled'
}

function normalizeGame(c: CompetitionDef, g: RawGame): Match {
  const events = [
    ...(g.homeTeam.goalEvents ?? []).map(e => event(e, 'home')),
    ...(g.awayTeam.goalEvents ?? []).map(e => event(e, 'away')),
  ].sort((a, b) => a.clock - b.clock || Number(a.id) - Number(b.id))

  // Liiga also lists goal events that did not count (type VT0 / RL0, score unchanged), and the
  // shootout decider (type VL), which adds one goal to the final score of the winning side.
  const goals: ScoringEvent[] = []
  const notCounted: ScoringEvent[] = []
  let shootoutSide: 'home' | 'away' | null = null
  let home = 0
  let away = 0
  for (const e of events) {
    if (e.rawTypes.includes('VL')) {
      shootoutSide = e.side
      continue
    }
    const counts = e.side === 'home' ? e.homeScore === home + 1 : e.awayScore === away + 1
    if (counts) {
      goals.push(e)
      home = e.homeScore
      away = e.awayScore
    }
    else {
      notCounted.push(e)
    }
  }

  const homeTeam = team(c, g.homeTeam)
  const awayTeam = team(c, g.awayTeam)
  // MatchTeam.score excludes the shootout bonus goal; the shootout field records who won it.
  if (shootoutSide === 'home' && homeTeam.score !== null) homeTeam.score -= 1
  if (shootoutSide === 'away' && awayTeam.score !== null) awayTeam.score -= 1

  return {
    key: `${c.id}:${g.id}`,
    id: String(g.id),
    competitionId: c.id,
    sport: 'hockey',
    season: String(g.season),
    start: g.start,
    status: status(g),
    finishType: g.ended ? FINISH[g.finishedType ?? ''] ?? null : null,
    round: g.gameWeek ?? null,
    venue: g.iceRink?.name ?? null,
    attendance: g.spectators ?? null,
    home: homeTeam,
    away: awayTeam,
    // Liiga lists overtime (0–0) even for games decided in regulation.
    periods: (g.periods ?? [])
      .filter(p => p.category !== 'WINNING_SHOT_COMPETITION')
      .filter(p => p.category !== 'OVERTIME' || g.finishedType !== 'ENDED_DURING_REGULAR_GAME_TIME')
      .sort((a, b) => a.index - b.index)
      .map(p => ({ home: p.homeTeamGoals, away: p.awayTeamGoals })),
    shootout: shootoutSide ? { winner: shootoutSide, home: null, away: null } : null,
    goals,
    notCounted,
  }
}

function normalizeStanding(c: CompetitionDef, s: RawStanding): StandingRow {
  return {
    rank: s.ranking,
    teamKey: teamKey(c, s.teamId),
    name: s.teamName,
    logo: s.teamLogos?.darkBg ?? null,
    played: s.games,
    won: s.wins + s.overtimeWins,
    drawn: 0,
    lost: s.losses + s.overtimeLosses,
    overtimeWins: s.overtimeWins,
    overtimeLosses: s.overtimeLosses,
    points: s.points,
    goalsFor: s.goals,
    goalsAgainst: s.goalsAgainst,
    form: null,
    extras: {
      regulationWins: s.wins,
      powerplayPct: pct(s.powerPlayPercentage),
      penaltyKillPct: pct(s.shortHandedPercentage),
    },
  }
}

export const liigaProvider: SportProvider = {
  unavailableReason: () => null,
  hasScoringEvents: true,
  emblem: () => null,

  async teams(c) {
    const { data, source } = await upstream<{ teams: Array<{ id: string, logos?: { darkBg?: string | null } }> }>(
      'liiga', 'teams', { season: season(), serie: c.providerCode },
    )
    const teams: TeamListItem[] = []
    for (const raw of data.teams) {
      const info = findLiigaTeam(raw.id)
      if (!info) continue
      teams.push({
        key: `${c.id}:${info.slug}`,
        competitionId: c.id,
        name: info.name,
        shortName: info.name,
        abbr: info.abbr,
        town: info.town,
        venue: null,
        logo: raw.logos?.darkBg ?? null,
      })
    }
    return { data: teams, source }
  },

  async standings(c) {
    const { data, source } = await upstream<{ items: RawStanding[] }>('liiga', `standings/${c.providerCode}`, { season: season() })
    return { data: data.items.map(s => normalizeStanding(c, s)).sort((a, b) => a.rank - b.rank), source }
  },

  async matches(c, { teamKey: key, state }) {
    const { data, source } = await upstream<{ games: RawGame[] }>('liiga', 'games', { season: season() })
    const serie = c.providerCode.toUpperCase()
    let matches = data.games.filter(g => g.serie === serie).map(g => normalizeGame(c, g))
    if (key) matches = matches.filter(m => m.home.key === key || m.away.key === key)
    if (state === 'finished') matches = matches.filter(m => m.status === 'finished')
    if (state === 'upcoming') matches = matches.filter(m => m.status === 'scheduled')
    return { data: matches.sort((a, b) => a.start.localeCompare(b.start)), source }
  },

  async match(c, id) {
    const [{ data, source }, stats] = await Promise.all([
      upstream<{ game: RawGame }>('liiga', `games/${season()}/${id}`),
      // Missing before puck drop; the match page then simply has no match stats.
      upstream<RawGameStats>('liiga', `games/${season()}/${id}/stats`).then(r => r.data, () => null),
    ])
    const match = normalizeGame(c, data.game)
    if (stats) {
      Object.assign(match.home.stats, gameStats(stats, 'home'))
      Object.assign(match.away.stats, gameStats(stats, 'away'))
    }
    return { data: match, source }
  },
}
