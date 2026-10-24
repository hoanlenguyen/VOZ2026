// Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkHeadline } from '../shared/utils/headline-check.ts'
import type { Fact } from '../shared/types/story.ts'

const facts: Fact[] = [
  { id: 'f1', section: 'result', text: 'Premier League matchweek 8: Ipswich Town 1–2 Nottingham Forest (full time).' },
  { id: 'f2', section: 'timeline', text: "88' Nott'm Forest goal: Chris Wood, making it 1–2." },
  { id: 'f3', section: 'edge', text: "Nott'm Forest came from behind: they trailed 0–1 after the first half and won." },
  { id: 'f4', section: 'edge', text: "Nott'm Forest had won their last 3 Premier League games in a row before this match." },
  { id: 'f5', section: 'edge', text: "Before kick-off Ipswich were 15th and Nott'm Forest 4th in the Premier League table (counted from results, 20 teams)." },
  { id: 'f6', section: 'edge', text: 'Chris Wood scored the decisive goal late in the match, at 88\'.' },
]
const ctx = {
  facts,
  names: ['Chris Wood', 'Liam Delap'],
  teams: ['Ipswich', "Nott'm Forest", 'Ipswich Town', 'Nottingham Forest'],
  lang: 'en' as const,
}
const ok = {
  headline: "Wood's late strike completes Nott'm Forest fightback at Ipswich",
  subtitle: "Trailing 0–1 at the break, Forest turned it around and won 2–1, with Chris Wood striking in the 88th minute.",
  facts: ['f1', 'f2', 'f3', 'f6'],
}

test('a lively headline backed by its cited facts passes', () => {
  const r = checkHeadline(ok, ctx)
  assert.equal(r.passed, true, r.issues.join('\n'))
  assert.equal(r.factsUsed, 4)
})

test('a number not in the cited facts fails', () => {
  const r = checkHeadline({ ...ok, subtitle: `${ok.subtitle} It was their 5th straight away win.` }, ctx)
  assert.equal(r.passed, false)
  assert.match(r.issues.join(' '), /"5"/)
})

test('a person not in the cited facts fails', () => {
  const r = checkHeadline({ ...ok, subtitle: 'Liam Delap could not stop Forest turning a 0–1 deficit into a 2–1 win at Portman Road.' }, ctx)
  assert.match(r.issues.join(' '), /Liam Delap/)
})

test('a claim needs a cited fact that makes it', () => {
  const r = checkHeadline({ ...ok, headline: "Nott'm Forest extend winning streak at Ipswich", facts: ['f1', 'f2', 'f3', 'f6'] }, ctx)
  assert.match(r.issues.join(' '), /a streak/)
  const cited = checkHeadline({ ...ok, headline: "Nott'm Forest extend winning streak at Ipswich", facts: ['f1', 'f2', 'f3', 'f4', 'f6'] }, ctx)
  assert.equal(cited.passed, true, cited.issues.join('\n'))
})

test('history before this season is refused', () => {
  const r = checkHeadline({ ...ok, headline: "Nott'm Forest make history at Ipswich" }, ctx)
  assert.match(r.issues.join(' '), /history/)
})

test('a comeback needs the came-from-behind fact', () => {
  const r = checkHeadline({ ...ok, facts: ['f1', 'f2', 'f6'] }, ctx)
  assert.match(r.issues.join(' '), /comeback|"0"/)
})

test('clickbait, questions and extra exclamation marks fail', () => {
  assert.match(checkHeadline({ ...ok, headline: "You won't believe what Nott'm Forest did" }, ctx).issues.join(' '), /clickbait/)
  assert.match(checkHeadline({ ...ok, headline: "Can anyone stop Nott'm Forest now?" }, ctx).issues.join(' '), /question/)
  assert.match(checkHeadline({ ...ok, headline: "Nott'm Forest win at Ipswich!", subtitle: `${ok.subtitle}!` }, ctx).issues.join(' '), /exclamation/)
})

test('quotes and speech are refused', () => {
  const r = checkHeadline({ ...ok, headline: "\"Never in doubt\" for Nott'm Forest at Ipswich" }, ctx)
  assert.match(r.issues.join(' '), /quotation/)
})

test('at least one team must be named as written', () => {
  const r = checkHeadline({ ...ok, headline: 'Wood strikes late to win it on the road' }, { ...ctx, teams: ['Ipswich Town FC', 'Nottingham Forest FC'] })
  assert.match(r.issues.join(' '), /Name at least one team/)
})

test('length limits apply to the headline and the subtitle', () => {
  const r = checkHeadline({ ...ok, headline: "Forest", subtitle: "Nott'm Forest won." }, ctx)
  assert.match(r.issues.join(' '), /headline has 1 words/)
  assert.match(r.issues.join(' '), /subtitle has 3 words/)
})

test('Finnish: number words and claims are checked too', () => {
  const fi = { ...ctx, lang: 'fi' as const }
  const pass = checkHeadline({ headline: "Nott'm Forest kiri voittoon Ipswichissä", subtitle: "Nott'm Forest oli tauolla tappiolla 0–1, mutta Chris Wood ratkaisi ottelun 88. minuutilla lukemiin 1–2.", facts: ['f1', 'f2', 'f3', 'f6'] }, fi)
  assert.equal(pass.passed, true, pass.issues.join('\n'))
  assert.match(checkHeadline({ ...ok, subtitle: "Nott'm Forest voitti viisi peliä peräkkäin ja nousi kärkeen Ipswichiä vastaan.", facts: ['f1'] }, fi).issues.join(' '), /"5"/)
  assert.match(checkHeadline({ ...ok, headline: "Nott'm Forest teki ennätyksen Ipswichissä" }, fi).issues.join(' '), /a record/)
})
