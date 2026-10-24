// Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkPaper } from '../shared/utils/paper-check.ts'
import type { PaperDraft, PaperSource } from '../shared/types/match-paper.ts'

const sources: PaperSource[] = [
  { id: 'a1', kind: 'article', title: 'Kompany recovery to take weeks', text: 'Vincent Kompany is receiving treatment for a virus and is expected to miss weeks rather than days.', outlet: 'The Guardian', url: 'https://example.com/1', publishedAt: null },
  { id: 'a2', kind: 'article', title: 'Bayern update after Kompany taken to hospital', text: 'Bayern Munich said Kompany was taken to hospital; assistant coaches will lead training.', outlet: 'BBC Sport', url: 'https://example.com/2', publishedAt: null },
  { id: 'f1', kind: 'fact', title: null, text: 'Before kick-off Bayern were first with 14 points and Freiburg third with 13.', outlet: null, url: null, publishedAt: null },
  { id: 'f2', kind: 'fact', title: null, text: 'Bayern scored 3.67 goals per game; Freiburg took 9 points from 3 home games.', outlet: null, url: null, publishedAt: null },
]
const ctx = { sources, names: ['Bayern', 'Freiburg', 'Bundesliga'], lang: 'en' as const }
const filler = (ids: string[], n = 6) => Array.from({ length: n }, () => ({ text: 'Bayern have more goals per game in the table so far this season and that matters.', sources: ids }))

function paper(over: Partial<PaperDraft> = {}): PaperDraft {
  return {
    headline: 'Kompany out for weeks before Freiburg trip',
    standfirst: { text: 'Bayern travel to Freiburg without their coach, The Guardian reports.', sources: ['a1'] },
    sections: [
      { kind: 'team-news', sentences: [
        { text: 'Vincent Kompany is expected to miss weeks while treated for a virus, The Guardian reports.', sources: ['a1'] },
        { text: 'BBC Sport reports that assistant coaches will lead training after he was taken to hospital.', sources: ['a2'] },
      ] },
      { kind: 'home', sentences: [{ text: 'Freiburg took 9 points from 3 home games.', sources: ['f2'] }, ...filler(['f1', 'f2'])] },
      { kind: 'away', sentences: [{ text: 'Bayern lead the table with 14 points and score 3.67 goals per game.', sources: ['f1', 'f2'] }, ...filler(['f1', 'f2'])] },
      { kind: 'insight', sentences: [{ text: 'With Bayern one point ahead on 14, a Freiburg win would take them top.', sources: ['f1'] }, ...filler(['f1', 'f2'])] },
    ],
    ...over,
  }
}

test('a sourced, attributed paper with every required section passes', () => {
  assert.deepEqual(checkPaper(paper(), ctx).issues, [])
})

test('missing sections, unattributed reports, invented names and numbers, and quotes are refused', () => {
  const r = checkPaper(paper({
    standfirst: { text: 'Kompany is out.', sources: ['a1'] },
    sections: [
      { kind: 'team-news', sentences: [
        { text: 'Harry Kane misses the game for 3 weeks, The Guardian reports.', sources: ['a1'] },
        { text: 'The coach said "we will cope" with it.', sources: ['a2'] },
      ] },
      { kind: 'home', sentences: [] },
    ],
  }), ctx)
  const all = r.issues.join(' ')
  assert.equal(r.passed, false)
  assert.match(all, /The standfirst uses an article but does not name its outlet/)
  assert.match(all, /names "Kane"/)
  assert.match(all, /uses "3"/)
  assert.match(all, /contains a quotation/)
  assert.match(all, /section "home" is missing/)
  assert.match(all, /section "insight" is missing/)
})
