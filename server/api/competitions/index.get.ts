// All competitions VOZ covers, grouped by nothing: the UI groups by sport.
export default defineEventHandler((event) => {
  const lang = requestLang(event)
  return { competitions: COMPETITIONS.map(c => describeCompetition(c, lang)) }
})
