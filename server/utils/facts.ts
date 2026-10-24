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

/**
 * "Edge" facts for AI headlines: where each side had the advantage, worked out here so the model
 * never does arithmetic. Season records follow compare.ts (sport-specific points, results before
 * kick-off); history is this season only, as older seasons are not in our data. Ids continue
 * after `startAt` facts, so they can be appended to buildFacts().
 */
export function buildEdgeFacts(c: CompetitionDef, m: Match, season: Match[], startAt = 0): Fact[] {
  const facts: Fact[] = []
  const add = (text: string) => facts.push({ id: `f${startAt + facts.length + 1}`, section: 'edge', text })
  const H = m.home.shortName
  const A = m.away.shortName
  const unit = c.sport === 'hockey' ? 'period' : 'half'
  const sum = (xs: number[]) => xs.reduce((x, y) => x + y, 0)
  const h = seasonRecord(season, m.home.key, m.start, 'home')
  const a = seasonRecord(season, m.away.key, m.start, 'away')

  // Table before kick-off, counted from results with the same points as the comparison.
  const keys = new Set(season.flatMap(x => [x.home.key, x.away.key]))
  const standing = [...keys].map((key) => {
    const r = seasonRecord(season, key, m.start, 'home')
    return { key, points: sum(r.points), gd: r.goalsFor - r.goalsAgainst, gf: r.goalsFor, played: r.played }
  }).filter(r => r.played).sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf)
  const rank = (key: string) => standing.findIndex(r => r.key === key) + 1
  const hr = rank(m.home.key)
  const ar = rank(m.away.key)
  const hp = sum(h.points)
  const ap = sum(a.points)
  if (hr && ar) {
    add(`Before kick-off ${H} were ${ordinal(hr)} and ${A} ${ordinal(ar)} in the ${c.name} table (counted from results, ${standing.length} teams).`)
    if (hp === ap) add(`${H} and ${A} were level on ${hp} points before kick-off.`)
    else add(`Before kick-off ${hp > ap ? H : A} were ${Math.abs(hp - ap)} points ahead of ${hp > ap ? A : H} (${Math.max(hp, ap)} to ${Math.min(hp, ap)}).`)
  }

  // Form: points from the last five, streaks only when the results show them.
  for (const [team, r] of [[H, h], [A, a]] as const) {
    if (!r.played) continue
    const last = r.points.slice(-5)
    add(`${team} took ${sum(last)} points from their last ${last.length} ${c.name} games before this match.`)
    const tail = (ok: (x: string) => boolean) => {
      let n = 0
      for (let i = r.results.length - 1; i >= 0 && ok(r.results[i]!); i--) n++
      return n
    }
    const won = tail(x => x === 'W')
    const unbeaten = tail(x => x !== 'L')
    const lost = tail(x => x === 'L')
    if (won >= 3) add(`${team} had won their last ${won} ${c.name} games in a row before this match.`)
    else if (unbeaten >= 4) add(`${team} were unbeaten in their last ${unbeaten} ${c.name} games before this match.`)
    if (lost >= 3) add(`${team} had lost their last ${lost} ${c.name} games in a row before this match.`)
  }

  // Attack, defence and venue record.
  if (h.played && a.played) {
    const pg = (n: number, g: number) => round(n / g, 2)
    add(`Before this match ${H} scored ${pg(h.goalsFor, h.played)} and conceded ${pg(h.goalsAgainst, h.played)} goals per game; ${A} scored ${pg(a.goalsFor, a.played)} and conceded ${pg(a.goalsAgainst, a.played)}.`)
    const hgd = h.goalsFor - h.goalsAgainst
    const agd = a.goalsFor - a.goalsAgainst
    const sign = (n: number) => (n > 0 ? `+${n}` : String(n))
    if (hgd !== agd) add(`${hgd > agd ? H : A} had the better goal difference before kick-off: ${sign(Math.max(hgd, agd))} against ${sign(Math.min(hgd, agd))}.`)
  }
  if (h.venuePlayed && a.venuePlayed) {
    add(`${H} had taken ${h.venuePoints} points from ${h.venuePlayed} home games this season; ${A} had taken ${a.venuePoints} points from ${a.venuePlayed} away games.`)
  }

  // Meetings earlier this season.
  const earlier = season.filter(x => x.status === 'finished' && x.start < m.start && x.home.score !== null
    && ((x.home.key === m.home.key && x.away.key === m.away.key) || (x.home.key === m.away.key && x.away.key === m.home.key)))
  if (earlier.length) {
    let hw = 0
    let aw = 0
    for (const x of earlier) {
      const res = matchOutcome(x, x.home.key === m.home.key ? 'home' : 'away')?.result
      if (res === 'W') hw++
      else if (res === 'L') aw++
    }
    const d = earlier.length - hw - aw
    add(`In their ${earlier.length} earlier ${c.name} meeting${earlier.length > 1 ? 's' : ''} this season ${H} won ${hw}, ${A} won ${aw}${d ? ` and ${d} ended level` : ''}.`)
    const lastMeet = earlier.sort((x, y) => x.start.localeCompare(y.start)).at(-1)!
    const lastRes = matchOutcome(lastMeet, lastMeet.home.key === m.home.key ? 'home' : 'away')?.result
    if (m.status === 'finished' && lastRes && lastRes !== 'D') {
      const beatenBefore = lastRes === 'W' ? A : H
      const res = matchOutcome(m, lastRes === 'W' ? 'away' : 'home')?.result
      if (res === 'W') add(`${beatenBefore} lost the previous meeting this season (${lastMeet.home.shortName} ${lastMeet.home.score}–${lastMeet.away.score} ${lastMeet.away.shortName}) and won this one.`)
    }
  }

  // The match itself: comebacks, late winners, results against the table or the numbers.
  if (m.status !== 'finished' || m.home.score === null || m.away.score === null) return facts
  const hres = matchOutcome(m, 'home')?.result
  const winSide = hres === 'W' ? 'home' : hres === 'L' ? 'away' : null
  if (!winSide) return facts
  const W = winSide === 'home' ? H : A
  const L = winSide === 'home' ? A : H
  const first = m.periods[0]
  if (first) {
    const [wf, lf] = winSide === 'home' ? [first.home, first.away] : [first.away, first.home]
    if (wf < lf) add(`${W} came from behind: they trailed ${wf}–${lf} after the first ${unit} and won.`)
  }
  if (m.home.score !== m.away.score) {
    // The decisive goal: the winner's goal after which the loser never drew level again.
    const goals = [...m.goals].sort((x, y) => x.clock - y.clock)
    const loserFinal = winSide === 'home' ? m.away.score : m.home.score
    const decisive = goals.find(g => g.side === winSide && (winSide === 'home' ? g.homeScore : g.awayScore) === loserFinal + 1)
    const late = c.sport === 'hockey' ? 55 * 60 : 80 * 60
    if (decisive && decisive.clock >= late) add(`${decisive.scorer.name} scored the decisive goal late in the match, at ${decisive.clockLabel}.`)
  }
  const wr = winSide === 'home' ? hr : ar
  const lr = winSide === 'home' ? ar : hr
  if (wr && lr && wr - lr >= 4) add(`${W} won although they started the match ${wr - lr} places below ${L} in the table.`)
  const wxg = m[winSide].stats.xg
  const lxg = m[winSide === 'home' ? 'away' : 'home'].stats.xg
  if (wxg != null && lxg != null && wxg < lxg) add(`${W} won although ${L} had more expected goals (${round(lxg, 2)} to ${round(wxg, 2)}).`)
  return facts
}

/**
 * The facts the AI headline and podcast writers get: buildFacts() plus the edge facts. Upcoming
 * games keep only the venue of the result facts; hockey drops buildFacts' football form points
 * (3/1/0), as the edge facts carry Liiga's. `edge` is returned on its own for cache keys.
 */
export function matchFacts(c: CompetitionDef, m: Match, extras: MatchDetailExtras | null, season: Match[]): { facts: Fact[], edge: Fact[] } {
  const base = buildFacts(c, m, extras, season)
  const edge = buildEdgeFacts(c, m, season, base.length)
  const facts = [...base, ...edge].filter((f) => {
    if (m.status !== 'finished' && f.section === 'result') return f.text.startsWith('Venue')
    return !(c.sport === 'hockey' && f.section === 'form')
  })
  return { facts, edge }
}
