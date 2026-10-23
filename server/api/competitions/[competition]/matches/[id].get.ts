export default defineEventHandler(async (event) => {
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  const { data, source } = await provider.match(def, id)
  setDataSource(event, source)
  return { competition: describeCompetition(def), match: data }
})
