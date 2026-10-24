// Current-season matches; ?team=<team key> and ?state=finished|upcoming filter them.
export default defineEventHandler(async (event) => {
  const { def, provider } = competitionParam(event)
  const q = getQuery(event)
  const teamKey = typeof q.team === 'string' ? q.team : undefined
  const state = q.state === 'finished' || q.state === 'upcoming' ? q.state : undefined
  const { data, source } = await provider.matches(def, { teamKey, state })
  setDataSource(event, source)
  return { competition: describeCompetition(def, requestLang(event)), count: data.length, matches: data }
})
