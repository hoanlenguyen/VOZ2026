// Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agentDue, cleanAgentSettings, DEFAULT_AGENT_SETTINGS, nextAgentRun, postText, storyParagraphs, textParagraphs } from '../shared/utils/newsroom-agent.ts'

const at = (iso: string) => new Date(iso)
const every15 = { enabled: true, intervalMinutes: 15, langs: ['en'] as const }

test('a never-run agent is due at once; a disabled one never', () => {
  assert.equal(agentDue({ ...every15, langs: ['en'] }, null, at('2026-10-24T12:00:00Z')), true)
  assert.equal(agentDue({ ...every15, langs: ['en'], enabled: false }, null, at('2026-10-24T12:00:00Z')), false)
  assert.equal(nextAgentRun({ ...every15, langs: ['en'], enabled: false }, null, at('2026-10-24T12:00:00Z')), null)
})

test('runs once the interval has passed, allowing a late cron tick', () => {
  const s = { ...every15, langs: ['en' as const] }
  const last = '2026-10-24T12:00:04Z'
  assert.equal(agentDue(s, last, at('2026-10-24T12:10:00Z')), false)
  // The 12:15 tick arrives a few seconds before last + 15 min: still due.
  assert.equal(agentDue(s, last, at('2026-10-24T12:15:01Z')), true)
  assert.equal(nextAgentRun(s, last, at('2026-10-24T12:05:00Z'))!.toISOString(), '2026-10-24T12:15:00.000Z')
})

test('settings from input keep only known values', () => {
  assert.deepEqual(cleanAgentSettings({ enabled: false, intervalMinutes: 7, langs: ['fi', 'xx' as 'en'] }), { enabled: false, intervalMinutes: DEFAULT_AGENT_SETTINGS.intervalMinutes, langs: ['fi'] })
  assert.deepEqual(cleanAgentSettings(null), DEFAULT_AGENT_SETTINGS)
  assert.deepEqual(cleanAgentSettings({ intervalMinutes: 60, langs: [] }).langs, DEFAULT_AGENT_SETTINGS.langs)
})

test('readers get the edit, else the AI story, in their language or the next one', () => {
  const story = (lang: 'en' | 'fi') => ({ headline: `AI ${lang}`, sentences: [
    { text: 'One.', facts: ['f1'], paragraph: 1 }, { text: 'Two.', facts: ['f2'], paragraph: 1 }, { text: 'Three.', facts: ['f3'], paragraph: 2 },
  ] })
  const post = { stories: { en: story('en'), fi: story('fi') } } as unknown as Parameters<typeof postText>[0]
  assert.deepEqual(postText(post, 'fi'), { lang: 'fi', headline: 'AI fi', paragraphs: ['One. Two.', 'Three.'], edited: false })
  const edited = { ...post, edits: { fi: { headline: 'Edited', paragraphs: ['Text.'], by: 'Ed', at: '' } } }
  assert.deepEqual(postText(edited, 'fi'), { lang: 'fi', headline: 'Edited', paragraphs: ['Text.'], edited: true })
  assert.equal(postText(edited, 'en')!.headline, 'AI en')
  const enOnly = { stories: { en: story('en') } } as unknown as Parameters<typeof postText>[0]
  assert.equal(postText(enOnly, 'fi')!.lang, 'en')
  assert.equal(postText({ stories: {} }, 'en'), null)
})

test('edited text splits into paragraphs on blank lines', () => {
  assert.deepEqual(textParagraphs('First  line\nstill first.\r\n\r\n\n  Second.  \n\n'), ['First line still first.', 'Second.'])
  assert.deepEqual(storyParagraphs({ sentences: [{ text: 'A.', facts: [], paragraph: 2 }] }), ['A.'])
})
