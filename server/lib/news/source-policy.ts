import { COMPETITIONS } from '../../../shared/utils/competitions.ts'
import type { NewsSourceAttribution, NewsSourcePolicy } from '../../../shared/types/news-source.ts'
import { NEWS_SOURCES, type NewsSource } from './sources.ts'

// Bump whenever membership, ordering or selection rules change: all discovery caches use it.
export const SOURCE_POLICY_VERSION = 'league-sources-v2'
const FOOTBALL = ['official-clubs', 'bbc-sport', 'sky-sports', 'guardian']
const FINLAND = ['official-clubs', 'yle', 'mtv']
export const LEAGUE_SOURCE_PRIORITIES: Record<string, readonly string[]> = {
  'premier-league': ['premier-league', ...FOOTBALL],
  championship: ['efl', ...FOOTBALL],
  'la-liga': ['la-liga', ...FOOTBALL],
  bundesliga: ['bundesliga', ...FOOTBALL],
  'serie-a': ['serie-a', ...FOOTBALL],
  'ligue-1': ['ligue-1', ...FOOTBALL],
  eredivisie: ['eredivisie', ...FOOTBALL],
  'primeira-liga': ['liga-portugal', ...FOOTBALL],
  'champions-league': ['uefa', ...FOOTBALL],
  liiga: ['liiga', ...FINLAND],
  veikkausliiga: ['veikkausliiga', ...FINLAND],
}

const key = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
export function resolveNewsCompetition(value: string): string | undefined {
  const aliases: Record<string, string> = { epl: 'premier-league', englishpremierleague: 'premier-league', eflchampionship: 'championship', uefachampionsleague: 'champions-league', ligaportugal: 'primeira-liga' }
  const alias = aliases[key(value)]
  return typeof alias === 'string' ? alias : COMPETITIONS.find(c => [c.id, c.name, c.providerCode].some(name => key(name) === key(value)))?.id
}

export function newsSourcePolicy(competitionId?: string): NewsSourcePolicy {
  if (competitionId && !Object.hasOwn(LEAGUE_SOURCE_PRIORITIES, competitionId)) throw new Error('Unsupported news competition')
  // With no league, avoid guessing an official authority or sport. Legacy JSON uses newsrooms.
  const order = competitionId ? LEAGUE_SOURCE_PRIORITIES[competitionId]! : ['bbc-sport', 'sky-sports', 'guardian']
  return { version: SOURCE_POLICY_VERSION, competitionId: competitionId ?? null, priorities: order.map((id, i) => ({ priority: i + 1, sources: [id] })) }
}

export interface RankedNewsSource { source: NewsSource, priority: number }

/** Entirely server-owned. A club is eligible only for its own team's match. */
export function rankedNewsSources(competitionId: string | undefined, teamNames: string[], overrides?: NewsSource[]): RankedNewsSource[] {
  const names = teamNames.map(key)
  const eligible = (source: NewsSource) => !source.team || names.includes(key(source.team))
  // Explicit dependency injection is for offline fixtures, never request data.
  if (overrides && overrides.every(s => !s.id)) return overrides.filter(eligible).map((source, i) => ({ source, priority: i + 1 }))
  const sources = overrides ?? NEWS_SOURCES
  return newsSourcePolicy(competitionId).priorities.flatMap(tier => sources.filter(source => eligible(source)
    && (tier.sources.includes(source.id ?? '') || tier.sources.includes('official-clubs') && source.kind === 'club' && !!source.team))
    .sort((a, b) => (a.id ?? a.name).localeCompare(b.id ?? b.name))
    .map(source => ({ source, priority: tier.priority })))
}

export function sourceAttribution({ source, priority }: RankedNewsSource): NewsSourceAttribution {
  return { sourceId: source.id ?? source.name, sourcePriority: priority, sourceKind: source.kind ?? (source.team ? 'club' : 'newsroom') }
}
