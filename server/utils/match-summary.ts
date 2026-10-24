import type { NewsCoverage } from '#shared/types/news-coverage'
import { createMatchSummaryService } from '../lib/news/match-summary'
import { generateNewsSummary } from '../lib/news/summary'
import { readNewsSummaryEvidence, newsSummaryConfig } from './news-summary'

const matchDigest = createMatchSummaryService({
  store: {
    getItem: <T>(key: string) => useStorage('newscache').getItem<T>(key),
    setItem: (key, value, options) => useStorage('newscache').setItem(key, value, options),
  },
  readArticle: readNewsSummaryEvidence,
  generate: (evidence, config, context) => generateNewsSummary(evidence, config, fetch, context),
})

export async function summarizeMatchCoverage(coverage: NewsCoverage) {
  return matchDigest({ ...coverage, sources: coverage.groups.find(group => group.key === 'match')?.articles ?? [] }, newsSummaryConfig())
}
