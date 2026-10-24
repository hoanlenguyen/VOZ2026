import robotsParser from 'robots-parser'
import { NEWS_SOURCES, sourceForUrl, type NewsSource } from './sources.ts'

export const NEWS_USER_AGENT = 'VOZMatchNews/1.0'
const MAX_BYTES = 2_000_000

/** A bounded fetcher for fixed publisher hosts. Checks each redirect and never sends API keys. */
export function createNewsCrawler(fetcher: typeof fetch = fetch, sources: NewsSource[] = NEWS_SOURCES, budget: { totalMs?: number, requestMs?: number, beforeRequest?: (url: string, delayMs: number) => Promise<void> } = {}) {
  const robots = new Map<string, Promise<ReturnType<typeof robotsParser>>>()
  const nextRequest = new Map<string, number>()
  const deadline = Date.now() + (budget.totalMs ?? 55_000)

  async function raw(url: string, conditional: Record<string, string> = {}, delayMs = 300): Promise<{ response: Response, text: string }> {
    await budget.beforeRequest?.(url, delayMs)
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('News lookup deadline reached')
    const response = await fetcher(url, {
      headers: { 'user-agent': NEWS_USER_AGENT, accept: 'text/html,application/rss+xml,application/xml,text/plain', ...conditional },
      redirect: 'manual', signal: AbortSignal.timeout(Math.min(budget.requestMs ?? 15_000, remaining)),
    })
    if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) {
      await response.body?.cancel()
      throw new Error('Page too large')
    }
    const reader = response.body?.getReader()
    if (!reader) return { response, text: '' }
    const decoder = new TextDecoder()
    let text = '', size = 0
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > MAX_BYTES) throw new Error('Page too large')
        text += decoder.decode(chunk.value, { stream: true })
      }
      return { response, text: text + decoder.decode() }
    }
    finally { await reader.cancel().catch(() => {}) }
  }

  async function rules(origin: string) {
    if (!robots.has(origin)) robots.set(origin, (async () => {
      let url = `${origin}/robots.txt`
      for (let i = 0; i < 4; i++) {
        if (!sourceForUrl(url, sources)) throw new Error('Untrusted robots redirect')
        const { response, text } = await raw(url)
        if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
          url = new URL(response.headers.get('location')!, url).href
          continue
        }
        if (response.status === 404 || response.status === 410) return robotsParser(`${origin}/robots.txt`, '')
        if (!response.ok || /<html/i.test(text)) throw new Error('Crawl permissions unavailable')
        return robotsParser(`${origin}/robots.txt`, text)
      }
      throw new Error('Too many robots redirects')
    })())
    return robots.get(origin)!
  }

  return async function crawl(initial: string, conditional: { etag?: string, lastModified?: string } = {}): Promise<{ url: string, text: string, notModified?: boolean, etag?: string, lastModified?: string }> {
    let url = initial
    for (let i = 0; i < 4; i++) {
      if (!sourceForUrl(url, sources)) throw new Error('Untrusted news URL')
      const origin = new URL(url).origin
      const robot = await rules(origin)
      if (robot.isAllowed(url, NEWS_USER_AGENT) === false) throw new Error('Crawling disallowed')
      const delay = Math.max(300, (robot.getCrawlDelay(NEWS_USER_AGENT) ?? 0) * 1000)
      const at = Math.max(Date.now(), nextRequest.get(origin) ?? 0)
      if (at + delay > deadline) throw new Error('Crawl delay exceeds lookup deadline')
      nextRequest.set(origin, at + delay)
      if (at > Date.now()) await new Promise(resolve => setTimeout(resolve, at - Date.now()))
      const { response, text } = await raw(url, { ...(conditional.etag ? { 'if-none-match': conditional.etag } : {}), ...(conditional.lastModified ? { 'if-modified-since': conditional.lastModified } : {}) }, delay)
      const validators = { etag: response.headers.get('etag') ?? undefined, lastModified: response.headers.get('last-modified') ?? undefined }
      if (response.status === 304) return { url, text: '', notModified: true, ...validators }
      if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
        url = new URL(response.headers.get('location')!, url).href
        continue
      }
      if (!response.ok) throw new Error(`Publisher returned HTTP ${response.status}`)
      if (!/(?:html|xml|text\/plain)/i.test(response.headers.get('content-type') ?? '')) throw new Error('Not a text page')
      if (/\b(?:noindex|nosnippet|noai)\b/i.test(response.headers.get('x-robots-tag') ?? '')) throw new Error('Publisher restricts previews')
      return { url, text, ...validators }
    }
    throw new Error('Too many redirects')
  }
}
