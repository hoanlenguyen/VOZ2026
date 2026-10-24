// Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { agentDue, cleanAgentSettings, DEFAULT_AGENT_SETTINGS, nextAgentRun } from '../shared/utils/newsroom-agent.ts'

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
