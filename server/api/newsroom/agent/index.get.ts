// Newsroom agent desk: settings, schedule, last run, SportWorld matches waiting, latest posts.
import type { AgentDesk } from '#shared/types/ai-post'

export default defineEventHandler(async (event): Promise<AgentDesk> => {
  await requireEntitlement(event, 'newsroom')
  setResponseHeader(event, 'cache-control', 'no-store')
  return agentDesk()
})
