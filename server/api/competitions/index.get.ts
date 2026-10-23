// All competitions VOZ covers, grouped by nothing: the UI groups by sport.
export default defineEventHandler(() => ({ competitions: COMPETITIONS.map(describeCompetition) }))
