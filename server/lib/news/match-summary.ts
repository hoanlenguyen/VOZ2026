import type { MatchNewsDigest, NewsCoverage, NewsItem } from '../../../shared/types/news-coverage.ts'
import { digest, SummaryError, type MatchSynthesisContext, type SummaryArticle, type SummaryConfig, type SummaryEvidence } from './summary.ts'
import { matchStateKey } from './match-policy.ts'
import type { NewsCacheStore } from './timed-cache.ts'

const CONTENT_TTL = 86400_000
const VERSION = 'match-digest-v4'
export type MatchDigestInput = Pick<NewsCoverage, 'match' | 'policy' | 'revision'> & { sources: NewsItem[] }

export function createMatchSummaryService(dependencies: {
  store: NewsCacheStore
  readArticle: (article: SummaryArticle) => Promise<SummaryEvidence>
  generate: (evidence: SummaryEvidence, config: SummaryConfig, context: MatchSynthesisContext) => Promise<string>
  now?: () => number
}) {
  const pending = new Map<string, Promise<MatchNewsDigest>>()
  return async (input: MatchDigestInput, config: SummaryConfig): Promise<MatchNewsDigest> => {
    const now = dependencies.now ?? Date.now
    if (input.match.status === 'live' || input.policy.phase === 'streaming') {
      throw new SummaryError('Live updates are on the match page. News summaries resume with post-match coverage after full time.', 409)
    }
    if (input.policy.phase === 'cancelled' || input.policy.phase === 'postponed') {
      throw new SummaryError(`This match is ${input.policy.phase}. A match summary will be available when its status changes.`, 409)
    }
    const sources = [...new Map([...input.sources].sort((a, b) => (a.sourcePriority ?? 999) - (b.sourcePriority ?? 999))
      .map(source => [source.sourceId ?? source.source, source])).values()].slice(0, 3)
    if (sources.length !== 3) throw new SummaryError('A combined summary needs three verified news sources. More coverage may become available.', 503)
    const identity = JSON.stringify([VERSION, config.provider, config.model, matchStateKey(input.match), input.revision])
    const key = `news:match-summary:${await digest(identity)}`
    const snapshot = await dependencies.store.getItem<MatchNewsDigest>(key)
    if (snapshot && Math.min(Date.parse(snapshot.expiresAt), Date.parse(snapshot.checkedAt) + input.policy.summarySeconds * 1000) > now()) {
      return { ...snapshot, cached: true }
    }
    if (pending.has(key)) return pending.get(key)!
    const request = (async () => {
      const checked = now()
      const documents = await Promise.all(sources.map(source => dependencies.readArticle(source)))
      // Source text is rechecked at the status-dependent interval, but unchanged articles
      // reuse their synthesis instead of paying for a new model call on each preview/reaction refresh.
      const contentKey = `news:match-content:${await digest(JSON.stringify([identity, documents]))}`
      const content = await dependencies.store.getItem<{ summary: string, generatedAt: string, expiresAt: number }>(contentKey)
      let summary: string, generatedAt: string, cached = false
      if (content && content.expiresAt > now()) {
        summary = content.summary
        generatedAt = content.generatedAt
        cached = true
      }
      else {
        const text = documents.map((doc, index) => `SOURCE ${index + 1}: ${doc.source}\nEditorial rank: ${sources[index]?.sourcePriority ?? 'unspecified'}; type: ${sources[index]?.sourceKind ?? 'newsroom'}\nTitle: ${doc.title}\nPublished: ${doc.publishedAt}\n${doc.description}\n${doc.text.slice(0, 3400)}`).join('\n\n')
        const evidence: SummaryEvidence = {
          title: `${input.match.home.name} v ${input.match.away.name}`,
          source: documents.map(doc => doc.source).join(', '),
          publishedAt: new Date(checked).toISOString(),
          description: `Official match data: ${input.match.status}. Kickoff: ${input.match.start}. ${input.match.home.name}: ${input.match.home.score ?? 'score not available'}; ${input.match.away.name}: ${input.match.away.score ?? 'score not available'}.${input.match.status !== 'scheduled' && input.match.home.score !== null && input.match.away.score !== null ? ` Official score: ${input.match.home.score}-${input.match.away.score}.` : ''}`,
          text,
        }
        summary = await dependencies.generate(evidence, config, { phase: input.policy.phase, match: input.match, sourcesCount: documents.length })
        generatedAt = new Date(now()).toISOString()
        await dependencies.store.setItem(contentKey, { summary, generatedAt, expiresAt: now() + CONTENT_TTL }, { ttl: CONTENT_TTL / 1000 })
      }
      const result: MatchNewsDigest = {
        revision: input.revision, phase: input.policy.phase, summary, sources,
        generatedAt, checkedAt: new Date(checked).toISOString(),
        expiresAt: new Date(checked + input.policy.summarySeconds * 1000).toISOString(), cached,
      }
      await dependencies.store.setItem(key, result, { ttl: Math.ceil(input.policy.summarySeconds) })
      return result
    })()
    pending.set(key, request)
    try { return await request } finally { pending.delete(key) }
  }
}
