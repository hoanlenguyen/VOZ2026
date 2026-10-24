// Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkRoundup } from '../shared/utils/roundup-check.ts'
import type { RoundupSource } from '../shared/types/roundup.ts'

const sources: RoundupSource[] = [
  { id: 'h1', kind: 'press', text: 'Szoboszlai, Munoz, Barcola, Frimpong - Liverpool injury news and return dates ahead of Brighton', outlet: 'Liverpool Echo', url: 'https://example.com/1', publishedAt: null },
  { id: 'h2', kind: 'press', text: 'Liverpool v Brighton at serious risk of being postponed as Storm Boelo approaches', outlet: 'SPORTbible', url: 'https://example.com/2', publishedAt: null },
  { id: 'f1', kind: 'fact', text: 'Before kick-off Liverpool are 5th with 12 points and Brighton 3rd with 16.', outlet: null, url: null, publishedAt: null },
]
const ctx = { sources, names: ['Liverpool', 'Brighton', 'Premier League'], lang: 'en' as const }
const pad = (n: number) => Array.from({ length: n }, () => 'the match day story continues here').join(' ')

test('an attributed roundup backed by its sources passes', () => {
  const r = checkRoundup({
    headline: 'Storm Boelo threatens Liverpool v Brighton',
    sentences: [
      { text: 'Liverpool Echo reports injury news on Szoboszlai, Munoz, Barcola and Frimpong before Brighton visit.', sources: ['h1'], paragraph: 1 },
      { text: 'The game is at serious risk of being postponed as Storm Boelo approaches, according to SPORTbible.', sources: ['h2'], paragraph: 1 },
      { text: `Brighton are 3rd with 16 points, Liverpool 5th with 12; ${pad(10)}.`, sources: ['f1'], paragraph: 2 },
    ],
  }, ctx)
  assert.deepEqual(r.issues, [])
})

test('a roundup that drops attribution, invents a player or a number, or quotes is refused', () => {
  const r = checkRoundup({
    headline: 'Salah ruled out for 9 weeks',
    sentences: [
      { text: 'Szoboszlai misses the game with injury.', sources: ['h1'], paragraph: 1 },
      { text: 'Liverpool Echo says Mohamed Salah is out for 3 weeks.', sources: ['h1'], paragraph: 1 },
      { text: 'Fans said "it is a disaster" about the storm.', sources: ['h1'], paragraph: 1 },
      { text: 'Nothing backs this sentence.', sources: [], paragraph: 1 },
    ],
  }, ctx)
  const all = r.issues.join(' ')
  assert.equal(r.passed, false)
  assert.match(all, /Sentence 2 names "Salah"/)
  assert.match(all, /headline uses "9"/)
  assert.match(all, /Sentence 1 uses a press headline but does not name its outlet/)
  assert.match(all, /Sentence 2 names "Mohamed"/)
  assert.match(all, /Sentence 3 contains a quotation/)
  assert.match(all, /Sentence 4 cites no valid source/)
  assert.match(all, /at least two different outlets/)
})

test('Finnish: inflected names match their stem in the sources, invented names still fail', () => {
  const fi = { ...ctx, lang: 'fi' as const }
  const body = 'Liverpool Echo kertoo Szoboszlain ja Barcolan paluuaikatauluista ennen Brightonin kohtaamista. ' + pad(8)
  const ok = checkRoundup({ headline: 'Myrsky Boelo uhkaa ottelua', sentences: [
    { text: body, sources: ['h1'], paragraph: 1 },
    { text: 'SPORTbible kertoo, että myrsky Boelo uhkaa ottelua.', sources: ['h2'], paragraph: 1 },
  ] }, fi)
  assert.deepEqual(ok.issues, [])
  const bad = checkRoundup({ headline: 'Myrsky Boelo uhkaa ottelua', sentences: [
    { text: `Liverpool Echo kertoo Salahin loukkaantumisesta. ${pad(8)}`, sources: ['h1'], paragraph: 1 },
    { text: 'SPORTbible kertoo, että myrsky Boelo uhkaa ottelua.', sources: ['h2'], paragraph: 1 },
  ] }, fi)
  assert.match(bad.issues.join(' '), /names "Salahin"/)
})
