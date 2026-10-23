// Saves Liiga API responses to data/snapshots so the demo runs without network.
// Usage: npm run snapshot [-- --season 2027 --details]
//   --details  also saves game details + stats for every finished regular-season game
// File names come from snapshotKey(), the same key the server reads in NUXT_DATA_MODE=auto|snapshot.

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildLiigaUrl, fixEncodingDeep, snapshotKey, type LiigaQuery } from '../shared/utils/liiga-raw.ts'

const BASE = process.env.NUXT_LIIGA_BASE_URL ?? 'https://prod.liiga-backend.liiga.fi/stats/api/v1'
const KEY = process.env.NUXT_LIIGA_API_KEY ?? ''
const OUT = join(import.meta.dirname, '..', 'data', 'snapshots')

const args = process.argv.slice(2)
const season = Number(args[args.indexOf('--season') + 1]) || 2027
const withDetails = args.includes('--details')
const serie = 'runkosarja'

let saved = 0
async function save(path: string, query: LiigaQuery = {}): Promise<unknown> {
  const res = await fetch(buildLiigaUrl(BASE, path, query), {
    headers: { accept: 'application/json', ...(KEY ? { 'x-api-key': KEY } : {}) },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`)
  const data = fixEncodingDeep(await res.json())
  await writeFile(join(OUT, snapshotKey(path, query)), JSON.stringify(data))
  saved++
  return data
}

/** Runs tasks with limited parallelism so we stay polite to the API. */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(Array.from({ length: size }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item)
  }))
}

await mkdir(OUT, { recursive: true })
if (!KEY) console.warn('NUXT_LIIGA_API_KEY is not set; calling the API without a key.')

const games = await save('games', { season }) as { games: Array<{ id: number, serie: string, ended: boolean }> }
await save('teams', { season, serie })
await save(`standings/${serie}`, { season })
await save('games/schedule', { season, serie }).catch(e => console.warn('schedule:', e.message))
await save(`players/web/stats/milestones/${serie}`).catch(e => console.warn('milestones:', e.message))

if (withDetails) {
  const ended = games.games.filter(g => g.ended && g.serie === serie.toUpperCase())
  console.log(`Saving details and stats for ${ended.length} finished games...`)
  let failed = 0
  await pool(ended, 4, async (g) => {
    for (const path of [`games/${season}/${g.id}`, `games/${season}/${g.id}/stats`]) {
      await save(path).catch((e) => { failed++; console.warn(e.message) })
    }
  })
  if (failed) console.warn(`${failed} requests failed`)
}

console.log(`Saved ${saved} files to ${OUT}`)
