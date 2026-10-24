// Simulated matches, newest first. ?competition= one competition id, ?since= ISO time (matches
// generated after it, for pollers), ?limit= at most 100.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const competition = q.competition ? mockSportsCompetition(q.competition).id : undefined
  setResponseHeader(event, 'cache-control', 'no-store')
  return { simulated: true, matches: await listMockMatches({ competition, since: q.since ? String(q.since) : undefined, limit: Number(q.limit) || undefined }) }
})
