// Newsroom podcast desk: the daily schedule, the teams and leagues it can cover, the last run.
import type { PodcastDesk } from '#shared/types/podcast'

export default defineEventHandler(async (event): Promise<PodcastDesk> => {
  await requireEntitlement(event, 'newsroom')
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const [schedule, options, lastRun] = await Promise.all([podcastSchedule(), subjectOptions(requestLang(event)), lastPodcastRun()])
  return { schedule, options, lastRun, cron: PODCAST_CRON }
})
