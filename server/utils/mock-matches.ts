// Mock "deep data" matches: full match-centre data (events, line-ups, stats) for a few games,
// stored in data/mock/<competition>/<match id>.json and bundled as server assets ("mocks").
// They show what the product does with a richer data feed than the free football-data plan.
// Only structured facts are stored; every label shown is written here from those facts.

import type { Lang } from '#shared/utils/format'
import type { CompetitionDef } from '#shared/utils/competitions'
import type { LineupPlayer, MatchDetailExtras, TeamLineup, TimelineEvent, TimelineKind } from '#shared/types/match-detail'

interface MockTeam { id: string, name: string, shortName: string, abbr: string, score: number, halfTimeScore: number }
interface MockGoal { goalType: string, time: string, player: string, assist?: string, timestamp?: string }
interface MockCard { time: string, type: string, player: string }
interface MockSub { time: string, playerOn: string, playerOff: string }
interface MockSide { goals: MockGoal[], cards: MockCard[], substitutions: MockSub[] }
interface MockPlayer { name: string, shirtNumber?: number, position?: string, isCaptain?: boolean }
interface MockLineup { formation?: string, formationRows?: string[][], manager?: string, startingXI: MockPlayer[], substitutes: MockPlayer[] }
type Pair = { home: number, away: number }

interface MockFile {
  source: { name: string, url?: string, note?: string }
  matchInfo: {
    matchId: string
    matchWeek?: number
    kickoff: string
    venue?: string
    attendance?: number
    status: string
    homeTeam: MockTeam
    awayTeam: MockTeam
    officials?: Array<{ role: string, name: string }>
  }
  keyEvents: { home: MockSide, away: MockSide }
  lineups?: { home: MockLineup, away: MockLineup }
  stats?: { summary: Record<string, Pair>, extra?: { home: Record<string, number>, away: Record<string, number> } }
  events?: Array<{ minute: string | null, type: string, team: string | null, player1: string | null, player2: string | null }>
}

export interface MockMatch {
  match: Match
  extras: MatchDetailExtras
  /** Id of the same game in the provider's own data, so both URLs show the full detail. */
  providerId: string | null
}

const normalize = (s: string) => fold(s).toLowerCase().replace(/\b(fc|afc|cf)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** "45'+2'" -> { label: "45+2'", order: 45.02 }; "41" -> { label: "41'", order: 41 }. */
function minute(raw: string | null): { label: string | null, order: number } {
  if (!raw) return { label: null, order: Number.POSITIVE_INFINITY }
  const [base = '0', extra] = raw.replace(/'/g, '').split('+')
  return { label: extra ? `${base}+${extra}'` : `${base}'`, order: Number(base) + (extra ? Number(extra) / 100 : 0) }
}

/** Kick-off is local time; the UTC offset comes from the event timestamps ("20261023T204136+0100"). */
function kickoffIso(f: MockFile): string {
  const stamp = [...f.keyEvents.home.goals, ...f.keyEvents.away.goals].find(g => g.timestamp)?.timestamp
  const off = stamp?.match(/([+-])(\d{2})(\d{2})$/)
  const offset = off ? `${off[1]}${off[2]}:${off[3]}` : 'Z'
  return new Date(`${f.matchInfo.kickoff.replace(' ', 'T')}${offset}`).toISOString()
}

function resolveTeam(c: CompetitionDef, t: MockTeam, season: Match[]): Pick<MatchTeam, 'key' | 'logo'> {
  const target = normalize(t.name)
  for (const m of season) {
    for (const side of [m.home, m.away]) {
      if (normalize(side.name) === target || normalize(side.shortName) === target) return { key: side.key, logo: side.logo }
    }
  }
  return { key: `${c.id}:mock-${t.id}`, logo: null }
}

function stats(f: MockFile, side: 'home' | 'away'): Record<string, number | null> {
  const s = f.stats?.summary ?? {}
  const x = f.stats?.extra?.[side] ?? {}
  const v = (k: string) => s[k]?.[side] ?? null
  return {
    possessionPct: v('possession_%'),
    xg: v('xG'),
    shots: v('shots'),
    shotsOnTarget: v('shots_on_target'),
    bigChances: v('big_chances_created'),
    corners: x.wonCorners ?? null,
    passes: v('passes'),
    passesCompleted: v('accurate_passes'),
    tackles: v('tackles'),
    saves: v('saves'),
    fouls: v('fouls'),
    offsides: v('offsides'),
    yellowCards: v('yellow_cards'),
  }
}

function lineup(l: MockLineup | undefined): TeamLineup | null {
  if (!l) return null
  const player = (p: MockPlayer): LineupPlayer => ({ name: p.name, number: p.shirtNumber ?? null, position: p.position ?? null, captain: !!p.isCaptain })
  return {
    formation: l.formation ?? null,
    manager: l.manager ?? null,
    rows: l.formationRows ?? [],
    starters: l.startingXI.map(player),
    substitutes: l.substitutes.map(player),
  }
}

// The commentary event types we keep (corners are listed under the conceding team).
const EVENT_KIND: Record<string, TimelineKind> = {
  'attempt saved': 'shot-saved',
  'miss': 'shot-missed',
  'attempt blocked': 'shot-blocked',
  'contentious referee decisions': 'var',
  'offside': 'offside',
  'corner': 'corner',
}

// Timeline wording per language; the facts are in kind / goalType / assist / playerOff.
const TIMELINE_TEXT: Record<Lang, {
  kind: Record<TimelineKind, string>
  ownGoal: string
  penaltyGoal: string
  assist: (name: string) => string
  off: (name: string) => string
  conceded: (name: string) => string
}> = {
  en: {
    kind: {
      'goal': 'Goal', 'yellow': 'Yellow card', 'red': 'Red card', 'sub': 'Substitution', 'var': 'VAR review',
      'shot-saved': 'Shot saved', 'shot-missed': 'Shot off target', 'shot-blocked': 'Shot blocked',
      'offside': 'Offside', 'corner': 'Corner', 'half-time': 'Half-time', 'full-time': 'Full-time',
    },
    ownGoal: 'Own goal',
    penaltyGoal: 'Penalty goal',
    assist: n => `Assist: ${n}`,
    off: n => `Off: ${n}`,
    conceded: n => `Conceded by ${n}`,
  },
  fi: {
    kind: {
      'goal': 'Maali', 'yellow': 'Keltainen kortti', 'red': 'Punainen kortti', 'sub': 'Vaihto', 'var': 'VAR-tarkistus',
      'shot-saved': 'Torjuttu laukaus', 'shot-missed': 'Laukaus ohi', 'shot-blocked': 'Blokattu laukaus',
      'offside': 'Paitsio', 'corner': 'Kulmapotku', 'half-time': 'Puoliaika', 'full-time': 'Loppu',
    },
    ownGoal: 'Oma maali',
    penaltyGoal: 'Rangaistuspotkumaali',
    assist: n => `Syöttö: ${n}`,
    off: n => `Ulos: ${n}`,
    conceded: n => `Aiheutti: ${n}`,
  },
}

function timeline(f: MockFile, homeName: string, lang: Lang): TimelineEvent[] {
  const tx = TIMELINE_TEXT[lang]
  const sideOf = (team: string | null) => (team === null ? null : team === homeName ? 'home' as const : 'away' as const)
  const other = (s: 'home' | 'away' | null) => (s === 'home' ? 'away' : s === 'away' ? 'home' : null)
  const out: TimelineEvent[] = []
  let seq = 0
  type Draft = Omit<TimelineEvent, 'id' | 'label' | 'goalType' | 'assist' | 'playerOff'> & Partial<Pick<TimelineEvent, 'label' | 'goalType' | 'assist' | 'playerOff'>>
  const push = (e: Draft) => out.push({
    goalType: null, assist: null, playerOff: null, ...e, label: e.label ?? tx.kind[e.kind], id: `e${seq++}`,
  })

  // Goals with the running score (keyEvents are the official record).
  const goals = (['home', 'away'] as const)
    .flatMap(side => f.keyEvents[side].goals.map(g => ({ g, side, m: minute(g.time) })))
    .sort((a, b) => a.m.order - b.m.order)
  let h = 0
  let a = 0
  for (const { g, side, m } of goals) {
    if (side === 'home') h++
    else a++
    const goalType = /own/i.test(g.goalType) ? 'own' as const : /pen/i.test(g.goalType) ? 'penalty' as const : 'regular' as const
    push({
      minute: m.label, order: m.order, side, kind: 'goal',
      label: goalType === 'own' ? tx.ownGoal : goalType === 'penalty' ? tx.penaltyGoal : undefined,
      goalType, assist: g.assist ?? null,
      player: g.player, detail: g.assist ? tx.assist(g.assist) : null, score: `${h}–${a}`, key: true,
    })
  }
  for (const side of ['home', 'away'] as const) {
    for (const c of f.keyEvents[side].cards) {
      const m = minute(c.time)
      const red = /red/i.test(c.type)
      push({ minute: m.label, order: m.order, side, kind: red ? 'red' : 'yellow', player: c.player, detail: null, score: null, key: true })
    }
    for (const s of f.keyEvents[side].substitutions) {
      const m = minute(s.time)
      push({ minute: m.label, order: m.order, side, kind: 'sub', player: s.playerOn, playerOff: s.playerOff, detail: tx.off(s.playerOff), score: null, key: true })
    }
  }

  const { homeTeam: ht, awayTeam: at } = f.matchInfo
  for (const e of f.events ?? []) {
    const m = minute(e.minute)
    if (e.type === 'end 1') {
      push({ minute: null, order: 45.99, side: null, kind: 'half-time', player: null, detail: null, score: `${ht.halfTimeScore}–${at.halfTimeScore}`, key: true })
      continue
    }
    if (e.type === 'end 2') {
      push({ minute: null, order: 999, side: null, kind: 'full-time', player: null, detail: null, score: `${ht.score}–${at.score}`, key: true })
      continue
    }
    const kind = EVENT_KIND[e.type]
    if (!kind) continue
    const side = sideOf(e.team)
    if (kind === 'corner') {
      push({ minute: m.label, order: m.order, side: other(side), kind, player: null, detail: e.player1 ? tx.conceded(e.player1) : null, score: null, key: false })
    }
    else if (kind === 'offside') {
      push({ minute: m.label, order: m.order, side, kind, player: e.player2 ?? e.player1, detail: null, score: null, key: false })
    }
    else {
      const assist = kind === 'var' ? null : e.player2 ?? null
      push({ minute: m.label, order: m.order, side, kind, player: e.player1, assist, detail: assist ? tx.assist(assist) : null, score: null, key: kind === 'var' })
    }
  }
  return out.sort((x, y) => x.order - y.order || Number(x.id.slice(1)) - Number(y.id.slice(1)))
}

/** A match file (bundled mock or SportWorld) as a Match with its full-data extras. */
export function toMock(c: CompetitionDef, f: MockFile, season: Match[], lang: Lang): MockMatch {
  const { matchInfo: mi } = f
  const start = kickoffIso(f)
  const home = resolveTeam(c, mi.homeTeam, season)
  const away = resolveTeam(c, mi.awayTeam, season)
  const tl = timeline(f, mi.homeTeam.name, lang)
  const goals: ScoringEvent[] = tl.filter(e => e.kind === 'goal').map(e => {
    const [hs, as] = e.score!.split('–').map(Number)
    return {
      id: e.id,
      side: e.side!,
      period: e.order > 45.99 ? 2 : 1,
      clock: Math.round(e.order * 60),
      clockLabel: e.minute ?? '',
      scorer: { id: null, name: e.player ?? 'Unknown' },
      assists: e.assist ? [{ id: null, name: e.assist }] : [],
      tags: e.goalType === 'own' ? ['own-goal'] : e.goalType === 'penalty' ? ['penalty'] : [],
      rawTypes: [e.goalType ?? 'regular'],
      homeScore: hs!,
      awayScore: as!,
      clipUrl: null,
    }
  })
  const team = (t: MockTeam, r: Pick<MatchTeam, 'key' | 'logo'>, side: 'home' | 'away'): MatchTeam => ({
    key: r.key, name: t.name, shortName: t.shortName, logo: r.logo, score: t.score, rank: null, stats: stats(f, side),
  })
  const finished = /full|finished/i.test(mi.status)
  const match: Match = {
    key: `${c.id}:${mi.matchId}`,
    id: mi.matchId,
    competitionId: c.id,
    sport: c.sport,
    season: start.slice(0, 4),
    start,
    status: finished ? 'finished' : 'scheduled',
    finishType: finished ? 'regulation' : null,
    round: mi.matchWeek ?? null,
    venue: mi.venue ?? null,
    attendance: mi.attendance ?? null,
    home: team(mi.homeTeam, home, 'home'),
    away: team(mi.awayTeam, away, 'away'),
    periods: finished
      ? [
          { home: mi.homeTeam.halfTimeScore, away: mi.awayTeam.halfTimeScore },
          { home: mi.homeTeam.score - mi.homeTeam.halfTimeScore, away: mi.awayTeam.score - mi.awayTeam.halfTimeScore },
        ]
      : [],
    shootout: null,
    goals,
    notCounted: [],
  }
  // The same game in the provider's data: same teams, same UTC day.
  const twin = season.find(m => m.home.key === home.key && m.away.key === away.key && m.start.slice(0, 10) === start.slice(0, 10))
  const extras: MatchDetailExtras = {
    source: { name: f.source.name, url: f.source.url ?? null, note: f.source.note ?? null },
    referee: mi.officials?.find(o => o.role === 'Referee')?.name ?? null,
    timeline: tl,
    lineups: f.lineups ? { home: lineup(f.lineups.home)!, away: lineup(f.lineups.away)! } : null,
  }
  return { match, extras, providerId: twin?.id ?? null }
}

/** All mock matches of a competition. `season` (provider matches) resolves team keys and crests. */
export async function mockMatchesFor(c: CompetitionDef, season: Match[], lang: Lang = 'en'): Promise<MockMatch[]> {
  const storage = useStorage('assets:mocks')
  const keys = await storage.getKeys(c.id)
  const files = await Promise.all(keys.filter(k => k.endsWith('.json')).map(k => storage.getItem<MockFile>(k)))
  return files.filter((f): f is MockFile => !!f).map(f => toMock(c, f, season, lang))
}

/** The mock for a match id: either the mock's own id or the provider's id of the same game. */
export async function findMockMatch(c: CompetitionDef, id: string, season: Match[], lang: Lang = 'en'): Promise<MockMatch | null> {
  return (await mockMatchesFor(c, season, lang)).find(m => m.match.id === id || m.providerId === id) ?? null
}
