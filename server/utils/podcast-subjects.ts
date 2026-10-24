// What a podcast episode is about, and the verified facts its writer gets. A match episode uses the
// match's own fact ledger (as the headline desk); a team episode the team's latest result plus its
// standing and next game; a league episode the latest round's results, the top of the table and the
// next fixtures. All facts are computed from provider data (mock "deep data" matches replace the
// provider's record of the same game), in English with the match's own team names.

import type { CompetitionDef } from '#shared/utils/competitions'
import type { MatchDetailExtras } from '#shared/types/match-detail'
import type { PodcastSubject, PodcastSubjectOption } from '#shared/types/podcast'
import type { Fact, FactSection } from '#shared/types/story'
import type { Lang } from '#shared/utils/format'

export interface ResolvedSubject {
  subject: PodcastSubject
  subjectId: string
  def: CompetitionDef
  label: string
  competitionName: string
  href: string
  /** Team and league episodes are daily; a match episode is written once (or again on request). */
  daily: boolean
  facts: Fact[]
  /** People and places the checker must see backed by a cited fact. */
  names: string[]
}

/** League results in a league episode: the latest round, at most this many games. */
const LEAGUE_RESULTS = 5
const LEAGUE_WINDOW_MS = 4 * 86_400_000

/** Validates a subject from a request body; null when it names no known competition. */
export function parseSubject(raw: unknown): PodcastSubject | null {
  const r = raw as Partial<{ kind: string, competitionId: string, matchId: string, teamKey: string }> | null
  if (!r || !findCompetition(r.competitionId)) return null
  const competitionId = r.competitionId!
  if (r.kind === 'match' && typeof r.matchId === 'string' && /^\d+$/.test(r.matchId)) return { kind: 'match', competitionId, matchId: r.matchId }
  if (r.kind === 'team' && typeof r.teamKey === 'string' && r.teamKey.startsWith(`${competitionId}:`)) return { kind: 'team', competitionId, teamKey: r.teamKey }
  if (r.kind === 'league') return { kind: 'league', competitionId }
  return null
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}
const zone = (c: CompetitionDef) => (c.sport === 'football' && c.country === 'England' ? 'Europe/London' : 'Europe/Helsinki')
const day = (c: CompetitionDef, iso: string) => new Date(iso).toLocaleDateString('en-GB', { timeZone: zone(c), weekday: 'long', day: 'numeric', month: 'long' })
const clock = (c: CompetitionDef, iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: zone(c), hour: '2-digit', minute: '2-digit' })

/** The season's games with mock "deep data" matches in place of the provider's record of them. */
async function seasonWithMocks(def: CompetitionDef) {
  const season = await providerFor(def).matches(def, {}).then(r => r.data)
  const mocks = await mockMatchesFor(def, season)
  const twins = new Set(mocks.map(m => m.providerId).filter(Boolean))
  const extras = new Map<string, MatchDetailExtras>(mocks.map(m => [m.match.key, m.extras]))
  const games = [...season.filter(m => !twins.has(m.id)), ...mocks.map(m => m.match)].sort((a, b) => a.start.localeCompare(b.start))
  return { season, games, extras }
}

const finished = (m: Match) => m.status === 'finished' && m.home.score !== null && m.away.score !== null

function renumber(facts: Array<Omit<Fact, 'id'>>): Fact[] {
  return facts.map((f, i) => ({ id: `f${i + 1}`, section: f.section, text: f.text }))
}

export async function resolveSubject(subject: PodcastSubject, lang: Lang): Promise<ResolvedSubject> {
  const def = findCompetition(subject.competitionId)
  if (!def) throw createError({ statusCode: 404, statusMessage: 'Unknown competition' })
  const provider = providerFor(def)
  const reason = provider.unavailableReason(def)
  if (reason) throw createError({ statusCode: 503, statusMessage: reason })
  const name = competitionName(def, lang)
  const base = { subject, subjectId: podcastSubjectId(subject), def, competitionName: name }
  const { season, games, extras } = await seasonWithMocks(def)

  if (subject.kind === 'match') {
    const mock = await findMockMatch(def, subject.matchId, season)
    const match = mock?.match ?? (await provider.match(def, subject.matchId)).data
    if (!finished(match)) throw createError({ statusCode: 409, statusMessage: 'Podcasts are made after the final whistle' })
    const x = mock?.extras ?? null
    return {
      ...base,
      label: `${match.home.shortName}–${match.away.shortName}`,
      href: `/match/${def.id}/${match.id}`,
      daily: false,
      facts: matchFacts(def, match, x, season).facts,
      names: factNames(match, x),
    }
  }

  const add = (list: Array<Omit<Fact, 'id'>>, section: FactSection, text: string) => list.push({ section, text })
  const standings = await provider.standings(def).then(r => r.data, () => [])
  const shortNames = new Map<string, string>()
  for (const m of games) for (const t of [m.home, m.away]) shortNames.set(t.key, t.shortName)
  const now = new Date().toISOString()

  if (subject.kind === 'team') {
    const own = games.filter(m => m.home.key === subject.teamKey || m.away.key === subject.teamKey)
    const last = own.filter(finished).at(-1)
    if (!last) throw createError({ statusCode: 404, statusMessage: 'No finished game for this team yet' })
    const x = extras.get(last.key) ?? null
    const team = last.home.key === subject.teamKey ? last.home : last.away
    const facts: Array<Omit<Fact, 'id'>> = matchFacts(def, last, x, season).facts
    const row = standings.find(r => r.teamKey === subject.teamKey)
    if (row) add(facts, 'table', `In the current ${def.name} table ${team.shortName} are ${ordinal(row.rank)} with ${row.points} points from ${row.played} games.`)
    const next = own.find(m => m.status === 'scheduled' && m.start > now)
    if (next) add(facts, 'context', `${team.shortName}'s next ${def.name} game: ${next.home.shortName} v ${next.away.shortName} on ${day(def, next.start)}, kick-off ${clock(def, next.start)} local time.`)
    return {
      ...base,
      label: team.name,
      href: `/match/${def.id}/${last.id}`,
      daily: true,
      facts: renumber(facts),
      names: factNames(last, x),
    }
  }

  // League: the latest round's results, the top of the table, what comes next.
  const done = games.filter(finished)
  const latest = done.at(-1)
  if (!latest) throw createError({ statusCode: 404, statusMessage: 'No finished games in this league yet' })
  const round = done.filter(m => Date.parse(latest.start) - Date.parse(m.start) <= LEAGUE_WINDOW_MS).slice(-LEAGUE_RESULTS).reverse()
  const facts: Array<Omit<Fact, 'id'>> = []
  const names = new Set<string>()
  for (const m of round) {
    add(facts, 'result', `${def.name}${m.round ? ` matchweek ${m.round}` : ''}, ${day(def, m.start)}: ${m.home.shortName} ${formatScore(m, 'en')} ${m.away.shortName} (full time).`)
    for (const side of ['home', 'away'] as const) {
      const scorers = m.goals.filter(g => g.side === side).map(g => g.scorer.name).filter(n => n && n !== 'Unknown')
      if (scorers.length) add(facts, 'timeline', `Goals for ${m[side].shortName} against ${m[side === 'home' ? 'away' : 'home'].shortName}: ${scorers.join(', ')}.`)
    }
    for (const n of factNames(m, extras.get(m.key) ?? null)) names.add(n)
  }
  const top = standings.slice(0, 3)
  if (top.length) {
    add(facts, 'table', `Top of the current ${def.name} table: ${top.map(r => `${ordinal(r.rank)} ${shortNames.get(r.teamKey) ?? r.name}, ${r.points} points from ${r.played} games`).join('; ')}.`)
    if (top[1] && top[0]!.points > top[1].points) add(facts, 'table', `${shortNames.get(top[0]!.teamKey) ?? top[0]!.name} lead the ${def.name} table by ${top[0]!.points - top[1].points} points.`)
  }
  for (const m of games.filter(g => g.status === 'scheduled' && g.start > now).slice(0, 3)) {
    add(facts, 'context', `Coming up in the ${def.name}: ${m.home.shortName} v ${m.away.shortName} on ${day(def, m.start)}, kick-off ${clock(def, m.start)} local time.`)
  }
  return {
    ...base,
    label: name,
    href: `/match/${def.id}/${latest.id}`,
    daily: true,
    facts: renumber(facts),
    names: [...names],
  }
}

/** Leagues offered for daily episodes (the front page's), with the teams of their season's games. */
const PODCAST_LEAGUES = ['liiga', 'premier-league', 'champions-league', 'la-liga', 'bundesliga', 'serie-a']

/** Teams and leagues the newsroom can schedule. Teams come from the season's games (already cached). */
export async function subjectOptions(lang: Lang): Promise<PodcastSubjectOption[]> {
  const groups = await Promise.all(PODCAST_LEAGUES.map(async (id) => {
    const def = findCompetition(id)!
    const provider = providerFor(def)
    if (provider.unavailableReason(def)) return []
    const games = await provider.matches(def, {}).then(r => r.data, () => null)
    if (!games) return []
    const name = competitionName(def, lang)
    const teams = new Map<string, string>()
    for (const m of games) for (const t of [m.home, m.away]) teams.set(t.key, t.name)
    const league: PodcastSubject = { kind: 'league', competitionId: def.id }
    return [
      { subject: league, subjectId: podcastSubjectId(league), label: name, competitionName: name },
      ...[...teams].sort((a, b) => a[1].localeCompare(b[1])).map(([teamKey, label]) => {
        const subject: PodcastSubject = { kind: 'team', competitionId: def.id, teamKey }
        return { subject, subjectId: podcastSubjectId(subject), label, competitionName: name }
      }),
    ]
  }))
  return groups.flat()
}
