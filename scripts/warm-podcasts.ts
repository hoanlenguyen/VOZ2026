// Pre-generates AI podcast episodes (English and Finnish) for a demo match, team or league and saves them with
// the app: the episode to data/podcasts/<id>.json (server assets "podcasts") and its audio to
// public/podcasts/<id>.mp3 (a static file), so the front page and the match page play them from
// the first visit, even without an OpenAI key. Only episodes whose script passed the check exist.
//
// Signs in as the demo newsroom account (only the newsroom may generate podcasts) and always makes
// new versions (force).
//
// Usage (with `npm run dev` running and NUXT_OPENAI_API_KEY set):
//   npm run warm:podcasts -- [--base http://localhost:3000] [--match premier-league/2645271] [--lang en,fi]
//   npm run warm:podcasts -- --team premier-league:349     (daily team episode, dated today)
//   npm run warm:podcasts -- --league premier-league       (daily league episode, dated today)

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PodcastEpisode } from '../shared/types/podcast.ts'

const args = process.argv.slice(2)
const arg = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1]! : fallback)
const base = arg('--base', 'http://localhost:3000').replace(/\/$/, '')
const subject = args.includes('--team')
  ? { kind: 'team', competitionId: arg('--team', '').split(':')[0], teamKey: arg('--team', '') }
  : args.includes('--league')
    ? { kind: 'league', competitionId: arg('--league', '') }
    : { kind: 'match', competitionId: arg('--match', 'premier-league/2645271').split('/')[0], matchId: arg('--match', 'premier-league/2645271').split('/')[1] }
const langs = arg('--lang', 'en,fi').split(',').filter(l => l === 'en' || l === 'fi')

const root = join(import.meta.dirname, '..')
const dataDir = join(root, 'data', 'podcasts')
const audioDir = join(root, 'public', 'podcasts')
await mkdir(dataDir, { recursive: true })
await mkdir(audioDir, { recursive: true })

const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'newsroom@demo.com', password: 'demo' }),
})
const cookie = login.headers.get('set-cookie')?.split(';')[0]
if (!login.ok || !cookie) throw new Error(`Newsroom sign-in failed: HTTP ${login.status}`)

const res = await fetch(`${base}/api/newsroom/podcasts`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ subject, langs, force: true }),
})
if (!res.ok) throw new Error(`Generating failed: HTTP ${res.status} ${await res.text()}`)
const { episodes } = await res.json() as { episodes: Array<{ episode: PodcastEpisode }> }

for (const { episode } of episodes) {
  const audio = await fetch(`${base}${episode.audio!.url}`)
  if (!audio.ok) throw new Error(`${episode.id}: audio HTTP ${audio.status}`)
  await writeFile(join(audioDir, `${episode.id}.mp3`), new Uint8Array(await audio.arrayBuffer()))
  const bundled: PodcastEpisode = { ...episode, audio: { ...episode.audio!, url: `/podcasts/${episode.id}.mp3` } }
  await writeFile(join(dataDir, `${episode.id}.json`), `${JSON.stringify(bundled, null, 1)}\n`)
  const words = episode.sentences.reduce((n, s) => n + s.text.split(/\s+/).length, 0)
  console.log(`${episode.id}: saved (${episode.audio!.seconds} s, ${words} words) "${episode.title}"`)
}
console.log(`Saved ${episodes.length} episodes to ${dataDir} and ${audioDir}`)
