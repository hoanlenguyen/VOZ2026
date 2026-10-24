import { lookupMatchNews, type LookupOptions } from '../lib/news/lookup'
import type { NewsMatch } from '../lib/news/input'
import { createTimedNewsCache } from '../lib/news/timed-cache'
import type { MatchNewsResult } from '#shared/types/match-news'
import { SOURCE_POLICY_VERSION } from '../lib/news/source-policy'

/** The cache key includes the teams/date/limit, not just an externally supplied match id. */
const matchNewsCache = createTimedNewsCache<MatchNewsResult>({
  getItem: <T>(key: string) => useStorage('newscache').getItem<T>(key),
  setItem: (key, value, options) => useStorage('newscache').setItem(key, value, options),
}, `news:match-discovery-v5:${SOURCE_POLICY_VERSION}`)

export async function cachedMatchNews(serialized: string, maxAge = 900) {
  return matchNewsCache(serialized, maxAge, async () => {
  const match = JSON.parse(serialized) as NewsMatch
  let candidates: LookupOptions['candidates'] = []
  // Optional historical discovery through the existing key/cache/rate-limit layer.
  if (match.status !== 'live' && useRuntimeConfig().gnewsApiKey) {
    try {
      const to = Math.min(Date.now(), match.kickoff + 2 * 86_400_000)
      const from = match.kickoff - 3 * 86_400_000
      if (to > from) {
        const { data } = await upstream<{ articles?: { url: string, title: string, description?: string, publishedAt?: string }[] }>('gnews', 'search', {
          q: `"${match.home[0]}" AND "${match.away[0]}"`, lang: 'en', max: 10,
          from: new Date(from).toISOString(), to: new Date(to).toISOString(),
        })
        candidates = Array.isArray(data.articles) ? data.articles.filter(a => a && typeof a.url === 'string' && typeof a.title === 'string') : []
      }
    }
    catch { /* Feeds and official indexes work without a search key. */ }
  }
  return lookupMatchNews(match, { candidates })
  })
}
