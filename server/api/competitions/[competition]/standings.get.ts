export default defineEventHandler(async (event) => {
  const { def, provider } = competitionParam(event)
  const { data, source } = await provider.standings(def)
  setDataSource(event, source)
  return { competition: describeCompetition(def), rows: data }
})
