export default defineEventHandler(async (event) => {
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  // The season list is one cached call; without it the page still shows the match, just no comparison.
  const season = await provider.matches(def, {}).then(r => r.data, () => null)

  // A mock "deep data" match (by its own id or the provider's id of the same game) wins over the
  // provider's thinner record and adds the timeline and line-ups.
  const mock = await findMockMatch(def, id, season ?? [])
  let match: Match
  if (mock) {
    match = mock.match
  }
  else {
    const res = await provider.match(def, id)
    match = res.data
    setDataSource(event, res.source)
  }
  return {
    competition: describeCompetition(def, requestLang(event)),
    match,
    compare: season ? buildCompare(def, match, season) : null,
    extras: mock?.extras ?? null,
  }
})
