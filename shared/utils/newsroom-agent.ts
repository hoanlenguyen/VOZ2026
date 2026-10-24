// Newsroom agent schedule: the cron ticks every AGENT_CRON; a tick runs the agent only when it is
// enabled and the newsroom's interval has passed since the last run. Pure, tested in tests/.

import type { AgentSettings } from '../types/ai-post.ts'
import type { Lang } from './format.ts'

/** Keep in step with wrangler.jsonc triggers.crons and nuxt.config nitro.scheduledTasks. */
export const AGENT_CRON = '*/5 * * * *'
export const AGENT_TICK_MINUTES = 5
export const INTERVAL_OPTIONS = [5, 10, 15, 30, 60, 180, 360, 720, 1440]
export const DEFAULT_AGENT_SETTINGS: AgentSettings = { enabled: true, intervalMinutes: 15, langs: ['en', 'fi'] }
/** Matches written per run; each takes one agent run per language (~10–20 s). */
export const AGENT_MATCHES_PER_RUN = 2

/** Settings from untrusted input: unknown values fall back to the defaults. */
export function cleanAgentSettings(input: Partial<AgentSettings> | null | undefined): AgentSettings {
  const langs = (['en', 'fi'] as Lang[]).filter(l => input?.langs?.includes(l))
  return {
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : DEFAULT_AGENT_SETTINGS.enabled,
    intervalMinutes: INTERVAL_OPTIONS.includes(Number(input?.intervalMinutes)) ? Number(input!.intervalMinutes) : DEFAULT_AGENT_SETTINGS.intervalMinutes,
    langs: langs.length ? langs : [...DEFAULT_AGENT_SETTINGS.langs],
  }
}

// One minute of slack: cron ticks arrive a few seconds late, so an exact interval would skip a tick.
const dueAt = (settings: AgentSettings, lastRunAt: string) => Date.parse(lastRunAt) + (settings.intervalMinutes - 1) * 60_000

export function agentDue(settings: AgentSettings, lastRunAt: string | null, now: Date): boolean {
  if (!settings.enabled) return false
  return !lastRunAt || now.getTime() >= dueAt(settings, lastRunAt)
}

/** The cron tick that will start the next scheduled run (null = disabled). */
export function nextAgentRun(settings: AgentSettings, lastRunAt: string | null, now: Date): Date | null {
  if (!settings.enabled) return null
  const due = lastRunAt ? Math.max(now.getTime(), dueAt(settings, lastRunAt)) : now.getTime()
  const tick = AGENT_TICK_MINUTES * 60_000
  return new Date(Math.ceil(due / tick) * tick)
}
