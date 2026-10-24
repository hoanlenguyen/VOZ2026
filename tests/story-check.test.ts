// Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkStory, numbersIn } from '../shared/utils/story-check.ts'
import type { Fact } from '../shared/types/story.ts'

const facts: Fact[] = [
  { id: 'f1', section: 'result', text: 'Premier League matchweek 8: Ipswich Town 1–1 Nottingham Forest (full time).' },
  { id: 'f2', section: 'timeline', text: "13' Nott'm Forest goal: Neco Williams (assist: Daniel Muñoz), making it 0–1." },
  { id: 'f3', section: 'timeline', text: "41' Ipswich goal: Julio Enciso, making it 1–1." },
  { id: 'f4', section: 'stats', text: "Expected goals (xG): Ipswich 0.46, Nott'm Forest 2.29." },
  { id: 'f5', section: 'stats', text: "Possession: Ipswich 49.4%, Nott'm Forest 50.6%." },
]
const names = ['Neco Williams', 'Daniel Muñoz', 'Julio Enciso', 'Chris Wood']
const ctx = { facts, names, length: 'short' as const }
const filler = 'This sentence only pads the story so that the short length rule is met in these tests and nothing else.'

test('numbersIn reads digits, scores and number words', () => {
  assert.deepEqual(numbersIn("Enciso scored in the 41' to make it 1–1, two minutes later"), ['41', '1', '1', '2'])
})

test('a story backed by its cited facts passes', () => {
  const r = checkStory({
    headline: 'Ipswich and Forest draw 1–1',
    sentences: [
      { text: 'Neco Williams put Forest ahead after 13 minutes.', facts: ['f2'], paragraph: 1 },
      { text: 'Julio Enciso levelled at 1–1 in the 41st minute.', facts: ['f3'], paragraph: 1 },
      { text: 'Forest created far more, with 2.29 xG to 0.46, and had 51% of the ball.', facts: ['f4', 'f5'], paragraph: 1 },
      { text: filler, facts: ['f1'], paragraph: 1 },
    ],
  }, ctx)
  assert.equal(r.passed, true, r.issues.join('\n'))
  assert.equal(r.factsUsed, 5)
})

test('a number not in the cited facts fails', () => {
  const r = checkStory({ headline: 'Draw at Portman Road', sentences: [{ text: `Forest had 2.5 expected goals. ${filler}`, facts: ['f4'], paragraph: 1 }] }, ctx)
  assert.equal(r.passed, false)
  assert.match(r.issues.join(' '), /"2\.5"/)
})

test('a number backed by a different fact than the one cited fails', () => {
  const r = checkStory({ headline: 'Draw', sentences: [{ text: `Enciso scored in minute 41. ${filler}`, facts: ['f2'], paragraph: 1 }] }, ctx)
  assert.equal(r.passed, false)
})

test('a player not in the cited facts fails, by surname too', () => {
  const r = checkStory({ headline: 'Draw', sentences: [{ text: `Wood came close for Forest. ${filler}`, facts: ['f2'], paragraph: 1 }] }, ctx)
  assert.equal(r.passed, false)
  assert.match(r.issues.join(' '), /Chris Wood/)
})

test('quotes, speech and injuries are refused', () => {
  const r = checkStory({ headline: 'Draw', sentences: [{ text: `"A fair result," the coach said after Williams' injury. ${filler}`, facts: ['f2'], paragraph: 1 }] }, ctx)
  assert.equal(r.passed, false)
  assert.equal(r.issues.filter(i => /quotation|speech|injury/.test(i)).length, 3)
})

test('unknown fact ids and missing citations fail', () => {
  const r = checkStory({ headline: 'Draw', sentences: [{ text: filler, facts: ['f99'], paragraph: 1 }] }, ctx)
  assert.equal(r.passed, false)
  assert.match(r.issues.join(' '), /unknown fact ids: f99/)
})

test('length outside the range fails', () => {
  const r = checkStory({ headline: 'Draw', sentences: [{ text: 'Forest drew.', facts: ['f1'], paragraph: 1 }] }, ctx)
  assert.equal(r.passed, false)
  assert.match(r.issues.join(' '), /words/)
})

test('Finnish: number words, speech and injuries are checked', () => {
  assert.deepEqual(numbersIn('Forest laukoi kolme kertaa'), ['3'])
  const fi = { ...ctx, lang: 'fi' as const }
  const r = checkStory({ headline: 'Tasapeli Portman Roadilla', sentences: [{ text: `Forest teki viisi maalia. ${filler}`, facts: ['f1'], paragraph: 1 }] }, fi)
  assert.match(r.issues.join(' '), /"5"/)
  assert.match(checkStory({ headline: 'Tasapeli', sentences: [{ text: `Valmentaja sanoi tuloksen olevan reilu. ${filler}`, facts: ['f1'], paragraph: 1 }] }, fi).issues.join(' '), /speech/)
  assert.match(checkStory({ headline: 'Tasapeli', sentences: [{ text: `Enciso loukkaantui toisella puoliajalla. ${filler}`, facts: ['f3'], paragraph: 1 }] }, fi).issues.join(' '), /injury/)
})

test('Finnish stories use the Finnish word ranges', () => {
  // 17 words: below the English short minimum (20), inside the Finnish one (15).
  const text = 'Ipswich ja Forest pelasivat tasapelin 1–1 Premier Leaguen kahdeksannella kierroksella, ja molemmat joukkueet saivat ottelusta yhden pisteen.'
  const draft = { headline: 'Tasapeli Ipswichissä', sentences: [{ text, facts: ['f1'], paragraph: 1 }] }
  assert.match(checkStory(draft, ctx).issues.join(' '), /words/)
  assert.equal(checkStory(draft, { ...ctx, lang: 'fi' }).passed, true, checkStory(draft, { ...ctx, lang: 'fi' }).issues.join('\n'))
})
