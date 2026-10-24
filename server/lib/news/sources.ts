import type { NewsSourceKind } from '../../../shared/types/news-source.ts'

export interface NewsSource {
  id?: string
  kind?: NewsSourceKind
  name: string
  hosts: string[]
  indexes: string[]
  articlePath: RegExp
  /** Club indexes are used only for matches involving this club. */
  team?: string
  teamIndexes?: Record<string, string[]>
}

// Keep this server-owned: callers cannot supply URLs, domains or crawl targets.
// One result per publisher, even when it serves both .com and .co.uk.
export const NEWS_SOURCES: NewsSource[] = [
  {
    id: 'ipswich-town', kind: 'club',
    name: 'Ipswich Town FC', hosts: ['www.itfc.co.uk', 'itfc.co.uk'],
    indexes: ['https://www.itfc.co.uk/news/'],
    articlePath: /^\/news\/\d{4}\/[^/]+\/\d{1,2}\/.+/, team: 'Ipswich Town',
  },
  {
    id: 'nottingham-forest', kind: 'club',
    name: 'Nottingham Forest FC', hosts: ['www.nottinghamforest.co.uk', 'nottinghamforest.co.uk'],
    indexes: ['https://www.nottinghamforest.co.uk/sitemap.xml'],
    articlePath: /^\/news\/\d{4}\/[^/]+\/\d{1,2}\/.+/, team: 'Nottingham Forest',
  },
  {
    id: 'bbc-sport', kind: 'newsroom',
    name: 'BBC Sport', hosts: ['www.bbc.com', 'www.bbc.co.uk', 'feeds.bbci.co.uk'],
    indexes: ['https://feeds.bbci.co.uk/sport/football/rss.xml'],
    teamIndexes: {
      'ipswich town': ['https://feeds.bbci.co.uk/sport/football/teams/ipswich-town/rss.xml'],
      'nottingham forest': ['https://feeds.bbci.co.uk/sport/football/teams/nottingham-forest/rss.xml'],
    },
    articlePath: /^\/sport\/football\/(?:articles|live)\/.+|^\/sport\/football\/\d+$/,
  },
  {
    id: 'sky-sports', kind: 'newsroom',
    name: 'Sky Sports', hosts: ['www.skysports.com'],
    indexes: ['https://www.skysports.com/rss/12040'],
    articlePath: /^\/football\/(?:news\/|[^/]+\/(?:report|live)\/).+/,
  },
  {
    id: 'guardian', kind: 'newsroom',
    name: 'The Guardian', hosts: ['www.theguardian.com'],
    indexes: ['https://www.theguardian.com/football/rss'],
    teamIndexes: {
      'ipswich town': ['https://www.theguardian.com/football/ipswichtown/rss'],
      'nottingham forest': ['https://www.theguardian.com/football/nottinghamforest/rss'],
    },
    articlePath: /^\/football\/\d{4}\/[a-z]+\/\d{2}\/.+/,
  },
  {
    id: 'premier-league', kind: 'league',
    name: 'Premier League', hosts: ['www.premierleague.com', 'premierleague.com'],
    indexes: ['https://www.premierleague.com/en/news'],
    articlePath: /^\/(?:en\/)?news\/\d+/,
  },
  {
    id: 'efl', kind: 'league', name: 'EFL', hosts: ['www.efl.com', 'efl.com'],
    indexes: ['https://www.efl.com/news/'], articlePath: /^\/news\/\d{4}\/[^/]+\/\d{1,2}\/.+/,
  },
  {
    id: 'la-liga', kind: 'league', name: 'LaLiga', hosts: ['www.laliga.com', 'laliga.com'],
    indexes: ['https://www.laliga.com/en-GB/news'], articlePath: /^\/en-GB\/news\/[^/]+/,
  },
  {
    id: 'bundesliga', kind: 'league', name: 'Bundesliga', hosts: ['www.bundesliga.com', 'bundesliga.com'],
    indexes: ['https://www.bundesliga.com/en/bundesliga/news'], articlePath: /^\/en\/bundesliga\/news\/[^/]+/,
  },
  {
    id: 'serie-a', kind: 'league', name: 'Lega Serie A', hosts: ['en.legaseriea.it', 'www.legaseriea.it', 'legaseriea.it'],
    indexes: ['https://en.legaseriea.it/news'], articlePath: /^\/(?:en\/media\/serie-a|(?:serie-a\/)?news)\/[^/]+/,
  },
  {
    id: 'ligue-1', kind: 'league', name: 'Ligue 1', hosts: ['ligue1.com', 'www.ligue1.com'],
    indexes: ['https://ligue1.com/en/articles'], articlePath: /^\/en\/articles\/[^/]+/,
  },
  {
    id: 'eredivisie', kind: 'league', name: 'Eredivisie', hosts: ['eredivisie.nl', 'www.eredivisie.nl'],
    indexes: ['https://eredivisie.nl/nieuws/'], articlePath: /^\/nieuws\/[^/]+/,
  },
  {
    id: 'liga-portugal', kind: 'league', name: 'Liga Portugal', hosts: ['www.ligaportugal.pt', 'ligaportugal.pt'],
    indexes: ['https://www.ligaportugal.pt/noticias'], articlePath: /^\/news\/\d+\/[^/]+/,
  },
  {
    id: 'uefa', kind: 'league', name: 'UEFA', hosts: ['www.uefa.com', 'uefa.com'],
    indexes: ['https://www.uefa.com/uefachampionsleague/news/'], articlePath: /^\/uefachampionsleague\/news\/[^/]+/,
  },
  {
    id: 'liiga', kind: 'league', name: 'Liiga', hosts: ['liiga.fi', 'www.liiga.fi'],
    indexes: ['https://liiga.fi/en/news'], articlePath: /^\/(?:en\/news|fi\/uutiset)\/[^/]+/,
  },
  {
    id: 'veikkausliiga', kind: 'league', name: 'Veikkausliiga', hosts: ['www.veikkausliiga.com', 'veikkausliiga.com'],
    indexes: ['https://www.veikkausliiga.com/uutiset/kaikki/'], articlePath: /^\/uutiset\/\d{4}\/\d{2}\/\d{2}\/.+/,
  },
  {
    id: 'yle', kind: 'newsroom', name: 'Yle Sport', hosts: ['yle.fi', 'www.yle.fi'],
    indexes: ['https://yle.fi/rss/urheilu'], articlePath: /^\/a\/\d+-\d+/,
  },
  {
    id: 'mtv', kind: 'newsroom', name: 'MTV Urheilu', hosts: ['www.mtvuutiset.fi', 'mtvuutiset.fi'],
    indexes: ['https://www.mtvuutiset.fi/api/feed/rss/urheilu'], articlePath: /^\/artikkeli\/[^/]+\/\d+/,
  },
]

export function indexesForTeams(source: NewsSource, names: string[]): string[] {
  const teamFeeds = names.flatMap(name => source.teamIndexes?.[name] ?? [])
  return teamFeeds.length ? [...new Set(teamFeeds)] : source.indexes
}

export function sourceForUrl(value: string, sources = NEWS_SOURCES): NewsSource | undefined {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return
    return sources.find(source => source.hosts.includes(url.hostname))
  }
  catch { return }
}
