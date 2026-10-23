// Saves upstream API responses to data/snapshots/<provider>/ so the demo runs without network.
// Usage: npm run snapshot -- [--only liiga|football-data] [--details] [--competitions PL,BL1]
//   --details       Liiga: also save details for every finished game (~28 MB, gitignored)
//   --competitions  football-data codes to save (default: every free-plan competition)
// File names come from snapshotKey(), the same key the server reads in NUXT_DATA_MODE=auto|snapshot.

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { COMPETITIONS } from '../shared/utils/competitions.ts'
import { buildUrl, fixEncodingDeep, snapshotKey, type UpstreamQuery } from '../shared/utils/upstream.ts'

const OUT = join(import.meta.dirname, '..', 'data', 'snapshots')
const args = process.argv.slice(2)
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const only = arg('--only')
const withDetails = args.includes('--details')

interface Upstream { base: string, headers: Record<string, string>, transform?: (x: unknown) => unknown, gapMs: number }

const UPSTREAMS: Record<string, Upstream> = {
  'liiga': {
    base: process.env.NUXT_LIIGA_BASE_URL ?? 'https://prod.liiga-backend.liiga.fi/stats/api/v1',
    headers: process.env.NUXT_LIIGA_API_KEY ? { 'x-api-key': process.env.NUXT_LIIGA_API_KEY } : {},
    transform: fixEncodingDeep,
    gapMs: 0,
  },
  'football-data': {
    base: process.env.NUXT_FOOTBALL_DATA_BASE_URL ?? 'https://api.football-data.org/v4',
    headers: process.env.NUXT_FOOTBALL_DATA_TOKEN ? { 'X-Auth-Token': process.env.NUXT_FOOTBALL_DATA_TOKEN } : {},
    gapMs: 6_500, // free plan: 10 requests per minute
  },
}

let saved = 0
const lastCall: Record<string, number> = {}

async function save(provider: string, path: string, query: UpstreamQuery = {}): Promise<unknown> {
  const up = UPSTREAMS[provider]!
  const wait = (lastCall[provider] ?? 0) + up.gapMs - Date.now()
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
  lastCall[provider] = Date.now()

  const res = await fetch(buildUrl(up.base, path, query), { headers: { accept: 'application/json', ...up.headers } })
  if (!res.ok) throw new Error(`${provider} ${res.status} ${res.statusText} for ${path}`)
  const raw = await res.json()
  const data = up.transform ? up.transform(raw) : raw
  await mkdir(join(OUT, provider), { recursive: true })
  await writeFile(join(OUT, provider, snapshotKey(path, query)), JSON.stringify(data))
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

async function snapshotLiiga() {
  const season = Number(process.env.NUXT_LIIGA_SEASON) || 2027
  const serie = 'runkosarja'
  if (!process.env.NUXT_LIIGA_API_KEY) console.warn('NUXT_LIIGA_API_KEY is not set; calling Liiga without a key.')

  const games = await save('liiga', 'games', { season }) as { games: Array<{ id: number, serie: string, ended: boolean }> }
  await save('liiga', 'teams', { season, serie })
  await save('liiga', `standings/${serie}`, { season })
  await save('liiga', 'games/schedule', { season, serie }).catch(e => console.warn(e.message))
  await save('liiga', `players/web/stats/milestones/${serie}`).catch(e => console.warn(e.message))

  if (!withDetails) return
  const ended = games.games.filter(g => g.ended && g.serie === serie.toUpperCase())
  console.log(`Liiga: saving details and stats for ${ended.length} finished games...`)
  await pool(ended, 4, async (g) => {
    for (const path of [`games/${season}/${g.id}`, `games/${season}/${g.id}/stats`]) {
      await save('liiga', path).catch(e => console.warn(e.message))
    }
  })
}

async function snapshotFootball() {
  if (!process.env.NUXT_FOOTBALL_DATA_TOKEN) {
    console.warn('NUXT_FOOTBALL_DATA_TOKEN is not set; skipping football-data.org.')
    return
  }
  const wanted = arg('--competitions')?.split(',')
  const comps = COMPETITIONS.filter(c => c.provider === 'football-data' && c.tier === 'TIER_ONE'
    && (!wanted || wanted.includes(c.providerCode)))
  console.log(`football-data: ${comps.length} competitions, ~${Math.ceil(comps.length * 3 * 6.5 / 60)} min at 10 requests/minute`)
  for (const c of comps) {
    for (const path of [`competitions/${c.providerCode}/teams`, `competitions/${c.providerCode}/standings`, `competitions/${c.providerCode}/matches`]) {
      await save('football-data', path).catch(e => console.warn(e.message))
    }
    console.log(`  ${c.name} saved`)
  }
}

if (!only || only === 'liiga') await snapshotLiiga()
if (!only || only === 'football-data') await snapshotFootball()
console.log(`Saved ${saved} files to ${OUT}`)
