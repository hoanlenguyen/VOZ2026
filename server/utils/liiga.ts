import type { H3Event } from 'h3'

type DataMode = 'live' | 'auto' | 'snapshot'

export interface LiigaResult<T> {
  data: T
  source: 'live' | 'snapshot'
}

function dataMode(): DataMode {
  const mode = String(useRuntimeConfig().dataMode || 'auto')
  return mode === 'live' || mode === 'snapshot' ? mode : 'auto'
}

async function readSnapshot<T>(key: string): Promise<T | null> {
  return (await useStorage('snapshots').getItem<T>(key)) ?? null
}

async function fetchLive(path: string, query: LiigaQuery): Promise<unknown> {
  const config = useRuntimeConfig()
  const headers: Record<string, string> = { accept: 'application/json' }
  if (config.liigaApiKey) headers['x-api-key'] = config.liigaApiKey
  const raw = await $fetch<unknown>(buildLiigaUrl(config.liigaBaseUrl, path, query), {
    headers,
    timeout: 15_000,
    retry: 1,
  })
  return fixEncodingDeep(raw)
}

// Short-lived cache so a page load fanning out to many endpoints hits Liiga once per request.
const fetchLiveCached = defineCachedFunction(
  (path: string, query: LiigaQuery) => fetchLive(path, query),
  {
    name: 'liiga',
    maxAge: 60,
    swr: true,
    getKey: (path: string, query: LiigaQuery) => snapshotKey(path, query),
  },
)

/**
 * Fetches a Liiga stats API path (relative to /api/v1) with the configured key.
 * In "auto" mode a failed live call falls back to the saved snapshot so the demo keeps working offline.
 */
export async function liiga<T>(path: string, query: LiigaQuery = {}): Promise<LiigaResult<T>> {
  const clean = cleanLiigaPath(path)
  if (!isSafeLiigaPath(clean)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Liiga path' })
  }
  const key = snapshotKey(clean, query)
  const mode = dataMode()

  if (mode !== 'snapshot') {
    try {
      return { data: (await fetchLiveCached(clean, query)) as T, source: 'live' }
    }
    catch (err) {
      if (mode === 'live') {
        throw createError({ statusCode: 502, statusMessage: `Liiga API error for ${clean}`, cause: err })
      }
      console.warn(`[liiga] live fetch failed for ${key}, trying snapshot`)
    }
  }

  const snap = await readSnapshot<T>(key)
  if (snap === null) {
    throw createError({ statusCode: 503, statusMessage: `No live data and no snapshot for ${key}` })
  }
  return { data: snap, source: 'snapshot' }
}

/** Marks the response with where the data came from, so the UI can show an offline badge. */
export function setDataSource(event: H3Event, ...sources: Array<'live' | 'snapshot'>) {
  setResponseHeader(event, 'x-voz-data-source', sources.includes('snapshot') ? 'snapshot' : 'live')
}

export function currentSeason(): number {
  return Number(useRuntimeConfig().public.season)
}

export function currentSerie(): string {
  return String(useRuntimeConfig().public.serie)
}
