// Public totals of the match discussion: visible comments and likes on the story.
export default defineEventHandler(async (event) => {
  return engagementOf(await loadThread(await routeMatchKey(event)))
})
