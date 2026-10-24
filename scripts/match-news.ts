import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { lookupMatchNews } from '../server/lib/news/lookup.ts'
import { parseNewsInput } from '../server/lib/news/input.ts'

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { output: { type: 'string' }, limit: { type: 'string', default: '4' }, endpoint: { type: 'string' } },
  })
  if (positionals.length !== 1) throw new Error('Usage: npm run match-news -- <match.json> [--limit 3|4] [--output news.json] [--endpoint http://localhost:3000/api/match-news]')
  const payload: unknown = JSON.parse(await readFile(resolve(positionals[0]!), 'utf8'))
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Expected a match JSON object.')
  const input = { ...payload, limit: Number(values.limit) }
  const match = parseNewsInput(input)
  let result
  if (values.endpoint) {
    const response = await fetch(values.endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(90_000),
    })
    if (!response.ok) throw new Error(`Match-news endpoint returned HTTP ${response.status}`)
    result = await response.json()
  }
  else result = await lookupMatchNews(match)
  const json = JSON.stringify(result, null, 2) + '\n'
  if (values.output) {
    await writeFile(resolve(values.output), json, 'utf8')
    process.stderr.write(`Saved news JSON to ${resolve(values.output)}\n`)
  }
  else process.stdout.write(json)
}
catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'News lookup failed'}\n`)
  process.exitCode = 1
}
