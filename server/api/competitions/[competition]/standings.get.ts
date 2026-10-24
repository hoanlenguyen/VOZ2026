export default defineEventHandler(async (event) => {
  const { def, provider } = competitionParam(event)
  const [{ data, source }, season] = await Promise.all([provider.standings(def), provider.matches(def, {}).then(r => r.data, () => [])])
  setDataSource(event, source)
  // Each row carries its movement since the team's last game (server/utils/standings-movement.ts).
  return { competition: describeCompetition(def, requestLang(event)), rows: withMovement(data, season) }
})
