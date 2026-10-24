import { newsSourcePolicy, resolveNewsCompetition } from '../../lib/news/source-policy'
import { NEWS_SOURCES } from '../../lib/news/sources'

/** Public, read-only editorial configuration; request data can never add crawl targets. */
export default defineEventHandler((event) => {
  const raw = getQuery(event).competition
  const competitionId = typeof raw === 'string' ? resolveNewsCompetition(raw) : undefined
  if (!competitionId) throw createError({ statusCode: 400, statusMessage: 'Supply a supported competition, e.g. ?competition=premier-league' })
  const policy = newsSourcePolicy(competitionId)
  return { ...policy, priorities: policy.priorities.map(tier => ({
    priority: tier.priority,
    sources: tier.sources.map(id => {
      if (id === 'official-clubs') return { id, name: 'Registered official sites of the participating clubs', kind: 'club',
        registered: NEWS_SOURCES.filter(s => s.kind === 'club').map(s => ({ id: s.id, name: s.name, team: s.team, hosts: s.hosts })) }
      const source = NEWS_SOURCES.find(s => s.id === id)!
      return { id, name: source.name, kind: source.kind, hosts: source.hosts }
    }),
  })) }
})
