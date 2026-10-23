// Helpers for calling upstream sports APIs, shared by the Nitro server and the snapshot
// script (scripts/snapshot.ts). Keep this file free of Nuxt imports so plain Node can run it.

export type UpstreamQuery = Record<string, string | number | boolean | undefined | null>

/** Normalises an API path such as "/games/2027/123/" to "games/2027/123". */
export function cleanPath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '')
}

/** Paths we allow through to an upstream API: letters, digits, '-', '_' and '/'. */
export function isSafePath(path: string): boolean {
  return /^[A-Za-z0-9_\-/]+$/.test(path) && !path.includes('..')
}

/** Stable, filesystem-safe key for one API request; used for both cache and snapshot files. */
export function snapshotKey(path: string, query: UpstreamQuery = {}): string {
  const qs = Object.keys(query)
    .filter(k => query[k] !== undefined && query[k] !== null && query[k] !== '')
    .sort()
    .map(k => `${k}=${query[k]}`)
    .join('&')
  const raw = cleanPath(path) + (qs ? `__${qs}` : '')
  return raw.replace(/[^A-Za-z0-9_=&.-]+/g, '_') + '.json'
}

export function buildUrl(base: string, path: string, query: UpstreamQuery = {}): string {
  const url = new URL(`${base.replace(/\/+$/, '')}/${cleanPath(path)}`)
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  return url.toString()
}

// Liiga only: some fields (player names, team names, award names) arrive as UTF-8 bytes that
// were decoded as Latin-1, e.g. "KÃ¤rpÃ¤t" instead of "Kärpät". Re-decode those strings.
const MOJIBAKE = /[ÃÂ][\u0080-¿]/

export function fixMojibake(value: string): string {
  if (!MOJIBAKE.test(value)) return value
  const bytes = Uint8Array.from(value, ch => ch.charCodeAt(0))
  if (bytes.some((_, i) => value.charCodeAt(i) > 0xFF)) return value
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  return decoded.includes('�') ? value : decoded
}

/** Deep-copies JSON, fixing mis-decoded strings in both keys and values. */
export function fixEncodingDeep<T>(input: T): T {
  if (typeof input === 'string') return fixMojibake(input) as T
  if (Array.isArray(input)) return input.map(fixEncodingDeep) as T
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input)) out[fixMojibake(k)] = fixEncodingDeep(v)
    return out as T
  }
  return input
}
