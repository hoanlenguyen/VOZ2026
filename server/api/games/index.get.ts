// Regular-season games, optionally filtered by team slug and state.
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const season = Number(q.season) || currentSeason()
  const team = typeof q.team === 'string' ? findTeam(q.team) : undefined
  if (q.team && !team) throw createError({ statusCode: 404, statusMessage: `Unknown team ${q.team}` })

  const { data, source } = await liiga<{ games: RawGame[] }>('games', { season })
  setDataSource(event, source)

  const serie = currentSerie().toUpperCase()
  let games = data.games.filter(g => g.serie === serie).map(normalizeGame)
  if (team) games = games.filter(g => g.home.slug === team.slug || g.away.slug === team.slug)
  if (q.state === 'ended') games = games.filter(g => g.ended)
  if (q.state === 'upcoming') games = games.filter(g => !g.started)

  return { season, count: games.length, games: games.sort((a, b) => a.start.localeCompare(b.start)) }
})
