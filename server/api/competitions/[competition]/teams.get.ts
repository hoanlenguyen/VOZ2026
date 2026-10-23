export default defineEventHandler(async (event) => {
  const { def, provider } = competitionParam(event)
  const { data, source } = await provider.teams(def)
  setDataSource(event, source)
  return { competition: describeCompetition(def), teams: data }
})
