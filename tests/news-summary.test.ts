import assert from 'node:assert/strict'
import test from 'node:test'
import { createSummaryService, generateNewsSummary, SUMMARY_TTL_MS, validateGeneratedSummary, type SummaryArticle, type SummaryConfig, type SummaryEvidence } from '../server/lib/news/summary.ts'
import type { NewsSummary } from '../shared/types/news-coverage.ts'

const article: SummaryArticle = { id: 'a'.repeat(64), title: 'Ipswich share the points', link: 'https://www.itfc.co.uk/news/2026/october/23/report/', source: 'Ipswich Town FC', publishedAt: '2026-10-23T22:00:00Z' }
const config: SummaryConfig = { provider: 'openai', model: 'gpt-6-luna', apiKey: 'unit-test-placeholder' }
const evidence: SummaryEvidence = { title: article.title, publishedAt: article.publishedAt, source: article.source, description: 'Ipswich Town shared the points with Nottingham Forest.', text: 'The Blues picked up a point following a 1-1 draw with Nottingham Forest at Portman Road. Julio Enciso equalised before half-time after Neco Williams put the visitors ahead.' }
const summary = 'Ipswich Town earned a draw against Nottingham Forest at Portman Road, according to the club report. Julio Enciso scored the equaliser before the interval after Neco Williams had put the visitors in front.'
const output = { summary, evidence: ['The Blues picked up a point', 'Julio Enciso equalised before half-time'] }

function store() {
  const values = new Map<string, NewsSummary>()
  return { values, getItem: async <T>(key: string) => (values.get(key) as T | undefined) ?? null, setItem: async (key: string, value: NewsSummary) => { values.set(key, value) } }
}

test('does not generate until requested, reuses cache and expires exactly after 24 hours', async () => {
  const cache = store()
  let calls = 0, reads = 0, now = Date.parse('2026-10-24T10:00:00Z')
  const deps = { store: cache, now: () => now, readArticle: async () => { reads++; return evidence }, generate: async () => { calls++; return summary } }
  const service = createSummaryService(deps)
  assert.equal(calls, 0)
  const first = await service(article, config)
  assert.equal(first.cached, false)
  assert.equal(Date.parse(first.expiresAt) - Date.parse(first.generatedAt), SUMMARY_TTL_MS)
  now += SUMMARY_TTL_MS - 1
  assert.equal((await service(article, config)).cached, true)
  assert.equal(calls, 1)
  assert.equal(reads, 1)
  // A new service instance simulates a server restart using the persistent shared cache.
  assert.equal((await createSummaryService(deps)(article, config)).cached, true)
  now++
  assert.equal((await service(article, config)).cached, false)
  assert.equal(calls, 2)
})

test('concurrent clicks share one AI generation', async () => {
  let calls = 0
  const service = createSummaryService({ store: store(), readArticle: async () => evidence, generate: async () => {
    calls++; await new Promise(resolve => setTimeout(resolve, 20)); return summary
  } })
  const results = await Promise.all(Array.from({ length: 5 }, () => service(article, config)))
  assert.equal(calls, 1)
  assert.ok(results.every(result => result.summary === summary))
})

test('a detected publisher correction invalidates a team summary before its 24-hour expiry', async () => {
  const cache = store()
  let generations = 0
  const service = createSummaryService({ store: cache, now: () => Date.parse('2026-10-24T12:00:00Z'), readArticle: async () => evidence, generate: async () => `Corrected summary ${++generations}` })
  const original = await service({ ...article, contentHash: 'original-text' }, config)
  assert.equal((await service({ ...article, contentHash: 'original-text' }, config)).cached, true)
  const corrected = await service({ ...article, contentHash: 'corrected-text' }, config)
  assert.equal(corrected.cached, false)
  assert.notEqual(corrected.summary, original.summary)
  assert.equal(generations, 2)
})

test('failed AI calls are not cached and can be retried', async () => {
  let calls = 0
  const cache = store()
  const service = createSummaryService({ store: cache, readArticle: async () => evidence, generate: async () => {
    if (++calls === 1) throw new Error('Provider unavailable')
    return summary
  } })
  await assert.rejects(service(article, config), /unavailable/)
  assert.equal(cache.values.size, 0)
  assert.equal((await service(article, config)).summary, summary)
  assert.equal(calls, 2)
})

test('cache identity includes the chosen provider and model', async () => {
  let calls = 0
  const service = createSummaryService({ store: store(), readArticle: async () => evidence, generate: async () => { calls++; return summary } })
  await service(article, config)
  await service(article, { ...config, model: 'another-model' })
  await service(article, { ...config, provider: 'huggingface' })
  assert.equal(calls, 3)
})

test('rejects unsupported quotations/numbers, links and empty summaries', () => {
  assert.equal(validateGeneratedSummary(output, evidence), summary)
  assert.equal(validateGeneratedSummary({ ...output, evidence: [...output.evidence, 'the points shared'] }, evidence), summary)
  assert.equal(validateGeneratedSummary({ ...output, summary: summary + ' The score was 1–1.' }, evidence), summary + ' The score was 1–1.')
  for (const value of [null, { summary, evidence: ['A fabricated sentence which never appeared'] },
    { ...output, summary: summary + ' He scored 9 goals.' }, { ...output, summary: '<script>alert(1)</script>' },
    { summary: 'Not enough detail.', evidence: output.evidence }]) assert.throws(() => validateGeneratedSummary(value, evidence))
})

test('accepts quotation wrappers and equivalent ISO kickoff times while rejecting a different time or fabricated quotation', () => {
  const supplied = { ...evidence, description: `${evidence.description} Kickoff: 2026-10-25T16:30:00Z.` }
  const text = 'Ipswich Town face Nottingham Forest on 25 October at 16:30 UTC, according to the supplied match details. The club report describes the teams sharing the points in their previous meeting at Portman Road.'
  const quotation = '“The Blues picked up a point”'
  assert.equal(validateGeneratedSummary({ summary: text, evidence: [quotation] }, supplied), text)
  assert.throws(() => validateGeneratedSummary({ summary: text.replace('16:30', '17:45'), evidence: [quotation] }, supplied), /unsupported number/)
  assert.throws(() => validateGeneratedSummary({ summary: text, evidence: ['“The Blues won their latest league fixture”'] }, supplied), /substantiate/)
})

test('OpenAI generation preserves the requested model, uses source evidence, disables storage and tools', async () => {
  let calls = 0
  const fetcher = (async (url: string | URL | Request, options?: RequestInit) => {
    calls++
    assert.equal(String(url), 'https://api.openai.com/v1/responses')
    const request = JSON.parse(String(options?.body))
    assert.equal(request.model, 'gpt-6-luna')
    assert.equal(request.store, false)
    assert.equal(request.tools, undefined)
    assert.match(request.instructions, /untrusted evidence/)
    assert.equal(JSON.parse(request.input).text, evidence.text)
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] })
  }) as typeof fetch
  assert.equal(await generateNewsSummary(evidence, config, fetcher), summary)
  assert.equal(calls, 1)
})

test('Hugging Face uses its fixed endpoint and the configured model', async () => {
  const fetcher = (async (url: string | URL | Request, options?: RequestInit) => {
    assert.equal(String(url), 'https://router.huggingface.co/v1/chat/completions')
    assert.equal(JSON.parse(String(options?.body)).model, 'openai/gpt-oss-120b')
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] })
  }) as typeof fetch
  assert.equal(await generateNewsSummary(evidence, { ...config, provider: 'huggingface', model: 'openai/gpt-oss-120b' }, fetcher), summary)
})

test('combined summary requests carry the authoritative phase and all three-source context', async () => {
  const match = { key: 'test:123', status: 'finished' as const, start: '2026-10-23T19:00:00Z', home: { name: 'Ipswich Town', score: 1 }, away: { name: 'Nottingham Forest', score: 1 } }
  const fetcher = (async (_url: string | URL | Request, options?: RequestInit) => {
    const request = JSON.parse(String(options?.body))
    assert.match(request.instructions, /Synthesize all 3 publisher reports/)
    assert.match(request.instructions, /authoritative match phase is post-match/)
    assert.match(request.instructions, /For post-match, write a recap/)
    assert.equal(JSON.parse(request.input).matchContext.match.status, 'finished')
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] })
  }) as typeof fetch
  assert.equal(await generateNewsSummary(evidence, config, fetcher, { phase: 'post-match', match, sourcesCount: 3 }), summary)
})

test('an unsupported numerical detail gets one bounded correction attempt', async () => {
  let calls = 0
  const fetcher = (async (_url: string | URL | Request, options?: RequestInit) => {
    const request = JSON.parse(String(options?.body))
    const value = ++calls === 1 ? { ...output, summary: summary + ' They scored 9 goals.' } : output
    if (calls === 2) assert.match(request.instructions, /failed source validation/)
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] })
  }) as typeof fetch
  assert.equal(await generateNewsSummary(evidence, config, fetcher), summary)
  assert.equal(calls, 2)
})

test('provider errors and refusals do not expose sensitive provider bodies', async () => {
  await assert.rejects(generateNewsSummary(evidence, config, (async () => new Response('Sensitive account details', { status: 401 })) as typeof fetch), error => !String(error).includes('Sensitive'))
  await assert.rejects(generateNewsSummary(evidence, config, (async () => Response.json({ status: 'incomplete', output: [] })) as typeof fetch), /did not complete/)
})
