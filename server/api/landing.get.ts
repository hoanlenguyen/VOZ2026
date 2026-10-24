// Front page: auto-generated stories, fixture ticker and mini tables across sports.
import type { LandingData, Story, StoryEdit } from '#shared/types/stories'

const FRONT_PAGE = ['liiga', 'premier-league', 'champions-league', 'la-liga', 'bundesliga', 'serie-a']
const TABLES = ['liiga', 'premier-league']

export default defineEventHandler(async (event): Promise<LandingData> => {
  const lang = requestLang(event)
  const sources: DataSource[] = []
  const missing: string[] = []
  const stories: Story[] = []
  const ticker: LandingData['ticker'] = []
  const tables: LandingData['tables'] = []

  await Promise.all(FRONT_PAGE.map(async (id) => {
    const def = findCompetition(id)!
    const provider = providerFor(def)
    const name = competitionName(def, lang)
    if (provider.unavailableReason(def)) return missing.push(name)
    try {
      const [matches, standings] = await Promise.all([provider.matches(def, {}), provider.standings(def)])
      sources.push(matches.source, standings.source)
      // Mock "deep data" matches replace the provider's record of the same game, stay on the front
      // page regardless of age (demo), and lead their league: they are the richest coverage we have.
      const mocks = await mockMatchesFor(def, matches.data)
      const twins = new Set(mocks.map(m => m.providerId).filter(Boolean))
      stories.push(...buildStories(def, matches.data.filter(m => !twins.has(m.id)), standings.data, 4, lang))
      for (const s of buildStories(def, mocks.map(m => m.match), standings.data, 3650, lang)) {
        stories.push({ ...s, weight: Math.max(s.weight, 0) + 40 })
      }
      ticker.push({
        competitionId: def.id,
        competitionName: name,
        sport: def.sport,
        country: competitionCountry(def, lang),
        emblem: provider.emblem(def),
        fixtures: matches.data.filter(m => m.status === 'scheduled').slice(0, 12).map(m => ({
          key: m.key,
          href: `/match/${def.id}/${m.id}`,
          start: m.start,
          home: { name: m.home.shortName, logo: m.home.logo },
          away: { name: m.away.shortName, logo: m.away.logo },
        })),
      })
      if (TABLES.includes(id)) tables.push({ competitionId: def.id, competitionName: name, rows: standings.data })
    }
    catch (err) {
      console.warn(`[landing] ${id}: ${(err as Error).message}`)
      missing.push(name)
    }
  }))

  // Front-page mix: interleave competitions round-robin (each league's stories in weight order,
  // leagues ordered by their best story), so the top slots are not one league's whole round.
  const queues = [...Map.groupBy(stories.sort((a, b) => b.weight - a.weight), s => s.competitionId).values()]
  const ranked: Story[] = []
  while (queues.some(q => q.length)) {
    for (const q of queues) if (q.length) ranked.push(q.shift()!)
  }

  // Stories an editor hid in the newsroom dashboard are left out for readers. The dashboard itself
  // asks with ?moderation=all to see them too (newsroom accounts only).
  const showAll = getQuery(event).moderation === 'all' && (await sessionInfo(event)).entitlements.newsroom
  // The story editor also asks with ?edits=off for the generated text it can revert to.
  const raw = showAll && getQuery(event).edits === 'off'
  const [hidden, edits] = await Promise.all([showAll ? new Set<string>() : hiddenStories(), raw ? {} as Record<string, StoryEdit> : storyEdits(lang)])
  const order = (id: string) => FRONT_PAGE.indexOf(id)
  setDataSource(event, ...sources)
  return {
    generatedAt: new Date().toISOString(),
    // Newsroom edits replace the generated headline and summary (per language).
    stories: ranked.filter(s => !hidden.has(s.id)).map((s) => {
      const e = edits[s.id]
      return e ? { ...s, headline: e.headline, summary: e.summary || s.summary, edited: { by: e.by, at: e.at, audience: e.audience } } : s
    }),
    ticker: ticker.sort((a, b) => order(a.competitionId) - order(b.competitionId)),
    tables: tables.sort((a, b) => order(a.competitionId) - order(b.competitionId)),
    missing,
  }
})
