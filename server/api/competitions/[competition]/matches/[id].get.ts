export default defineEventHandler(async (event) => {
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  const { data, source } = await provider.match(def, id)
  setDataSource(event, source)
  // The season list is one cached call; without it the page still shows the match, just no comparison.
  const season = await provider.matches(def, {}).then(r => r.data, () => null)
  return {
    competition: describeCompetition(def),
    match: data,
    compare: season ? buildCompare(def, data, season) : null,
    commentary: matchCommentary(data),
  }
})
