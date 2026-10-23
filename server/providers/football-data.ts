// football-data.org v4 -> shared sport-agnostic types.
// Free plan (TIER_ONE): scores, half-time, standings, teams; no goal events, lineups or stats.
// Response shapes: https://docs.football-data.org/general/v4/match.html

import type { CompetitionDef } from '#shared/utils/competitions'
import type { FinishType, Match, MatchStatus, MatchTeam, ScoringEvent, StandingRow, TeamListItem } from '#shared/types/sports'
import type { SportProvider } from './types'

interface RawTeam { id: number, name: string, shortName?: string | null, tla?: string | null, crest?: string | null }
interface RawScorePair { home: number | null, away: number | null }

interface RawGoal {
  minute: number
  injuryTime?: number | null
  type: 'REGULAR' | 'OWN' | 'PENALTY' | string
  team: { id: number }
  scorer: { id: number, name: string } | null
  assist?: { id: number, name: string } | null
  score: { home: number, away: number }
}

interface RawMatch {
  id: number
  utcDate: string
  status: string
  matchday?: number | null
  season?: { startDate?: string } | null
  venue?: string | null
  attendance?: number | null
  homeTeam: RawTeam
  awayTeam: RawTeam
  score: {
    duration?: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' | string
    fullTime: RawScorePair
    halfTime?: RawScorePair | null
    regularTime?: RawScorePair | null
    extraTime?: RawScorePair | null
    penalties?: RawScorePair | null
  }
  goals?: RawGoal[]
}

interface RawStandingEntry {
  position: number
  team: RawTeam
  playedGames: number
  form?: string | null
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
}

const STATUS: Record<string, MatchStatus> = {
  SCHEDULED: 'scheduled',
  TIMED: 'scheduled',
  IN_PLAY: 'live',
  PAUSED: 'live',
  LIVE: 'live',
  FINISHED: 'finished',
  AWARDED: 'finished',
  POSTPONED: 'postponed',
  SUSPENDED: 'postponed',
  CANCELLED: 'cancelled',
}

const FINISH: Record<string, FinishType> = {
  REGULAR: 'regulation',
  EXTRA_TIME: 'extra-time',
  PENALTY_SHOOTOUT: 'penalties',
}

const key = (c: CompetitionDef, teamId: number) => `${c.id}:${teamId}`
const sub = (a: number | null | undefined, b: number | null | undefined) => (a ?? 0) - (b ?? 0)

function team(c: CompetitionDef, t: RawTeam, score: number | null): MatchTeam {
  return {
    key: key(c, t.id),
    name: t.name,
    shortName: t.shortName || t.name,
    logo: t.crest ?? null,
    score,
    rank: null,
    stats: {},
  }
}

function goalEvent(m: RawMatch, g: RawGoal, i: number): ScoringEvent {
  const tags: ScoringEvent['tags'] = []
  if (g.type === 'OWN') tags.push('own-goal')
  if (g.type === 'PENALTY') tags.push('penalty')
  const injury = g.injuryTime ?? 0
  return {
    id: `${m.id}-${i}`,
    side: g.team.id === m.homeTeam.id ? 'home' : 'away',
    period: g.minute > 90 ? 3 : g.minute > 45 ? 2 : 1,
    clock: (g.minute + injury) * 60,
    clockLabel: injury ? `${g.minute}+${injury}'` : `${g.minute}'`,
    scorer: g.scorer ? { id: g.scorer.id, name: g.scorer.name } : { id: null, name: 'Unknown' },
    assists: g.assist ? [{ id: g.assist.id, name: g.assist.name }] : [],
    tags,
    rawTypes: [g.type],
    homeScore: g.score.home,
    awayScore: g.score.away,
    clipUrl: null,
  }
}

export function normalizeMatch(c: CompetitionDef, m: RawMatch): Match {
  const { fullTime, halfTime, regularTime, extraTime, penalties } = m.score
  const hasPens = penalties?.home != null && penalties.away != null
  // In v4, fullTime includes penalty-shootout goals; MatchTeam.score must not.
  const home = fullTime.home === null ? null : fullTime.home - (hasPens ? penalties!.home! : 0)
  const away = fullTime.away === null ? null : fullTime.away - (hasPens ? penalties!.away! : 0)

  const periods: Match['periods'] = []
  if (halfTime?.home != null && halfTime.away != null) {
    periods.push({ home: halfTime.home, away: halfTime.away })
    const ninety = regularTime?.home != null ? regularTime : (m.score.duration === 'REGULAR' ? { home, away } : null)
    if (ninety?.home != null && ninety.away != null) {
      periods.push({ home: sub(ninety.home, halfTime.home), away: sub(ninety.away, halfTime.away) })
    }
    if (extraTime?.home != null && extraTime.away != null) periods.push({ home: extraTime.home, away: extraTime.away })
  }

  const status = STATUS[m.status] ?? 'scheduled'
  return {
    key: `${c.id}:${m.id}`,
    id: String(m.id),
    competitionId: c.id,
    sport: 'football',
    season: m.season?.startDate?.slice(0, 4) ?? '',
    start: m.utcDate,
    status,
    finishType: status === 'finished' ? FINISH[m.score.duration ?? 'REGULAR'] ?? null : null,
    round: m.matchday ?? null,
    venue: m.venue ?? null,
    attendance: m.attendance ?? null,
    home: team(c, m.homeTeam, home),
    away: team(c, m.awayTeam, away),
    periods,
    shootout: hasPens
      ? { winner: penalties!.home! > penalties!.away! ? 'home' : 'away', home: penalties!.home!, away: penalties!.away! }
      : null,
    goals: (m.goals ?? []).map((g, i) => goalEvent(m, g, i)).sort((a, b) => a.clock - b.clock),
    notCounted: [],
  }
}

export const footballDataProvider: SportProvider = {
  unavailableReason(c) {
    if (c.tier && c.tier !== 'TIER_ONE') return `Needs a paid football-data.org plan (${c.tier})`
    if (!useRuntimeConfig().footballDataToken && dataMode() !== 'snapshot') return 'Needs a football-data.org API token'
    return null
  },
  hasScoringEvents: false,
  emblem: c => `https://crests.football-data.org/${c.providerCode}.png`,

  async teams(c) {
    const { data, source } = await upstream<{ teams: Array<RawTeam & { venue?: string | null }> }>(
      'football-data', `competitions/${c.providerCode}/teams`,
    )
    const teams: TeamListItem[] = data.teams.map(t => ({
      key: key(c, t.id),
      competitionId: c.id,
      name: t.name,
      shortName: t.shortName || t.name,
      abbr: t.tla || (t.shortName || t.name).slice(0, 3).toUpperCase(),
      town: null,
      venue: t.venue ?? null,
      logo: t.crest ?? null,
    }))
    return { data: teams.sort((a, b) => a.shortName.localeCompare(b.shortName)), source }
  },

  async standings(c) {
    const { data, source } = await upstream<{ standings: Array<{ type: string, table: RawStandingEntry[] }> }>(
      'football-data', `competitions/${c.providerCode}/standings`,
    )
    const rows: StandingRow[] = data.standings
      .filter(s => s.type === 'TOTAL')
      .flatMap(s => s.table)
      .map(r => ({
        rank: r.position,
        teamKey: key(c, r.team.id),
        name: r.team.shortName || r.team.name,
        logo: r.team.crest ?? null,
        played: r.playedGames,
        won: r.won,
        drawn: r.draw,
        lost: r.lost,
        overtimeWins: null,
        overtimeLosses: null,
        points: r.points,
        goalsFor: r.goalsFor,
        goalsAgainst: r.goalsAgainst,
        form: r.form ?? null,
        extras: {},
      }))
    return { data: rows, source }
  },

  async matches(c, { teamKey, state }) {
    // One call returns the whole current season; filtering here keeps us inside 10 requests/minute.
    const { data, source } = await upstream<{ matches: RawMatch[] }>('football-data', `competitions/${c.providerCode}/matches`)
    let matches = data.matches.map(m => normalizeMatch(c, m))
    if (teamKey) matches = matches.filter(m => m.home.key === teamKey || m.away.key === teamKey)
    if (state === 'finished') matches = matches.filter(m => m.status === 'finished')
    if (state === 'upcoming') matches = matches.filter(m => m.status === 'scheduled')
    return { data: matches.sort((a, b) => a.start.localeCompare(b.start)), source }
  },

  async match(c, id) {
    const { data, source } = await upstream<RawMatch>('football-data', `matches/${id}`)
    return { data: normalizeMatch(c, data), source }
  },
}
