// Run with: npm test
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fixtureFromFootballData, simulateMatch, type FdFixture, type FdTeam } from '../shared/utils/match-sim.ts'
import type { MatchFile } from '../shared/types/mock-sports.ts'

const snapshot = (name: string) => JSON.parse(readFileSync(new URL(`../data/snapshots/football-data/${name}`, import.meta.url), 'utf8'))
const { matches } = snapshot('competitions_PL_matches.json') as { matches: FdFixture[] }
const { teams } = snapshot('competitions_PL_teams.json') as { teams: FdTeam[] }
const competition = { name: 'Premier League', code: 'PL' }
const fixtures = matches.map(m => fixtureFromFootballData(m, teams, competition)).filter(f => f !== null)

const clock = (t: string) => Number(t)
const sides = ['home', 'away'] as const

function check(file: MatchFile) {
  const info = file.matchInfo
  for (const s of sides) {
    const t = s === 'home' ? info.homeTeam : info.awayTeam
    const side = file.keyEvents[s]
    const lineup = file.lineups[s]
    const stats = file.stats.summary
    // The score is the real one, and the goals add up to it (and to the half-time score).
    assert.equal(side.goals.length, t.score)
    assert.equal(side.goals.filter(g => g.period === 'FirstHalf').length, t.halfTimeScore)
    // Eleven starters, distinct people and shirt numbers, one keeper, one captain.
    assert.equal(lineup.startingXI.length, 11)
    const everyone = [...lineup.startingXI, ...lineup.substitutes]
    assert.equal(new Set(everyone.map(p => p.id)).size, everyone.length)
    assert.equal(new Set(everyone.map(p => p.shirtNumber)).size, everyone.length)
    assert.equal(lineup.startingXI.filter(p => p.position === 'Goalkeeper').length, 1)
    assert.equal(lineup.startingXI.filter(p => p.isCaptain).length, 1)
    assert.equal(lineup.formationRows.flat().length, 11)
    assert.equal(lineup.formation.split('-').map(Number).reduce((a, b) => a + b, 0), 10)
    // Who was on the pitch when.
    const onFrom = new Map(lineup.startingXI.map(p => [p.id, 0]))
    const offAt = new Map<string, number>()
    for (const x of side.substitutions) {
      assert.ok(onFrom.has(x.playerOffId) && !offAt.has(x.playerOffId), `${x.playerOff} subbed off while not on`)
      assert.ok(lineup.substitutes.some(p => p.id === x.playerOnId), `${x.playerOn} not on the bench`)
      offAt.set(x.playerOffId, clock(x.time))
      onFrom.set(x.playerOnId, clock(x.time))
    }
    const onPitch = (id: string, t: number) => onFrom.has(id) && onFrom.get(id)! <= t && t < (offAt.get(id) ?? Infinity)
    for (const g of side.goals) {
      assert.ok(onPitch(g.playerId, clock(g.time)), `${g.player} scored off the pitch`)
      if (g.assistPlayerId) assert.ok(onPitch(g.assistPlayerId, clock(g.time)) && g.assistPlayerId !== g.playerId)
    }
    for (const c of side.cards) assert.ok(onPitch(c.playerId, clock(c.time)))
    // Stats agree with the events.
    const ev = (type: string) => file.events.filter(e => e.type === type && e.team === t.name).length
    assert.equal(ev('goal'), t.score)
    assert.equal(ev('yellow card'), side.cards.length)
    assert.equal(stats.yellow_cards![s], side.cards.length)
    assert.equal(ev('substitution'), side.substitutions.length)
    assert.equal(ev('miss'), stats.shots_off_target![s])
    assert.equal(ev('attempt blocked'), stats.shots_blocked![s])
    assert.equal(ev('attempt saved') + t.score, stats.shots_on_target![s])
    assert.equal(stats.shots![s], stats.shots_on_target![s] + stats.shots_off_target![s] + stats.shots_blocked![s])
    assert.equal(ev('corner'), file.stats.extra[s].wonCorners)
    assert.equal(ev('offside'), stats.offsides![s])
    const other = s === 'home' ? 'away' : 'home'
    assert.equal(stats.saves![s], stats.shots_on_target![other] - (other === 'home' ? info.homeTeam : info.awayTeam).score)
    assert.ok(stats.accurate_passes![s] <= stats.passes![s])
  }
  assert.equal(Math.round((file.stats.summary['possession_%']!.home + file.stats.summary['possession_%']!.away) * 10), 1000)
  assert.equal(file.source.simulated, true)
}

test('every finished Premier League fixture simulates into a consistent match file', () => {
  assert.ok(fixtures.length >= 50, `only ${fixtures.length} usable fixtures`)
  for (const f of fixtures) for (const seed of ['a', 'b', 'c']) check(simulateMatch(f, `${f.id}:${seed}`))
})

test('the same seed gives the same match; another seed a different one', () => {
  const f = fixtures[0]!
  const now = new Date('2026-10-24T10:00:00Z')
  assert.deepEqual(simulateMatch(f, 's1', now), simulateMatch(f, 's1', now))
  assert.notDeepEqual(simulateMatch(f, 's1', now).keyEvents, simulateMatch(f, 's2', now).keyEvents)
})

test('kick-off is written in the competition time zone, with the matching offset in timestamps', () => {
  const f = fixtures.find(x => x.utcDate === '2026-10-19T19:00:00Z')!
  const file = simulateMatch(f, 'tz')
  assert.equal(file.matchInfo.kickoff, '2026-10-19 20:00:00')
  assert.equal(file.matchInfo.kickoffTimezone, 'Europe/London')
  for (const g of [...file.keyEvents.home.goals, ...file.keyEvents.away.goals]) assert.match(g.timestamp, /^20261019T2\d{5}\+0100$/)
  assert.deepEqual(file.matchInfo.officials, [{ role: 'Referee', name: 'Andy Madley' }])
})

test('unfinished or extra-time fixtures are not simulated', () => {
  const m = matches.find(x => x.status !== 'FINISHED')!
  assert.equal(fixtureFromFootballData(m, teams, competition), null)
  const done = matches.find(x => x.status === 'FINISHED')!
  assert.equal(fixtureFromFootballData({ ...done, score: { ...done.score, duration: 'PENALTY_SHOOTOUT' } }, teams, competition), null)
})
