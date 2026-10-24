// Match simulator for the mock sports API: turns a real finished fixture (football-data teams,
// squads and result) into a full match-centre file in the structure of data/mock/<competition>/<id>.json.
// The final and half-time scores are the real result; line-ups, scorers, events and stats are made
// up (seeded, so the same seed gives the same match) and the file is marked `source.simulated`.
// Every count agrees with the rest of the file: goals = score, shot events = shot stats, saves =
// the other side's shots on target that did not go in, scorers were on the pitch at that minute.

import type {
  MatchFile, MatchFileCard, MatchFileEvent, MatchFileGoal, MatchFileLineup, MatchFilePair, MatchFilePlayer, MatchFileSide, MatchFileSub,
} from '../types/mock-sports.ts'

export interface SimSquadPlayer { id: number | string, name: string, position: string | null }
export interface SimTeam {
  id: number | string
  name: string
  shortName: string
  tla: string
  venue?: string | null
  coach?: string | null
  squad: SimSquadPlayer[]
}
export interface SimFixture {
  id: number | string
  /** Kick-off, ISO UTC. */
  utcDate: string
  matchday?: number | null
  /** "2026/2027" */
  season: string
  competition: string
  /** IANA zone the kick-off is written in, e.g. "Europe/London". */
  timezone: string
  score: { fullTime: MatchFilePair, halfTime: MatchFilePair }
  referee?: string | null
  home: SimTeam
  away: SimTeam
}

/** Kick-off time zone per football-data competition code (Europe/London otherwise). */
export const COMPETITION_TIMEZONES: Record<string, string> = {
  PL: 'Europe/London', ELC: 'Europe/London', PD: 'Europe/Madrid', BL1: 'Europe/Berlin', SA: 'Europe/Rome',
  FL1: 'Europe/Paris', DED: 'Europe/Amsterdam', PPL: 'Europe/Lisbon', CL: 'Europe/London', VEI: 'Europe/Helsinki',
}

// The football-data v4 fields the simulator reads.
interface FdTeamRef { id: number, name: string, shortName?: string | null, tla?: string | null }
export interface FdFixture {
  id: number
  utcDate: string
  status: string
  matchday?: number | null
  season?: { startDate?: string, endDate?: string }
  homeTeam: FdTeamRef
  awayTeam: FdTeamRef
  score: { duration?: string, fullTime: { home: number | null, away: number | null }, halfTime: { home: number | null, away: number | null } }
  referees?: Array<{ name: string, type?: string }>
}
export interface FdTeam extends FdTeamRef { venue?: string | null, coach?: { name?: string | null } | null, squad?: SimSquadPlayer[] }

/** Finished in 90 minutes with a known half-time score: the only results the simulator keeps. */
export function simulatable(m: FdFixture): boolean {
  const { fullTime: ft, halfTime: ht } = m.score
  return m.status === 'FINISHED' && (m.score.duration ?? 'REGULAR') === 'REGULAR'
    && [ft.home, ft.away, ht.home, ht.away].every(n => typeof n === 'number')
}

/** football-data fixture + both clubs (with squads) -> simulator input; null when not usable. */
export function fixtureFromFootballData(m: FdFixture, teams: FdTeam[], competition: { name: string, code: string }): SimFixture | null {
  const club = (ref: FdTeamRef): SimTeam | null => {
    const t = teams.find(x => x.id === ref.id)
    if (!t?.squad || t.squad.length < 16) return null
    return { id: t.id, name: t.name, shortName: t.shortName || t.name, tla: t.tla || t.name.slice(0, 3).toUpperCase(), venue: t.venue, coach: t.coach?.name, squad: t.squad }
  }
  const home = club(m.homeTeam)
  const away = club(m.awayTeam)
  if (!simulatable(m) || !home || !away) return null
  const start = m.season?.startDate?.slice(0, 4) ?? m.utcDate.slice(0, 4)
  const end = m.season?.endDate?.slice(0, 4) ?? String(Number(start) + 1)
  return {
    id: m.id, utcDate: m.utcDate, matchday: m.matchday, season: `${start}/${end}`, competition: competition.name,
    timezone: COMPETITION_TIMEZONES[competition.code] ?? 'Europe/London',
    score: { fullTime: m.score.fullTime as MatchFilePair, halfTime: m.score.halfTime as MatchFilePair },
    referee: m.referees?.find(r => !r.type || r.type === 'REFEREE')?.name ?? null,
    home, away,
  }
}

export const SIMULATOR_NAME = 'VOZ match simulator'
export const SIMULATED_NOTE = 'Simulated match data (demo). The final and half-time scores are the real result from football-data.org; '
  + 'line-ups, scorers, events and stats are generated from the clubs\' squads and did not happen.'

type Role = MatchFilePlayer['position']
type Side = 'home' | 'away'
interface OnPitch { player: MatchFilePlayer, from: number, to: number }

/** Seeded PRNG (FNV-1a hash of the seed into mulberry32). */
export function rng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  let a = h >>> 0
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  const pick = <T>(list: T[]): T => list[Math.floor(next() * list.length)]!
  const weighted = <T>(list: T[], weight: (x: T) => number): T => {
    const total = list.reduce((s, x) => s + weight(x), 0)
    let r = next() * total
    for (const x of list) { r -= weight(x); if (r < 0) return x }
    return list[list.length - 1]!
  }
  const shuffle = <T>(list: T[]): T[] => {
    const out = [...list]
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!] }
    return out
  }
  return { next, int, pick, weighted, shuffle }
}
type Rng = ReturnType<typeof rng>

const FORMATIONS = ['4-2-3-1', '4-3-3', '4-4-2', '3-4-2-1', '3-5-2', '4-1-4-1']
const ROLE: Record<string, Role> = { Goalkeeper: 'Goalkeeper', Defence: 'Defender', Midfield: 'Midfielder', Offence: 'Forward' }

function lineup(r: Rng, team: SimTeam): MatchFileLineup {
  const formation = r.pick(FORMATIONS)
  const rows = formation.split('-').map(Number)
  const need: Record<Role, number> = { Goalkeeper: 1, Defender: rows[0]!, Midfielder: rows.slice(1, -1).reduce((a, b) => a + b, 0), Forward: rows[rows.length - 1]! }
  const pools = new Map<Role | null, SimSquadPlayer[]>()
  for (const p of r.shuffle(team.squad)) {
    const role = p.position ? ROLE[p.position] ?? null : null
    pools.set(role, [...(pools.get(role) ?? []), p])
  }
  const used = new Set<string>()
  // Take n players of a role; fill from players without a position, then anyone outfield.
  const take = (role: Role, n: number): Array<{ p: SimSquadPlayer, role: Role }> => {
    const out: Array<{ p: SimSquadPlayer, role: Role }> = []
    const sources = role === 'Goalkeeper' ? [pools.get('Goalkeeper') ?? []] : [pools.get(role) ?? [], pools.get(null) ?? [], ...['Midfielder', 'Defender', 'Forward'].map(x => pools.get(x as Role) ?? [])]
    for (const pool of sources) {
      for (const p of pool) {
        if (out.length >= n) break
        if (!used.has(String(p.id))) { used.add(String(p.id)); out.push({ p, role }) }
      }
    }
    return out
  }
  const numbers = r.shuffle(Array.from({ length: 44 }, (_, i) => i + 2))
  const asPlayer = ({ p, role }: { p: SimSquadPlayer, role: Role }, n: number): MatchFilePlayer =>
    ({ id: String(p.id), name: p.name, shirtNumber: n, position: role, isCaptain: false })
  let k = 0
  const gk = take('Goalkeeper', 1).map(x => asPlayer(x, 1))
  const def = take('Defender', need.Defender).map(x => asPlayer(x, numbers[k++]!))
  const mid = take('Midfielder', need.Midfielder).map(x => asPlayer(x, numbers[k++]!))
  const fwd = take('Forward', need.Forward).map(x => asPlayer(x, numbers[k++]!))
  const startingXI = [...gk, ...def, ...mid, ...fwd]
  r.pick(startingXI.slice(1)).isCaptain = true
  const substitutes = [...take('Goalkeeper', 1), ...take('Defender', 3), ...take('Midfielder', 3), ...take('Forward', 2)]
    .map(x => asPlayer(x, numbers[k++]!))
  const formationRows: string[][] = [gk.map(p => p.name), def.map(p => p.name)]
  let m = 0
  for (const size of rows.slice(1, -1)) { formationRows.push(mid.slice(m, m + size).map(p => p.name)); m += size }
  formationRows.push(fwd.map(p => p.name))
  return { teamId: String(team.id), team: team.name, formation, formationRows, manager: team.coach ?? '', startingXI, substitutes }
}

/** A match minute: base (1–90) plus stoppage time, and its order on the clock. */
interface Minute { base: number, extra: number, half: 1 | 2 }
const order = (m: Minute) => m.base + m.extra / 100
const clock = (m: Minute) => m.base + m.extra
function minuteIn(r: Rng, half: 1 | 2, stoppage: number, from = half === 1 ? 1 : 46): Minute {
  const end = half === 1 ? 45 : 90
  const span = end - from + 1
  // About one event in twelve falls in stoppage time.
  if (stoppage > 0 && r.next() < 0.08) return { base: end, extra: r.int(1, stoppage), half }
  return { base: from + Math.floor(r.next() * span), extra: 0, half }
}

/** Local wall-clock parts of an instant in a time zone, plus its UTC offset ("+0100"). */
function local(at: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'longOffset',
  }).formatToParts(at).map(p => [p.type, p.value]))
  const off = /GMT([+-]\d{2}):?(\d{2})?/.exec(parts.timeZoneName ?? '')
  const offset = off ? `${off[1]}${off[2] ?? '00'}` : '+0000'
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}`, offset }
}

export function simulateMatch(f: SimFixture, seed: string, now = new Date()): MatchFile {
  const r = rng(seed)
  const kickoff = new Date(f.utcDate)
  const stoppage = { 1: r.int(1, 4), 2: r.int(3, 7) } as const
  const stamp = (m: Minute) => {
    // Second half starts after a 15-minute break; a few seconds into the minute.
    const at = new Date(kickoff.getTime() + ((clock(m) - 1) + (m.half === 2 ? 15 : 0)) * 60_000 + r.int(0, 59) * 1000)
    const l = local(at, f.timezone)
    return `${l.date.replace(/-/g, '')}T${l.time.replace(/:/g, '')}${l.offset}`
  }
  const sides: Side[] = ['home', 'away']
  const team = (s: Side) => f[s]
  const lineups = { home: lineup(r, f.home), away: lineup(r, f.away) }

  // Substitutions first, so every later event can ask who was on the pitch at that minute.
  const pitch: Record<Side, OnPitch[]> = { home: [], away: [] }
  const subs: Record<Side, Array<MatchFileSub & { at: Minute }>> = { home: [], away: [] }
  for (const s of sides) {
    pitch[s] = lineups[s].startingXI.map(player => ({ player, from: 0, to: Infinity }))
    const bench = lineups[s].substitutes.filter(p => p.position !== 'Goalkeeper')
    const times = Array.from({ length: r.int(3, 5) }, () => minuteIn(r, 2, stoppage[2], 55)).sort((a, b) => order(a) - order(b))
    for (const at of times) {
      const off = r.pick(pitch[s].filter(x => x.to === Infinity && x.from === 0 && x.player.position !== 'Goalkeeper'))
      if (!off || !bench.length) break
      const sameRole = bench.filter(p => p.position === off.player.position)
      const on = r.pick(sameRole.length ? sameRole : bench)
      bench.splice(bench.indexOf(on), 1)
      off.to = order(at)
      pitch[s].push({ player: on, from: order(at), to: Infinity })
      subs[s].push({ at, period: 'SecondHalf', playerOnId: on.id, playerOffId: off.player.id, time: String(clock(at)), timestamp: stamp(at), playerOn: on.name, playerOff: off.player.name })
    }
  }
  const onAt = (s: Side, at: Minute) => pitch[s].filter(x => x.from <= order(at) && order(at) < x.to).map(x => x.player)
  const ATTACK: Record<Role, number> = { Goalkeeper: 0, Defender: 1, Midfielder: 3, Forward: 6 }
  const CREATE: Record<Role, number> = { Goalkeeper: 0, Defender: 2, Midfielder: 4, Forward: 3 }

  // Goals: the real half-time and full-time score.
  const goals: Record<Side, Array<MatchFileGoal & { at: Minute }>> = { home: [], away: [] }
  for (const s of sides) {
    const first = f.score.halfTime[s]
    const second = f.score.fullTime[s] - first
    const times = [
      ...Array.from({ length: first }, () => minuteIn(r, 1, stoppage[1])),
      ...Array.from({ length: Math.max(0, second) }, () => minuteIn(r, 2, stoppage[2])),
    ].sort((a, b) => order(a) - order(b))
    for (const at of times) {
      const players = onAt(s, at)
      const scorer = r.weighted(players, p => ATTACK[p.position])
      const penalty = r.next() < 0.1
      const assist = !penalty && r.next() < 0.7 ? r.weighted(players.filter(p => p !== scorer), p => CREATE[p.position]) : null
      goals[s].push({
        at, goalType: penalty ? 'Penalty' : 'Goal', period: at.half === 1 ? 'FirstHalf' : 'SecondHalf', assistPlayerId: assist?.id ?? null,
        time: String(clock(at)), playerId: scorer.id, timestamp: stamp(at), player: scorer.name, ...(assist ? { assist: assist.name } : {}),
      })
    }
  }

  // Yellow cards (no reds: a red would change who is on the pitch).
  const cards: Record<Side, Array<MatchFileCard & { at: Minute }>> = { home: [], away: [] }
  for (const s of sides) {
    const booked = new Set<string>()
    const times = Array.from({ length: r.int(0, 3) }, () => {
      const half = r.next() < 0.3 ? 1 : 2
      return minuteIn(r, half, stoppage[half], half === 1 ? 10 : 46)
    }).sort((a, b) => order(a) - order(b))
    for (const at of times) {
      const candidates = onAt(s, at).filter(p => !booked.has(p.id) && p.position !== 'Goalkeeper')
      if (!candidates.length) continue
      const p = r.pick(candidates)
      booked.add(p.id)
      cards[s].push({ at, period: at.half === 1 ? 'FirstHalf' : 'SecondHalf', time: String(clock(at)), type: 'Yellow', playerId: p.id, timestamp: stamp(at), player: p.name })
    }
  }

  // Stats, consistent with the goals and with each other.
  const round = (x: number, d = 0) => Number(x.toFixed(d))
  const possession = round(50 + (r.next() - 0.5) * 24, 1)
  const pos: MatchFilePair = { home: possession, away: round(100 - possession, 1) }
  const shot = {} as Record<Side, { shots: number, on: number, off: number, blocked: number, xg: number, bigCreated: number, bigScored: number, corners: number, offsides: number }>
  for (const s of sides) {
    const g = f.score.fullTime[s]
    const shots = Math.max(g, g + r.int(4, 13))
    const on = Math.min(shots, Math.max(g, Math.round(shots * (0.25 + r.next() * 0.2))))
    const blocked = Math.min(shots - on, r.int(0, 4))
    const bigCreated = g + r.int(0, 3)
    shot[s] = {
      shots, on, blocked, off: shots - on - blocked,
      xg: round(goals[s].reduce((t, x) => t + (x.goalType === 'Penalty' ? 0.79 : 0.15 + r.next() * 0.4), 0) + (shots - g) * (0.04 + r.next() * 0.08), 4),
      bigCreated, bigScored: Math.min(g, bigCreated), corners: r.int(1, 10), offsides: r.int(0, 4),
    }
  }
  const pair = (fn: (s: Side) => number): MatchFilePair => ({ home: fn('home'), away: fn('away') })
  const passes = pair(s => Math.round(220 + pos[s] * 6 + r.int(-40, 40)))
  const tackles = pair(() => r.int(10, 25))
  const summary: Record<string, MatchFilePair> = {
    'possession_%': pos,
    'xG': pair(s => shot[s].xg),
    'shots': pair(s => shot[s].shots),
    'shots_on_target': pair(s => shot[s].on),
    'shots_off_target': pair(s => shot[s].off),
    'shots_blocked': pair(s => shot[s].blocked),
    'big_chances_created': pair(s => shot[s].bigCreated),
    'passes': passes,
    'accurate_passes': pair(s => Math.round(passes[s] * (0.74 + r.next() * 0.14))),
    'tackles': tackles,
    'tackles_won': pair(s => Math.round(tackles[s] * (0.4 + r.next() * 0.3))),
    'interceptions': pair(() => r.int(5, 15)),
    'clearances': pair(() => r.int(8, 30)),
    // A save = a shot on target by the other side that did not go in.
    'saves': pair(s => { const o = s === 'home' ? 'away' : 'home'; return shot[o].on - f.score.fullTime[o] }),
    'fouls': pair(() => r.int(7, 16)),
    'offsides': pair(s => shot[s].offsides),
    'yellow_cards': pair(s => cards[s].length),
    'red_cards': pair(() => 0),
    'touches': pair(s => Math.round(passes[s] * (1.3 + r.next() * 0.15))),
    'duels_won': pair(() => r.int(35, 60)),
    'aerials_won': pair(() => r.int(6, 20)),
  }
  const extraFor = (s: Side): Record<string, number> => {
    const o: Side = s === 'home' ? 'away' : 'home'
    return {
      wonCorners: shot[s].corners, lostCorners: shot[o].corners, totalCross: r.int(5, 25), touchesInOppBox: r.int(10, 35),
      expectedGoalsOnTarget: round(shot[s].xg * (0.6 + r.next() * 0.8), 3), expectedAssists: round(shot[s].xg * (0.4 + r.next() * 0.4), 6),
      bigChanceMissed: shot[s].bigCreated - shot[s].bigScored, bigChanceScored: shot[s].bigScored,
      penAreaEntries: r.int(15, 40), finalThirdEntries: r.int(40, 75),
    }
  }

  // Event list: every goal, card and substitution, plus one event per shot, corner and offside.
  const label = (m: Minute) => (m.extra ? `${m.base}'+${m.extra}'` : `${m.base}'`)
  const events: Array<MatchFileEvent & { o: number }> = []
  const push = (at: Minute, type: string, s: Side | null, p1: string | null, p2: string | null) =>
    events.push({ o: order(at), minute: label(at), type, team: s ? team(s).name : null, player1: p1, player2: p2 })
  const anyMinute = () => minuteIn(r, r.next() < 0.5 ? 1 : 2, 0)
  for (const s of sides) {
    for (const g of goals[s]) push(g.at, 'goal', s, g.player, g.assist ?? null)
    for (const c of cards[s]) push(c.at, 'yellow card', s, c.player, null)
    for (const x of subs[s]) push(x.at, 'substitution', s, x.playerOn, x.playerOff)
    const shotEvents = [
      ...Array<string>(shot[s].off).fill('miss'),
      ...Array<string>(shot[s].on - f.score.fullTime[s]).fill('attempt saved'),
      ...Array<string>(shot[s].blocked).fill('attempt blocked'),
    ]
    for (const type of shotEvents) {
      const at = anyMinute()
      const players = onAt(s, at)
      const shooter = r.weighted(players, p => ATTACK[p.position])
      const creator = r.next() < 0.5 ? r.weighted(players.filter(p => p !== shooter), p => CREATE[p.position]) : null
      push(at, type, s, shooter.name, creator?.name ?? null)
    }
    for (let i = 0; i < shot[s].corners; i++) {
      const at = anyMinute()
      push(at, 'corner', s, r.pick(onAt(s, at).filter(p => p.position !== 'Goalkeeper')).name, null)
    }
    for (let i = 0; i < shot[s].offsides; i++) {
      const at = anyMinute()
      const players = onAt(s, at).filter(p => p.position !== 'Goalkeeper')
      const runner = r.weighted(players, p => ATTACK[p.position])
      push(at, 'offside', s, runner.name, r.pick(players.filter(p => p !== runner)).name)
    }
  }
  push({ base: 45, extra: stoppage[1], half: 1 }, 'end 1', null, null, null)
  push({ base: 90, extra: stoppage[2], half: 2 }, 'end 2', null, null, null)
  events.sort((a, b) => a.o - b.o)

  const side = (s: Side): MatchFileSide => ({
    team: team(s).name,
    goals: goals[s].map(({ at: _, ...g }) => g),
    cards: cards[s].map(({ at: _, ...c }) => c),
    substitutions: subs[s].map(({ at: _, ...x }) => x),
  })
  const k = local(kickoff, f.timezone)
  const [y1, y2] = f.season.split('/')
  return {
    source: { name: SIMULATOR_NAME, url: null, scrapedAt: now.toISOString(), note: SIMULATED_NOTE, simulated: true, seed },
    matchInfo: {
      matchId: String(f.id),
      competition: f.competition,
      season: `Season ${y1}/${y2}`,
      ...(f.matchday ? { matchWeek: f.matchday } : {}),
      kickoff: `${k.date} ${k.time.slice(0, 5)}:00`,
      kickoffTimezone: f.timezone,
      ...(f.home.venue ? { venue: f.home.venue } : {}),
      attendance: r.int(18, 62) * 1000 + r.int(0, 999),
      status: 'FullTime',
      resultType: 'NormalResult',
      homeTeam: { id: String(f.home.id), name: f.home.name, shortName: f.home.shortName, abbr: f.home.tla, score: f.score.fullTime.home, halfTimeScore: f.score.halfTime.home, redCards: 0 },
      awayTeam: { id: String(f.away.id), name: f.away.name, shortName: f.away.shortName, abbr: f.away.tla, score: f.score.fullTime.away, halfTimeScore: f.score.halfTime.away, redCards: 0 },
      // Only the real referee; VOZ does not invent names for real officials.
      officials: f.referee ? [{ role: 'Referee', name: f.referee }] : [],
    },
    keyEvents: { home: side('home'), away: side('away') },
    lineups,
    stats: { summary, extra: { home: extraFor('home'), away: extraFor('away') } },
    events: events.map(({ o: _, ...e }) => e),
  }
}
