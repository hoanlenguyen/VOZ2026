// Pre-writes every AI story variant and the AI headline (title + subtitle) for a demo match, in
// English and Finnish, and saves them to data/stories/ and data/headlines/, which are bundled with
// the app (server assets "stories" and "headlines"). The demo then shows them instantly from the
// first click, even offline or without an OpenAI key. Only texts that passed the check are saved.
//
// Usage (with `npm run dev` running and NUXT_OPENAI_API_KEY set):
//   npm run warm:stories -- [--base http://localhost:3000] [--match premier-league/2645271] [--lang en,fi]
// Against a deployed site (it has the key; `fresh` is ignored there, so cached versions are reused):
//   npm run warm:stories -- --base https://voz.<subdomain>.workers.dev

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const args = process.argv.slice(2)
const arg = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1]! : fallback)
const base = arg('--base', 'http://localhost:3000').replace(/\/$/, '')
const [competition, matchId] = arg('--match', 'premier-league/2645271').split('/') as [string, string]
const langs = arg('--lang', 'en,fi').split(',').filter(l => l === 'en' || l === 'fi')

const LENGTHS = ['short', 'standard', 'long']
const TONES = ['neutral', 'home-fan', 'away-fan', 'analyst']
const storyDir = join(import.meta.dirname, '..', 'data', 'stories', competition, matchId)
const headlineDir = join(import.meta.dirname, '..', 'data', 'headlines', competition)
await mkdir(storyDir, { recursive: true })
await mkdir(headlineDir, { recursive: true })

let saved = 0
let tried = 0
for (const lang of langs) {
  tried++
  const hres = await fetch(`${base}/api/competitions/${competition}/matches/${matchId}/headline?lang=${lang}&fresh=1`)
  const { headline } = hres.ok ? await hres.json() as { headline: { headline: string } | null } : { headline: null }
  if (headline) {
    await writeFile(join(headlineDir, `${matchId}.${lang}.json`), `${JSON.stringify(headline, null, 1)}\n`)
    saved++
    console.log(`headline ${lang}: saved (${headline.headline})`)
  }
  else console.warn(`headline ${lang}: not saved (${hres.ok ? 'no checked headline' : `HTTP ${hres.status}`})`)

  for (const length of LENGTHS) {
    for (const tone of TONES) {
      tried++
      const url = `${base}/api/competitions/${competition}/matches/${matchId}/story?length=${length}&tone=${tone}&lang=${lang}&fresh=1`
      const t0 = Date.now()
      const res = await fetch(url)
      if (!res.ok) {
        console.warn(`${lang} ${length}/${tone}: HTTP ${res.status}`)
        continue
      }
      const { story } = await res.json() as { story: { origin: string, lang?: string, check: { passed: boolean, factsUsed: number }, usage: { turns: number }, fallbackReason: string | null } }
      const secs = ((Date.now() - t0) / 1000).toFixed(1)
      if (story.origin !== 'agent' || !story.check.passed || (story.lang ?? 'en') !== lang) {
        console.warn(`${lang} ${length}/${tone}: not saved (${story.fallbackReason ?? 'did not pass the check'})`)
        continue
      }
      // English files keep their original names; Finnish ones get ".fi".
      await writeFile(join(storyDir, `${length}-${tone}${lang === 'fi' ? '.fi' : ''}.json`), `${JSON.stringify(story, null, 1)}\n`)
      saved++
      console.log(`${lang} ${length}/${tone}: saved (${story.check.factsUsed} facts, ${story.usage.turns} turns, ${secs}s)`)
    }
  }
}
console.log(`Saved ${saved} of ${tried} texts to ${storyDir} and ${headlineDir}`)
