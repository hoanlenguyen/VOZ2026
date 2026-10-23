// The competitions VOZ covers. Adding a league from an existing provider is one entry here.

import type { ProviderId, SportId } from '../types/sports.ts'

export interface CompetitionDef {
  id: string
  sport: SportId
  provider: ProviderId
  /** The provider's own code: Liiga serie, or football-data competition code. */
  providerCode: string
  name: string
  country: string
  /** football-data plan needed; the free plan is TIER_ONE. */
  tier?: 'TIER_ONE' | 'TIER_TWO' | 'TIER_THREE' | 'TIER_FOUR'
}

export const COMPETITIONS: CompetitionDef[] = [
  { id: 'liiga', sport: 'hockey', provider: 'liiga', providerCode: 'runkosarja', name: 'Liiga', country: 'Finland' },

  { id: 'veikkausliiga', sport: 'football', provider: 'football-data', providerCode: 'VEI', name: 'Veikkausliiga', country: 'Finland', tier: 'TIER_THREE' },
  { id: 'premier-league', sport: 'football', provider: 'football-data', providerCode: 'PL', name: 'Premier League', country: 'England', tier: 'TIER_ONE' },
  { id: 'championship', sport: 'football', provider: 'football-data', providerCode: 'ELC', name: 'Championship', country: 'England', tier: 'TIER_ONE' },
  { id: 'la-liga', sport: 'football', provider: 'football-data', providerCode: 'PD', name: 'LaLiga', country: 'Spain', tier: 'TIER_ONE' },
  { id: 'bundesliga', sport: 'football', provider: 'football-data', providerCode: 'BL1', name: 'Bundesliga', country: 'Germany', tier: 'TIER_ONE' },
  { id: 'serie-a', sport: 'football', provider: 'football-data', providerCode: 'SA', name: 'Serie A', country: 'Italy', tier: 'TIER_ONE' },
  { id: 'ligue-1', sport: 'football', provider: 'football-data', providerCode: 'FL1', name: 'Ligue 1', country: 'France', tier: 'TIER_ONE' },
  { id: 'eredivisie', sport: 'football', provider: 'football-data', providerCode: 'DED', name: 'Eredivisie', country: 'Netherlands', tier: 'TIER_ONE' },
  { id: 'primeira-liga', sport: 'football', provider: 'football-data', providerCode: 'PPL', name: 'Primeira Liga', country: 'Portugal', tier: 'TIER_ONE' },
  { id: 'champions-league', sport: 'football', provider: 'football-data', providerCode: 'CL', name: 'Champions League', country: 'Europe', tier: 'TIER_ONE' },
]

export function findCompetition(id: string | null | undefined): CompetitionDef | undefined {
  return COMPETITIONS.find(c => c.id === id)
}

/** Splits "<competition>:<rest>" keys used for teams and matches. */
export function splitKey(key: string): { competitionId: string, id: string } {
  const i = key.indexOf(':')
  return i < 0 ? { competitionId: '', id: key } : { competitionId: key.slice(0, i), id: key.slice(i + 1) }
}
