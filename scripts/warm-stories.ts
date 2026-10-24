// Pre-writes every AI story variant for demo matches and saves them to data/stories/, which is
// bundled with the app (server assets "stories"). The demo then shows stories instantly from the
// first click, even offline or without an OpenAI key. Only stories that passed the check are saved.
//
// Usage (with `npm run dev` running):
//   npm run warm:stories -- [--base http://localhost:3000] [--match premier-league/2645271]

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const args = process.argv.slice(2)
const arg = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1]! : fallback)
const base = arg('--base', 'http://localhost:3000').replace(/\/$/, '')
const [competition, matchId] = arg('--match', 'premier-league/2645271').split('/') as [string, string]

const LENGTHS = ['short', 'standard', 'long']
const TONES = ['neutral', 'home-fan', 'away-fan', 'analyst']
const outDir = join(import.meta.dirname, '..', 'data', 'stories', competition, matchId)
await mkdir(outDir, { recursive: true })

let saved = 0
for (const length of LENGTHS) {
  for (const tone of TONES) {
    const url = `${base}/api/competitions/${competition}/matches/${matchId}/story?length=${length}&tone=${tone}&fresh=1`
    const t0 = Date.now()
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`${length}/${tone}: HTTP ${res.status}`)
      continue
    }
    const { story } = await res.json() as { story: { origin: string, check: { passed: boolean, factsUsed: number }, usage: { turns: number }, fallbackReason: string | null } }
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    if (story.origin !== 'agent' || !story.check.passed) {
      console.warn(`${length}/${tone}: not saved (${story.fallbackReason ?? 'did not pass the check'})`)
      continue
    }
    await writeFile(join(outDir, `${length}-${tone}.json`), `${JSON.stringify(story, null, 1)}\n`)
    saved++
    console.log(`${length}/${tone}: saved (${story.check.factsUsed} facts, ${story.usage.turns} turns, ${secs}s)`)
  }
}
console.log(`Saved ${saved} of ${LENGTHS.length * TONES.length} stories to ${outDir}`)
