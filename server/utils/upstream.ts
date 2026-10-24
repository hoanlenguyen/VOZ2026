import type { H3Event } from 'h3'

// The only place that calls upstream APIs (sports data and news). Handles keys, caching, rate
// limits and the snapshot fallback, so providers (server/providers/*) only deal with paths and mapping.

type DataMode = 'live' | 'auto' | 'snapshot'

/** Sports data providers plus non-sport sources such as the GNews headline search. */
export type UpstreamId = ProviderId | 'gnews'

interface UpstreamDef {
  baseUrl: () => string
  headers: () => Record<string, string>
  /** Auth sent as query parameters; added at fetch time so keys never reach cache keys or snapshot names. */
  authQuery?: () => UpstreamQuery
  /** Cache lifetime for live responses. */
  maxAge: number
  /** At most this many live calls per rolling minute (football-data free plan: 10). */
  perMinute?: number
  /** Minimum gap between live calls (GNews rejects bursts). */
  minGapMs?: number
  /** Wait before the single retry (e.g. after a 429). */
  retryDelayMs?: number
  /**
   * Cache in the "kvcache" storage (Workers KV) shared by all Worker instances, instead of per-instance
   * memory. For APIs with per-token quotas. Mind KV's free-plan write budget (1000/day) when setting maxAge.
   */
  sharedCache?: boolean
  transform?: (raw: unknown) => unknown
}

const UPSTREAMS: Record<UpstreamId, UpstreamDef> = {
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
    // 30 min: ~12 cached responses x 48 refreshes/day stays inside KV's free write budget.
    maxAge: 1800,
    perMinute: 10,
    sharedCache: true,
  },
  // Headline search for "What the press says". Free plan: 100 requests/day, so cache for 6 hours.
  'gnews': {
    baseUrl: () => useRuntimeConfig().gnewsBaseUrl,
    headers: () => ({}),
    authQuery: () => ({ apikey: useRuntimeConfig().gnewsApiKey }),
    maxAge: 6 * 3600,
    perMinute: 30,
    minGapMs: 1_100,
    retryDelayMs: 2_000,
    sharedCache: true,
  },
}

export function dataMode(): DataMode {
  const mode = String(useRuntimeConfig().dataMode || 'auto')
  return mode === 'live' || mode === 'snapshot' ? mode : 'auto'
}

// Rolling one-minute window of call times per provider; waits instead of hitting a 429.
const recentCalls: Partial<Record<UpstreamId, number[]>> = {}

async function throttle(provider: UpstreamId, perMinute: number) {
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

const nextSlot: Partial<Record<UpstreamId, number>> = {}

async function spaceOut(provider: UpstreamId, gapMs: number) {
  const now = Date.now()
  const at = Math.max(now, nextSlot[provider] ?? 0)
  nextSlot[provider] = at + gapMs
  if (at > now) await new Promise(resolve => setTimeout(resolve, at - now))
}

async function fetchLive(provider: UpstreamId, path: string, query: UpstreamQuery): Promise<unknown> {
  const def = UPSTREAMS[provider]
  if (def.perMinute) await throttle(provider, def.perMinute)
  if (def.minGapMs) await spaceOut(provider, def.minGapMs)
  const auth = def.authQuery?.() ?? {}
  try {
    const raw = await $fetch<unknown>(buildUrl(def.baseUrl(), path, { ...query, ...auth }), {
      headers: { accept: 'application/json', ...def.headers() },
      timeout: 15_000,
      retry: 1,
      retryDelay: def.retryDelayMs ?? 0,
    })
    return def.transform ? def.transform(raw) : raw
  }
  catch (err) {
    // fetch errors quote the request URL; keep query-string keys out of logs and responses.
    throw new Error(redact((err as Error).message, auth))
  }
}

function redact(message: string, auth: UpstreamQuery): string {
  let out = message
  for (const [k, v] of Object.entries(auth)) {
    if (v) out = out.split(String(v)).join('***').replace(new RegExp(`${k}=[^&\s"]+`, 'g'), `${k}=***`)
  }
  return out
}

// Cached per provider + request, so a page load fanning out to many endpoints calls upstream once.
const fetchCached = Object.fromEntries(
  (Object.keys(UPSTREAMS) as UpstreamId[]).map(provider => [
    provider,
    defineCachedFunction(
      (path: string, query: UpstreamQuery) => fetchLive(provider, path, query),
      {
        name: `upstream-${provider}`,
        maxAge: UPSTREAMS[provider].maxAge,
        swr: true,
        getKey: snapshotKey,
        ...(UPSTREAMS[provider].sharedCache ? { base: 'kvcache' } : {}),
      },
    ),
  ]),
) as Record<UpstreamId, (path: string, query: UpstreamQuery) => Promise<unknown>>

// A match's status/score must not sit behind the 30-minute season/table cache.
// Shared cache and the existing token throttle still apply; no stale-while-revalidate at transitions.
const fetchFootballMatch = defineCachedFunction(
  (path: string, query: UpstreamQuery) => fetchLive('football-data', path, query),
  { name: 'upstream-football-match', base: 'kvcache', maxAge: 60, swr: false, getKey: snapshotKey },
)

/** Storage key of a snapshot file data/snapshots/<provider>/<snapshotKey> (server asset, see nuxt.config). */
export function snapshotStorageKey(provider: UpstreamId, path: string, query: UpstreamQuery = {}) {
  return `${provider}:${snapshotKey(path, query)}`
}

/**
 * Fetches a path from an upstream API. In "auto" mode a failed live call falls back to the
 * saved snapshot (scripts/snapshot.ts) so the demo keeps working offline.
 */
export async function upstream<T>(provider: UpstreamId, path: string, query: UpstreamQuery = {}): Promise<Sourced<T>> {
  const clean = cleanPath(path)
  if (!isSafePath(clean)) throw createError({ statusCode: 400, statusMessage: 'Invalid upstream path' })
  const mode = dataMode()

  if (mode !== 'snapshot') {
    try {
      const data = provider === 'football-data' && /^matches\/\d+$/.test(clean)
        ? await fetchFootballMatch(clean, query) : await fetchCached[provider](clean, query)
      return { data: data as T, source: 'live' }
    }
    catch (err) {
      if (mode === 'live') {
        throw createError({ statusCode: 502, statusMessage: `${provider} API error for ${clean}`, cause: err })
      }
      console.warn(`[upstream] ${provider} live fetch failed for ${clean} (${(err as Error).message}); trying snapshot`)
    }
  }

  const key = snapshotStorageKey(provider, clean, query)
  const snap = await useStorage('assets:snapshots').getItem<T>(key)
  if (snap === null || snap === undefined) {
    throw createError({ statusCode: 503, statusMessage: `No live data and no snapshot for ${key}` })
  }
  return { data: snap, source: 'snapshot' }
}

/** Marks the response with where the data came from, so the UI can show an offline badge. */
export function setDataSource(event: H3Event, ...sources: DataSource[]) {
  setResponseHeader(event, 'x-voz-data-source', sources.includes('snapshot') ? 'snapshot' : 'live')
}
