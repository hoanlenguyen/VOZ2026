// The fact ledger: every verified statement about one match, numbered f1, f2, … The story agent
// may only state what these facts say and must cite them; the checker enforces it. Facts are
// computed from Match / MatchDetailExtras / the season's results, never written by hand.

import type { CompetitionDef } from '#shared/utils/competitions'
import type { MatchDetailExtras } from '#shared/types/match-detail'
import type { Fact, FactSection } from '#shared/types/story'

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}
const round = (v: number, d: number) => Number(v.toFixed(d))

interface Row { key: string, name: string, played: number, points: number, gf: number, ga: number }

/** League table from results (3/1/0 points), ordered by points, goal difference, goals scored. */
function table(c: CompetitionDef, games: Match[]): Row[] {
  const rows = new Map<string, Row>()
  const row = (t: MatchTeam) => rows.get(t.key) ?? rows.set(t.key, { key: t.key, name: t.shortName, played: 0, points: 0, gf: 0, ga: 0 }).get(t.key)!
  for (const m of games) {
    if (m.status !== 'finished' || m.home.score === null || m.away.score === null) continue
    const h = row(m.home)
    const a = row(m.away)
    h.played++
    a.played++
    h.gf += m.home.score
    h.ga += m.away.score
    a.gf += m.away.score
    a.ga += m.home.score
    if (c.sport === 'football') {
      if (m.home.score > m.away.score) h.points += 3
      else if (m.home.score < m.away.score) a.points += 3
      else {
        h.points++
        a.points++
      }
    }
  }
  return [...rows.values()].sort((x, y) => y.points - x.points || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf)
}

const resultLetter = (m: Match, key: string) => {
  const us = m.home.key === key ? m.home.score! : m.away.score!
  const them = m.home.key === key ? m.away.score! : m.home.score!
  return us > them ? 'W' : us < them ? 'L' : 'D'
}

export function buildFacts(c: CompetitionDef, m: Match, extras: MatchDetailExtras | null, season: Match[]): Fact[] {
  const facts: Fact[] = []
  const add = (section: FactSection, text: string) => facts.push({ id: `f${facts.length + 1}`, section, text })
  const H = m.home.shortName
  const A = m.away.shortName
  const hs = m.home.score
  const as = m.away.score
  const tz = c.sport === 'football' && c.country === 'England' ? 'Europe/London' : 'Europe/Helsinki'
  const when = new Date(m.start)

  // --- result ---
  if (hs !== null && as !== null) {
    add('result', `${c.name}${m.round ? ` matchweek ${m.round}` : ''}: ${m.home.name} ${hs}–${as} ${m.away.name} (full time).`)
    if (hs === as) add('result', `The match was a draw; ${H} and ${A} took a point each.`)
    else add('result', `${hs > as ? H : A} won ${Math.max(hs, as)}–${Math.min(hs, as)}.`)
    const ht = m.periods[0]
    if (ht) add('result', `Half-time score: ${H} ${ht.home}–${ht.away} ${A}.`)
    if (m.periods[1] && m.periods[1].home + m.periods[1].away === 0) add('result', 'No goals were scored in the second half.')
  }
  add('result', `Played on ${when.toLocaleDateString('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, kick-off ${when.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' })} local time.`)
  if (m.venue) add('result', `Venue: ${m.venue}${m.attendance ? `; attendance ${m.attendance.toLocaleString('en-GB')}` : ''}.`)

  // --- timeline ---
  const team = (side: 'home' | 'away' | null) => (side === 'home' ? H : side === 'away' ? A : '')
  if (extras) {
    let leader: 'home' | 'away' | null = null
    for (const e of extras.timeline) {
      if (e.kind === 'goal') {
        add('timeline', `${e.minute} ${team(e.side)} goal: ${e.player}${e.detail ? ` (${e.detail.replace(/^Assist:/, 'assist:')})` : ''}, making it ${e.score}.`)
        const [h, a] = e.score!.split('–').map(Number) as [number, number]
        const now = h > a ? 'home' : a > h ? 'away' : null
        if (leader && now === null) add('timeline', `${e.player}'s goal in the ${e.minute} was an equaliser for ${team(e.side)}.`)
        leader = now
      }
      else if (e.kind === 'yellow' || e.kind === 'red') add('timeline', `${e.minute} ${e.label.toLowerCase()} for ${e.player} (${team(e.side)}).`)
      else if (e.kind === 'var') add('timeline', `${e.minute} VAR review involving ${e.player} (${team(e.side)}).`)
    }
    for (const side of ['home', 'away'] as const) {
      const subs = extras.timeline.filter(e => e.kind === 'sub' && e.side === side)
      if (subs.length) add('timeline', `${team(side)} made ${subs.length} substitutions: ${subs.map(s => `${s.player} for ${s.detail?.replace('Off: ', '')} (${s.minute})`).join('; ')}.`)
    }
    const chances = (side: 'home' | 'away', kind: string) => extras.timeline.filter(e => e.side === side && e.kind === kind).length
    add('timeline', `Recorded attempts: ${H} ${chances('home', 'shot-saved')} saved, ${chances('home', 'shot-missed')} off target, ${chances('home', 'shot-blocked')} blocked; ${A} ${chances('away', 'shot-saved')} saved, ${chances('away', 'shot-missed')} off target, ${chances('away', 'shot-blocked')} blocked (goals not included).`)
  }
  else {
    for (const g of m.goals) add('timeline', `${g.clockLabel} ${team(g.side)} goal: ${g.scorer.name}, making it ${g.homeScore}–${g.awayScore}.`)
  }

  // --- stats ---
  const h = m.home.stats
  const a = m.away.stats
  const stat = (key: string, label: string, d = 0, unit = '') => {
    if (h[key] != null && a[key] != null) add('stats', `${label}: ${H} ${round(h[key]!, d)}${unit}, ${A} ${round(a[key]!, d)}${unit}.`)
  }
  stat('possessionPct', 'Possession', 1, '%')
  stat('xg', 'Expected goals (xG)', 2)
  if (h.xg != null && a.xg != null) {
    const diff = round(Math.abs(h.xg - a.xg), 2)
    add('stats', `${h.xg > a.xg ? H : A} had ${diff} more expected goals than ${h.xg > a.xg ? A : H}.`)
  }
  stat('shots', 'Shots')
  stat('shotsOnTarget', 'Shots on target')
  stat('bigChances', 'Big chances created')
  stat('corners', 'Corners')
  stat('passes', 'Passes')
  if (h.passes && a.passes && h.passesCompleted != null && a.passesCompleted != null) {
    add('stats', `Pass accuracy: ${H} ${round((h.passesCompleted / h.passes) * 100, 0)}%, ${A} ${round((a.passesCompleted / a.passes) * 100, 0)}%.`)
  }
  stat('tackles', 'Tackles')
  stat('saves', 'Goalkeeper saves')
  stat('fouls', 'Fouls')
  stat('offsides', 'Offsides')

  // --- form and table, counted from the season's results ---
  const before = season.filter(x => x.status === 'finished' && x.start < m.start)
  for (const side of [m.home, m.away]) {
    const last = before.filter(x => x.home.key === side.key || x.away.key === side.key).sort((x, y) => x.start.localeCompare(y.start)).slice(-5)
    if (!last.length) continue
    const list = last.map((x) => {
      const home = x.home.key === side.key
      return `${resultLetter(x, side.key)} ${home ? x.home.score : x.away.score}–${home ? x.away.score : x.home.score} ${home ? 'v' : 'at'} ${home ? x.away.shortName : x.home.shortName}`
    })
    const points = last.reduce((p, x) => p + ({ W: 3, D: 1, L: 0 }[resultLetter(x, side.key)]), 0)
    add('form', `${side.shortName}'s last ${last.length} ${c.name} results before this match (oldest first): ${list.join(', ')}; ${points} points from them.`)
  }
  if (c.sport === 'football' && hs !== null) {
    const pre = table(c, before)
    const post = table(c, [...before, m])
    for (const side of [m.home, m.away]) {
      const i = pre.findIndex(r => r.key === side.key)
      const j = post.findIndex(r => r.key === side.key)
      if (i >= 0) add('table', `Before kick-off ${side.shortName} were ${ordinal(i + 1)} in the ${c.name} table with ${pre[i]!.points} points from ${pre[i]!.played} matches.`)
      if (j >= 0) add('table', `After this match ${side.shortName} are ${ordinal(j + 1)} with ${post[j]!.points} points from ${post[j]!.played} matches (counted from results up to this game).`)
    }
  }

  // --- head-to-head (this season only: older seasons are not in our data) ---
  const meets = (x: Match) => (x.home.key === m.home.key && x.away.key === m.away.key) || (x.home.key === m.away.key && x.away.key === m.home.key)
  const earlier = before.filter(meets)
  if (!earlier.length) add('h2h', `This was the first meeting of ${H} and ${A} in the ${c.name} this season.`)
  else add('h2h', `Earlier meetings this season: ${earlier.map(x => `${x.home.shortName} ${x.home.score}–${x.away.score} ${x.away.shortName}`).join('; ')}.`)
  const next = season.filter(x => x.status === 'scheduled' && x.start > m.start && meets(x)).sort((x, y) => x.start.localeCompare(y.start))[0]
  // Name teams as this match does (providers' short names can differ: "Nottingham" vs "Nott'm Forest").
  if (next) add('h2h', `They meet again on ${new Date(next.start).toLocaleDateString('en-GB', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' })}, with ${next.home.key === m.home.key ? H : A} at home.`)

  // --- context ---
  if (extras?.lineups) {
    for (const side of ['home', 'away'] as const) {
      const l = extras.lineups[side]
      if (l.formation || l.manager) add('context', `${team(side)}${l.manager ? `, managed by ${l.manager},` : ''} lined up ${l.formation ?? 'with an unknown formation'}.`)
      const captain = l.starters.find(p => p.captain)
      if (captain) add('context', `${captain.name} captained ${team(side)}.`)
    }
  }
  if (extras?.referee) add('context', `Referee: ${extras.referee}.`)
  return facts
}

/** People and places the checker must see backed by a cited fact when a story mentions them. */
export function factNames(m: Match, extras: MatchDetailExtras | null): string[] {
  const names = new Set<string>()
  for (const g of m.goals) names.add(g.scorer.name)
  if (extras) {
    for (const e of extras.timeline) {
      if (e.player) names.add(e.player)
      const other = e.detail?.replace(/^(Assist|Off): /, '')
      if (other && !other.startsWith('Conceded')) names.add(other)
    }
    for (const side of ['home', 'away'] as const) {
      const l = extras.lineups?.[side]
      if (!l) continue
      for (const p of [...l.starters, ...l.substitutes]) names.add(p.name)
      if (l.manager) names.add(l.manager)
    }
    if (extras.referee) names.add(extras.referee)
  }
  if (m.venue) names.add(m.venue.split(',')[0]!)
  names.delete('Unknown')
  return [...names]
}
