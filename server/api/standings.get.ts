export default defineEventHandler(async (event) => {
  const season = Number(getQuery(event).season) || currentSeason()
  const serie = currentSerie()
  const { data, source } = await liiga<{ items: RawStanding[], playoffsLines?: unknown }>(
    `standings/${serie}`, { season },
  )
  setDataSource(event, source)
  return {
    season,
    serie,
    rows: data.items.map(normalizeStanding).sort((a, b) => a.rank - b.rank),
    playoffsLines: data.playoffsLines ?? null,
  }
})
