// Simulates 1–2 new matches: { competition = 'premier-league', count = random 1 or 2 }. `matches` are
// the full match files, in the structure of data/mock/<competition>/<id>.json (as GET /matches/:id).
export default defineEventHandler(async (event) => {
  const body = await readBody<{ competition?: string, count?: number }>(event).catch(() => null) ?? {}
  const c = mockSportsCompetition(body.competition ?? 'premier-league')
  const count = body.count === 1 || body.count === 2 ? body.count : 1 + Math.floor(Math.random() * 2)
  return { simulated: true, requested: count, matches: await generateMockMatches(c, count) }
})
