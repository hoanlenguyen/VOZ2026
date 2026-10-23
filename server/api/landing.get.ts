// Front page: auto-generated stories, fixture ticker and mini tables across sports.
import type { LandingData, Story } from '#shared/types/stories'

const FRONT_PAGE = ['liiga', 'premier-league', 'champions-league', 'la-liga', 'bundesliga', 'serie-a']
const TABLES = ['liiga', 'premier-league']

export default defineEventHandler(async (event): Promise<LandingData> => {
  const sources: DataSource[] = []
  const missing: string[] = []
  const stories: Story[] = []
  const ticker: LandingData['ticker'] = []
  const tables: LandingData['tables'] = []

  await Promise.all(FRONT_PAGE.map(async (id) => {
    const def = findCompetition(id)!
    const provider = providerFor(def)
    if (provider.unavailableReason(def)) return missing.push(def.name)
    try {
      const [matches, standings] = await Promise.all([provider.matches(def, {}), provider.standings(def)])
      sources.push(matches.source, standings.source)
      stories.push(...buildStories(def, matches.data, standings.data))
      ticker.push({
        competitionId: def.id,
        competitionName: def.name,
        emblem: provider.emblem(def) ?? standings.data[0]?.logo ?? null,
        fixtures: matches.data.filter(m => m.status === 'scheduled').slice(0, 10).map(m => ({
          key: m.key,
          start: m.start,
          home: { name: m.home.shortName, logo: m.home.logo },
          away: { name: m.away.shortName, logo: m.away.logo },
        })),
      })
      if (TABLES.includes(id)) tables.push({ competitionId: def.id, competitionName: def.name, rows: standings.data })
    }
    catch (err) {
      console.warn(`[landing] ${id}: ${(err as Error).message}`)
      missing.push(def.name)
    }
  }))

  // Front-page mix: interleave competitions round-robin (each league's stories in weight order,
  // leagues ordered by their best story), so the top slots are not one league's whole round.
  const queues = [...Map.groupBy(stories.sort((a, b) => b.weight - a.weight), s => s.competitionId).values()]
  const ranked: Story[] = []
  while (queues.some(q => q.length)) {
    for (const q of queues) if (q.length) ranked.push(q.shift()!)
  }

  const order = (id: string) => FRONT_PAGE.indexOf(id)
  setDataSource(event, ...sources)
  return {
    generatedAt: new Date().toISOString(),
    stories: ranked,
    ticker: ticker.sort((a, b) => order(a.competitionId) - order(b.competitionId)),
    tables: tables.sort((a, b) => order(a.competitionId) - order(b.competitionId)),
    missing,
  }
})
