// Discovery only: match coverage and three recent updates for each team. No AI calls here.
export default defineEventHandler(async (event) => {
  const match = await resolveNewsMatch(event)
  // Do not allow a browser cache to conceal an official phase or score transition.
  setResponseHeader(event, 'cache-control', 'no-store')
  return newsCoverageForMatch(match)
})
