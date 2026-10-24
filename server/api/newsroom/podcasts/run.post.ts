// Runs the daily podcasts now (newsroom), as the scheduled task does every morning.
export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  return runDailyPodcasts('newsroom')
})
