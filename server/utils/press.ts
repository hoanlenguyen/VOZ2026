// "What the press says": headlines from GNews matched to one game by date and both team names.
// Article descriptions are used only to decide whether an article is about this game; the
// response carries headline, source and link only.

import type { PressArticle, PressResult } from '#shared/types/press'

interface RawArticle {
  title: string
  description?: string | null
  url: string
  publishedAt: string
  source: { name: string, url?: string }
}

const DAY = 86_400_000
const MAX_ARTICLES = 6
const MAX_QUERY = 200 // GNews query length limit

// Club-name parts that are too generic to identify a team on their own.
const GENERIC = new Set([
  'real', 'club', 'sporting', 'atletico', 'inter', 'bayer', 'borussia', 'olympique', 'paris', 'manchester',
  'athletic', 'racing', 'stade', 'union', 'royal', 'west', 'aston', 'crystal', 'nottingham', 'sheffield',
  'queens', 'deportivo', 'saint', 'eintracht', 'hertha', 'werder', 'hamburger',
])
const AFFIXES = /\b(FC|AFC|CF|SC|SV|AC|SSC|FK|CD|UD|RC|RB|SL|SAD|TSG|VfB|VfL|OGC|LOSC|\d{4})\b/g

/** Removes accents: GNews rejects non-ASCII letters in queries ("Kärpät" -> "Karpat"). */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

const clean = (s: string) => fold(s).replace(/[&.'’()]/g, ' ').replace(AFFIXES, ' ').replace(/\s+/g, ' ').trim()

/** Names the press uses for a team: short name, full name, and a distinctive first word. */
export function teamVariants(team: Pick<MatchTeam, 'name' | 'shortName'>): string[] {
  const out = new Set([clean(team.shortName), clean(team.name)])
  const first = clean(team.name).split(' ')[0] ?? ''
  if (first.length >= 5 && !GENERIC.has(first.toLowerCase())) out.add(first)
  return [...out].filter(v => v.length >= 3).sort((a, b) => a.length - b.length)
}

function buildQuery(home: string[], away: string[]): string {
  const group = (names: string[]) => `(${names.map(n => `"${n}"`).join(' OR ')})`
  // Drop the longest variants until the query fits.
  let [h, a] = [home, away]
  let q = `${group(h)} AND ${group(a)}`
  while (q.length > MAX_QUERY && (h.length > 1 || a.length > 1)) {
    if (h.length >= a.length) h = h.slice(0, -1)
    else a = a.slice(0, -1)
    q = `${group(h)} AND ${group(a)}`
  }
  return q
}

const mentions = (text: string, names: string[]) => names.some(n => text.includes(n.toLowerCase()))

export async function pressForMatch(match: Match): Promise<PressResult> {
  if (!useRuntimeConfig().gnewsApiKey) {
    return { status: 'unavailable', articles: [], note: 'Press search is not configured.' }
  }
  const home = teamVariants(match.home)
  const away = teamVariants(match.away)
  const start = Date.parse(match.start)
  const from = new Date(start - 3 * DAY)
  const to = new Date(Math.min(Date.now(), start + 3 * DAY))
  if (to <= from) return { status: 'none', articles: [], note: 'No press coverage yet.' }

  const search = (lang?: string) => upstream<{ articles?: RawArticle[] }>('gnews', 'search', {
    q: buildQuery(home, away),
    lang,
    // Hourly windows keep the cache key stable between page views.
    from: `${from.toISOString().slice(0, 13)}:00:00Z`,
    to: `${to.toISOString().slice(0, 13)}:00:00Z`,
    max: 10,
    sortby: 'relevance',
  }).then(r => r.data.articles ?? [])

  let articles: PressArticle[]
  try {
    // English first (the UI language); any language only when English has nothing about this game.
    articles = pick(await search('en'), home, away, start)
    if (!articles.length) articles = pick(await search(), home, away, start)
  }
  catch (err) {
    console.warn(`[press] ${match.key}: ${(err as Error).message}`)
    return { status: 'unavailable', articles: [], note: 'Press headlines are unavailable right now.' }
  }

  return articles.length
    ? { status: 'ok', articles, note: null }
    : { status: 'none', articles, note: `No headlines naming both ${match.home.shortName} and ${match.away.shortName} were found around this game.` }
}

/** Articles whose headline or description names both teams (the search alone is too loose), post-match first. */
function pick(raw: RawArticle[], home: string[], away: string[], start: number): PressArticle[] {
  const seen = new Set<string>()
  const articles: PressArticle[] = []
  for (const a of raw) {
    const text = fold(`${a.title} ${a.description ?? ''}`).toLowerCase()
    if (!mentions(text, home) || !mentions(text, away)) continue
    const dedupe = a.title.toLowerCase().replace(/\W+/g, ' ').trim()
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    articles.push({
      title: a.title,
      url: a.url,
      source: a.source.name,
      publishedAt: a.publishedAt,
      timing: Date.parse(a.publishedAt) < start ? 'before' : 'after',
    })
    if (articles.length === MAX_ARTICLES * 2) break
  }
  const after = articles.filter(a => a.timing === 'after')
  const before = articles.filter(a => a.timing === 'before')
  return [...after, ...before].slice(0, MAX_ARTICLES)
}
