export type NewsSourceKind = 'league' | 'club' | 'newsroom'

export interface NewsSourceAttribution {
  sourceId?: string
  /** Lower numbers have higher editorial priority in this competition. */
  sourcePriority?: number
  sourceKind?: NewsSourceKind
  contentHash?: string
  assessment?: {
    topic: 'injuries' | 'lineups' | 'suspensions' | 'postponement' | 'players' | 'form' | 'general'
    importance: 0 | 1 | 2 | 3
    certainty: 'confirmed' | 'reported' | 'rumour'
    evidence: string
  }
}

export interface NewsSourceCheck {
  sourceId: string
  source: string
  priority: number
  outcome: 'selected' | 'no-verified-articles' | 'unavailable'
  selected: number
}

export interface NewsSourcePolicy {
  version: string
  competitionId: string | null
  priorities: { priority: number, sources: string[] }[]
}
