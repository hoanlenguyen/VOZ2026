// Front page: auto-generated stories, fixture ticker and mini tables across sports.
import type { LandingData, Story } from '#shared/types/stories'
import type { HeadlineInput } from '../utils/headline-agent'
import type { MockMatch } from '../utils/mock-matches'

const FRONT_PAGE = ['liiga', 'premier-league', 'champions-league', 'la-liga', 'bundesliga', 'serie-a']
const TABLES = ['liiga', 'premier-league']

export default defineEventHandler(async (event): Promise<LandingData> => {
  const lang = requestLang(event)
  const sources: DataSource[] = []
  const missing: string[] = []
  const stories: Story[] = []
  const ticker: LandingData['ticker'] = []
  const tables: LandingData['tables'] = []
  // Story id -> what the AI headline desk needs for it.
  const headlineInputs = new Map<string, HeadlineInput>()

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
      const own = buildStories(def, matches.data.filter(m => !twins.has(m.id)), standings.data, 4, lang)
      const deep = buildStories(def, mocks.map(m => m.match), standings.data, 3650, lang)
      stories.push(...own, ...deep.map(s => ({ ...s, weight: Math.max(s.weight, 0) + 40 })))
      const byKey = new Map(matches.data.map(m => [m.key, { match: m, extras: null as MockMatch['extras'] | null }]))
      for (const mk of mocks) byKey.set(mk.match.key, { match: mk.match, extras: mk.extras })
      for (const s of [...own, ...deep]) {
        const found = byKey.get(s.id.slice(2)) // story ids are "r-<match key>" / "p-<match key>"
        if (found) headlineInputs.set(s.id, { competition: def, ...found, season: matches.data })
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
      if (TABLES.includes(id)) tables.push({ competitionId: def.id, competitionName: name, rows: withMovement(standings.data, matches.data) })
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

  // AI headlines: use every cached one; write the missing ones for the top stories in the
  // background (the page never waits for the model), so the next visit shows them.
  const missingHeadlines: HeadlineInput[] = []
  await Promise.all(ranked.map(async (s, i) => {
    const input = headlineInputs.get(s.id)
    if (!input) return
    const h = await cachedHeadline(input, lang)
    if (h) ranked[i] = { ...s, headline: h.headline, subtitle: h.subtitle, headlineOrigin: 'agent' }
    else missingHeadlines[i] = input
  }))
  warmHeadlines(event, missingHeadlines.filter(Boolean), lang)

  // Stories an editor hid in the newsroom dashboard are left out for readers. The dashboard itself
  // asks with ?moderation=all to see them too (newsroom accounts only).
  const showAll = getQuery(event).moderation === 'all' && (await sessionInfo(event)).entitlements.newsroom
  const [hidden, controls, engagement] = await Promise.all([showAll ? new Set<string>() : hiddenStories(), storyControls(lang), engagementMap()])

  // Matches with a match story lead with it, as their match page does: the story's headline and
  // opening lines (the published version, from the cache only), no AI subtitle. Cover images the
  // newsroom set replace the cards' data visual.
  const shown = await Promise.all(ranked.filter(s => !hidden.has(s.id)).map(async (s) => {
    const key = s.id.slice(2)
    const control = controls[key] ?? null
    const cover = coverOf(control)
    const input = s.kind === 'result' ? headlineInputs.get(s.id) : undefined
    const published = input?.extras ? await publishedMatchStory(input.competition, input.match, input.extras, input.season, control, lang) : null
    return {
      ...s,
      ...(published && { headline: published.headline, summary: published.text, subtitle: undefined, headlineOrigin: published.origin === 'ai' ? 'agent' as const : 'template' as const }),
      ...(cover && { cover: { src: cover.src, alt: cover.alt } }),
      ...(engagement[key] && { engagement: engagement[key] }),
    }
  }))
  const order = (id: string) => FRONT_PAGE.indexOf(id)
  setDataSource(event, ...sources)
  return {
    generatedAt: new Date().toISOString(),
    stories: shown,
    ticker: ticker.sort((a, b) => order(a.competitionId) - order(b.competitionId)),
    tables: tables.sort((a, b) => order(a.competitionId) - order(b.competitionId)),
    missing,
  }
})
