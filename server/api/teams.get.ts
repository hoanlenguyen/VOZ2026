// The league's teams with logo and home town, for onboarding.
export default defineEventHandler(async (event) => {
  const season = currentSeason()
  const { data, source } = await liiga<{ teams: Array<{ id: string, logos?: { darkBg?: string | null } }> }>(
    'teams', { season, serie: currentSerie() },
  )
  setDataSource(event, source)

  const items: TeamListItem[] = []
  for (const raw of data.teams) {
    const info = findTeam(raw.id)
    if (!info) continue
    items.push({ id: raw.id, slug: info.slug, name: info.name, abbr: info.abbr, town: info.town, logo: raw.logos?.darkBg ?? null })
  }
  return { season, teams: items.sort((a, b) => a.name.localeCompare(b.name, 'fi')) }
})
