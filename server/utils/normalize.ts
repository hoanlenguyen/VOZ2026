// Raw Liiga JSON -> the normalised types in shared/types/liiga.ts.
// Only the fields the app uses are typed here; everything else is ignored.

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
  goalsSoFarInSeason?: number | null
  videoClipUrl?: string | null
  videoThumbnailUrl?: string | null
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

export interface RawGame {
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
  homeTeam: RawTeamInGame
  awayTeam: RawTeamInGame
}

export interface RawStanding {
  teamId: string
  teamName: string
  teamLogos?: { darkBg?: string | null } | null
  ranking: number
  games: number
  wins: number
  overtimeWins: number
  losses: number
  overtimeLosses: number
  points: number
  goals: number
  goalsAgainst: number
  powerPlayPercentage?: string | null
  shortHandedPercentage?: string | null
}

const FINISH: Record<string, FinishType> = {
  ENDED_DURING_REGULAR_GAME_TIME: 'regulation',
  ENDED_DURING_EXTENDED_GAME_TIME: 'overtime',
  ENDED_DURING_WINNING_SHOT_COMPETITION: 'shootout',
}

function player(p: RawPlayer | null | undefined, fallbackId = 0): PlayerRef {
  if (!p) return { id: fallbackId, name: 'Unknown' }
  return { id: p.playerId, name: `${p.firstName} ${p.lastName}`.trim() }
}

function pct(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 1000) / 10 : null
}

function goal(g: RawGoal, side: 'home' | 'away'): GoalEvent {
  return {
    eventId: g.eventId,
    side,
    period: g.period,
    gameTime: g.gameTime,
    scorer: player(g.scorerPlayer, g.scorerPlayerId),
    assists: (g.assistantPlayers ?? []).map(p => player(p)),
    types: g.goalTypes ?? [],
    homeScore: g.homeTeamScore,
    awayScore: g.awayTeamScore,
    winningGoal: !!g.winningGoal,
    scorerSeasonGoals: g.goalsSoFarInSeason ?? null,
    clipUrl: g.videoClipUrl ?? null,
    thumbnailUrl: g.videoThumbnailUrl ?? null,
  }
}

function team(t: RawTeamInGame): TeamInGame {
  return {
    id: t.teamId,
    slug: findTeam(t.teamId)?.slug ?? null,
    name: t.teamName,
    logo: t.logos?.darkBg ?? null,
    score: t.goals,
    xg: t.expectedGoals ?? null,
    powerplayGoals: t.powerplayGoals ?? null,
    powerplayChances: t.powerplayInstances ?? null,
    shortHandedGoals: t.shortHandedGoals ?? null,
    ranking: t.ranking ?? null,
  }
}

export function normalizeGame(g: RawGame): GameSummary {
  const events = [
    ...(g.homeTeam.goalEvents ?? []).map(e => goal(e, 'home')),
    ...(g.awayTeam.goalEvents ?? []).map(e => goal(e, 'away')),
  ].sort((a, b) => a.gameTime - b.gameTime || a.eventId - b.eventId)

  // Liiga also lists goal events that did not count (e.g. type VT0, no scorer, score unchanged).
  // Only events that move the scoring team's tally forward are real goals.
  // A shootout win adds one goal to the final score; Liiga marks that decider with type VL.
  const goals: GoalEvent[] = []
  const notCounted: GoalEvent[] = []
  let shootoutWinner: GoalEvent | null = null
  let home = 0
  let away = 0
  for (const e of events) {
    if (e.types.includes('VL')) {
      shootoutWinner = e
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

  return {
    id: g.id,
    season: g.season,
    serie: g.serie,
    start: g.start,
    started: g.started,
    ended: g.ended,
    finishType: g.ended ? FINISH[g.finishedType ?? ''] ?? null : null,
    gameWeek: g.gameWeek ?? null,
    spectators: g.spectators ?? null,
    rink: g.iceRink?.name ?? null,
    home: team(g.homeTeam),
    away: team(g.awayTeam),
    goals,
    shootoutWinner,
    notCounted,
  }
}

export function normalizeStanding(s: RawStanding): StandingRow {
  return {
    rank: s.ranking,
    teamId: s.teamId,
    slug: findTeam(s.teamId)?.slug ?? null,
    name: s.teamName,
    logo: s.teamLogos?.darkBg ?? null,
    games: s.games,
    wins: s.wins,
    overtimeWins: s.overtimeWins,
    losses: s.losses,
    overtimeLosses: s.overtimeLosses,
    points: s.points,
    goalsFor: s.goals,
    goalsAgainst: s.goalsAgainst,
    powerplayPct: pct(s.powerPlayPercentage),
    penaltyKillPct: pct(s.shortHandedPercentage),
  }
}
