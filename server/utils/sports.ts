import type { H3Event } from 'h3'
import type { CompetitionDef } from '#shared/utils/competitions'
import type { SportProvider } from '../providers/types'
import { footballDataProvider } from '../providers/football-data'
import { liigaProvider } from '../providers/liiga'

const PROVIDERS: Record<ProviderId, SportProvider> = {
  'liiga': liigaProvider,
  'football-data': footballDataProvider,
}

export function providerFor(c: CompetitionDef): SportProvider {
  return PROVIDERS[c.provider]
}

export function describeCompetition(c: CompetitionDef): Competition {
  const p = providerFor(c)
  const reason = p.unavailableReason(c)
  return {
    id: c.id,
    sport: c.sport,
    provider: c.provider,
    name: c.name,
    country: c.country,
    emblem: p.emblem(c),
    available: reason === null,
    unavailableReason: reason,
    hasScoringEvents: p.hasScoringEvents,
  }
}

/** Resolves the [competition] route param to a usable competition, or throws 404 / 503. */
export function competitionParam(event: H3Event): { def: CompetitionDef, provider: SportProvider } {
  const def = findCompetition(getRouterParam(event, 'competition'))
  if (!def) throw createError({ statusCode: 404, statusMessage: 'Unknown competition' })
  const provider = providerFor(def)
  const reason = provider.unavailableReason(def)
  if (reason) throw createError({ statusCode: 503, statusMessage: reason })
  return { def, provider }
}
