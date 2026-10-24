// Saves the agent's settings { enabled, intervalMinutes, langs }; the next cron tick uses them.
import type { AgentSettings } from '#shared/types/ai-post'

export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  return saveAgentSettings(await readBody<Partial<AgentSettings>>(event))
})
