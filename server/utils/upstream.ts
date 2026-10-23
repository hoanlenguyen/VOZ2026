import type { H3Event } from 'h3'

// The only place that calls upstream sports APIs. Handles keys, caching, rate limits and the
// snapshot fallback, so providers (server/providers/*) only deal with paths and mapping.

type DataMode = 'live' | 'auto' | 'snapshot'

interface UpstreamDef {
  baseUrl: () => string
  headers: () => Record<string, string>
  /** Cache lifetime for live responses. */
  maxAge: number
  /** At most this many live calls per rolling minute (football-data free plan: 10). */
  perMinute?: number
  transform?: (raw: unknown) => unknown
}

const UPSTREAMS: Record<ProviderId, UpstreamDef> = {
  'liiga': {
    baseUrl: () => useRuntimeConfig().liigaBaseUrl,
    headers: (): Record<string, string> => {
      const key = useRuntimeConfig().liigaApiKey
      return key ? { 'x-api-key': key } : {}
    },
    maxAge: 60,
    transform: fixEncodingDeep,
  },
  'football-data': {
    baseUrl: () => useRuntimeConfig().footballDataBaseUrl,
    headers: (): Record<string, string> => {
      const token = useRuntimeConfig().footballDataToken
      return token ? { 'X-Auth-Token': token } : {}
    },
    maxAge: 300,
    perMinute: 10,
  },
}

export function dataMode(): DataMode {
  const mode = String(useRuntimeConfig().dataMode || 'auto')
  return mode === 'live' || mode === 'snapshot' ? mode : 'auto'
}

// Rolling one-minute window of call times per provider; waits instead of hitting a 429.
const recentCalls: Partial<Record<ProviderId, number[]>> = {}

async function throttle(provider: ProviderId, perMinute: number) {
  const calls = (recentCalls[provider] ??= [])
  for (;;) {
    const now = Date.now()
    while (calls.length && now - calls[0]! > 60_000) calls.shift()
    if (calls.length < perMinute) {
      calls.push(now)
      return
    }
    const wait = 60_000 - (now - calls[0]!) + 50
    if (wait > 20_000) throw new Error(`${provider} rate limit reached; next slot in ${Math.ceil(wait / 1000)} s`)
    await new Promise(resolve => setTimeout(resolve, wait))
  }
}

async function fetchLive(provider: ProviderId, path: string, query: UpstreamQuery): Promise<unknown> {
  const def = UPSTREAMS[provider]
  if (def.perMinute) await throttle(provider, def.perMinute)
  const raw = await $fetch<unknown>(buildUrl(def.baseUrl(), path, query), {
    headers: { accept: 'application/json', ...def.headers() },
    timeout: 15_000,
    retry: 1,
  })
  return def.transform ? def.transform(raw) : raw
}

// Cached per provider + request, so a page load fanning out to many endpoints calls upstream once.
const fetchCached = Object.fromEntries(
  (Object.keys(UPSTREAMS) as ProviderId[]).map(provider => [
    provider,
    defineCachedFunction(
      (path: string, query: UpstreamQuery) => fetchLive(provider, path, query),
      { name: `upstream-${provider}`, maxAge: UPSTREAMS[provider].maxAge, swr: true, getKey: snapshotKey },
    ),
  ]),
) as Record<ProviderId, (path: string, query: UpstreamQuery) => Promise<unknown>>

/** Storage key of a snapshot file: data/snapshots/<provider>/<snapshotKey>. */
export function snapshotStorageKey(provider: ProviderId, path: string, query: UpstreamQuery = {}) {
  return `${provider}:${snapshotKey(path, query)}`
}

/**
 * Fetches a path from an upstream API. In "auto" mode a failed live call falls back to the
 * saved snapshot (scripts/snapshot.ts) so the demo keeps working offline.
 */
export async function upstream<T>(provider: ProviderId, path: string, query: UpstreamQuery = {}): Promise<Sourced<T>> {
  const clean = cleanPath(path)
  if (!isSafePath(clean)) throw createError({ statusCode: 400, statusMessage: 'Invalid upstream path' })
  const mode = dataMode()

  if (mode !== 'snapshot') {
    try {
      return { data: (await fetchCached[provider](clean, query)) as T, source: 'live' }
    }
    catch (err) {
      if (mode === 'live') {
        throw createError({ statusCode: 502, statusMessage: `${provider} API error for ${clean}`, cause: err })
      }
      console.warn(`[upstream] ${provider} live fetch failed for ${clean} (${(err as Error).message}); trying snapshot`)
    }
  }

  const key = snapshotStorageKey(provider, clean, query)
  const snap = await useStorage('snapshots').getItem<T>(key)
  if (snap === null || snap === undefined) {
    throw createError({ statusCode: 503, statusMessage: `No live data and no snapshot for ${key}` })
  }
  return { data: snap, source: 'snapshot' }
}

/** Marks the response with where the data came from, so the UI can show an offline badge. */
export function setDataSource(event: H3Event, ...sources: DataSource[]) {
  setResponseHeader(event, 'x-voz-data-source', sources.includes('snapshot') ? 'snapshot' : 'live')
}
