// Static team facts the Liiga API does not provide (home town). Keyed by an ASCII slug
// so it can be used safely in URLs; `liigaSlug` is the part after ':' in Liiga team ids.

export interface TeamInfo {
  slug: string
  liigaSlug: string
  name: string
  abbr: string
  town: string
}

export const TEAMS: TeamInfo[] = [
  { slug: 'hifk', liigaSlug: 'hifk', name: 'HIFK', abbr: 'IFK', town: 'Helsinki' },
  { slug: 'hpk', liigaSlug: 'hpk', name: 'HPK', abbr: 'HPK', town: 'Hämeenlinna' },
  { slug: 'ilves', liigaSlug: 'ilves', name: 'Ilves', abbr: 'ILV', town: 'Tampere' },
  { slug: 'jokerit', liigaSlug: 'jokerit', name: 'Jokerit', abbr: 'JOK', town: 'Helsinki' },
  { slug: 'jukurit', liigaSlug: 'jukurit', name: 'Jukurit', abbr: 'JUK', town: 'Mikkeli' },
  { slug: 'jyp', liigaSlug: 'jyp', name: 'JYP', abbr: 'JYP', town: 'Jyväskylä' },
  { slug: 'kalpa', liigaSlug: 'kalpa', name: 'KalPa', abbr: 'KAL', town: 'Kuopio' },
  { slug: 'karpat', liigaSlug: 'kärpät', name: 'Kärpät', abbr: 'KÄR', town: 'Oulu' },
  { slug: 'k-espoo', liigaSlug: 'k-espoo', name: 'K-Espoo', abbr: 'KES', town: 'Espoo' },
  { slug: 'kookoo', liigaSlug: 'kookoo', name: 'KooKoo', abbr: 'KOO', town: 'Kouvola' },
  { slug: 'lukko', liigaSlug: 'lukko', name: 'Lukko', abbr: 'LUK', town: 'Rauma' },
  { slug: 'pelicans', liigaSlug: 'pelicans', name: 'Pelicans', abbr: 'PEL', town: 'Lahti' },
  { slug: 'saipa', liigaSlug: 'saipa', name: 'SaiPa', abbr: 'SAI', town: 'Lappeenranta' },
  { slug: 'sport', liigaSlug: 'sport', name: 'Sport', abbr: 'SPO', town: 'Vaasa' },
  { slug: 'tappara', liigaSlug: 'tappara', name: 'Tappara', abbr: 'TAP', town: 'Tampere' },
  { slug: 'tps', liigaSlug: 'tps', name: 'TPS', abbr: 'TPS', town: 'Turku' },
  { slug: 'assat', liigaSlug: 'ässät', name: 'Ässät', abbr: 'ÄSS', town: 'Pori' },
]

/** Maps a Liiga team id ("495643563:kärpät") or our slug ("karpat") to the team info. */
export function findTeam(idOrSlug: string | null | undefined): TeamInfo | undefined {
  if (!idOrSlug) return undefined
  const key = idOrSlug.includes(':') ? idOrSlug.split(':').pop()! : idOrSlug
  return TEAMS.find(t => t.slug === key || t.liigaSlug === key)
}
