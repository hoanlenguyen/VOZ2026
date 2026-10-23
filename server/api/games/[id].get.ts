// One game: normalised summary plus the raw stats payload (used by the fact ledger in Phase 1).
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid game id' })
  const season = Number(getQuery(event).season) || currentSeason()

  const [details, stats] = await Promise.all([
    liiga<{ game: RawGame }>(`games/${season}/${id}`),
    liiga<unknown>(`games/${season}/${id}/stats`).catch(() => null),
  ])
  setDataSource(event, details.source, ...(stats ? [stats.source] : []))

  return { game: normalizeGame(details.data.game), stats: stats?.data ?? null }
})
