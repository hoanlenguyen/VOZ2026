import { digest } from './summary.ts'

export interface NewsCacheStore {
  getItem<T>(key: string): Promise<T | null>
  setItem(key: string, value: object, options?: { ttl?: number }): Promise<unknown>
}

/** Expiry can tighten as kickoff approaches, even when a value was saved under a slower policy. */
export function createTimedNewsCache<T>(store: NewsCacheStore, prefix: string, now = Date.now) {
  const pending = new Map<string, Promise<T>>()
  return async (identity: string, seconds: number, load: () => Promise<T>): Promise<T> => {
    const key = `${prefix}:${await digest(identity)}`
    const cached = await store.getItem<{ value: T, createdAt: number, expiresAt: number }>(key)
    if (cached && Math.min(cached.expiresAt, cached.createdAt + seconds * 1000) > now()) return cached.value
    if (pending.has(key)) return pending.get(key)!
    const request = (async () => {
      const createdAt = now()
      const value = await load()
      await store.setItem(key, { value, createdAt, expiresAt: createdAt + seconds * 1000 }, { ttl: Math.ceil(seconds) })
      return value
    })()
    pending.set(key, request)
    try { return await request } finally { pending.delete(key) }
  }
}
