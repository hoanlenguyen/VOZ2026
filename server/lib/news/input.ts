import { Temporal } from '@js-temporal/polyfill'
import { resolveNewsCompetition } from './source-policy.ts'

export interface NewsMatch {
  matchId: string | null
  home: string[]
  away: string[]
  kickoff: number
  date: string
  limit: 3 | 4
  status?: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled'
  competitionId?: string
}

export class NewsInputError extends Error {}

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NewsInputError('Expected a JSON object.')
  return value as Record<string, unknown>
}

export const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')

export function teamNameVariants(value: unknown): string[] {
  const team = object(value)
  if (typeof team.name !== 'string' || team.name.trim().length < 2 || team.name.length > 100) {
    throw new NewsInputError('Each team needs a name between 2 and 100 characters.')
  }
  const variants = [team.name]
  if (typeof team.shortName === 'string' && team.shortName.length >= 3 && team.shortName.length <= 100) variants.push(team.shortName)
  const name = normalize(team.name).replace(/\b(?:fc|afc|cf)\b/g, '').trim()
  variants.push(name)
  // Explicit aliases avoid ambiguous first-word matches (e.g. Manchester, Nottingham).
  const aliases: Record<string, string[]> = {
    'ipswich town': ['ipswich'], 'nottingham forest': ['nottm forest', 'nott m forest', 'n forest'],
    'tottenham hotspur': ['tottenham', 'spurs'], 'manchester united': ['man utd', 'manchester utd'],
    'manchester city': ['man city'], 'wolverhampton wanderers': ['wolves'],
    'az': ['az alkmaar', 'alkmaar'],
  }
  return [...new Set([...variants.map(normalize), ...(Object.hasOwn(aliases, name) ? aliases[name]! : [])])].filter(Boolean)
}

/** Accepts either the user's complete match file or its matchInfo object. */
export function parseNewsInput(value: unknown): NewsMatch {
  const body = object(value)
  const info = object(body.matchInfo ?? body)
  const league = info.competitionId ?? info.competition ?? body.competitionId
  const competitionId = typeof league === 'string' ? resolveNewsCompetition(league) : undefined
  if (league !== undefined && !competitionId) throw new NewsInputError('Unsupported competition. Supply a supported competitionId or league name.')
  const home = teamNameVariants(info.homeTeam)
  const away = teamNameVariants(info.awayTeam)
  if (home[0] === away[0]) throw new NewsInputError('Home and away teams must be different.')
  const limit = body.limit ?? 4
  if (limit !== 3 && limit !== 4) throw new NewsInputError('limit must be 3 or 4.')
  if (typeof info.kickoff !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(info.kickoff)) {
    throw new NewsInputError('kickoff must be an ISO date/time or YYYY-MM-DD HH:mm:ss.')
  }
  let kickoff: number
  try {
    const time = info.kickoff.replace(' ', 'T')
    if (/(?:Z|[+-]\d{2}:\d{2})$/.test(time)) kickoff = Temporal.Instant.from(time).epochMilliseconds
    else {
      if (typeof info.kickoffTimezone !== 'string') throw new Error('Missing timezone')
      kickoff = Temporal.PlainDateTime.from(time, { overflow: 'reject' })
        .toZonedDateTime(info.kickoffTimezone, { disambiguation: 'reject' }).epochMilliseconds
    }
  }
  catch { throw new NewsInputError('Invalid kickoff or timezone; local times require an IANA kickoffTimezone. Use an explicit offset for ambiguous DST times.') }
  const id = info.matchId
  if (id !== undefined && (typeof id !== 'string' && typeof id !== 'number' || String(id).length > 100)) {
    throw new NewsInputError('Invalid matchId.')
  }
  const rawStatus = typeof info.status === 'string' ? info.status.toLowerCase() : ''
  const status: NewsMatch['status'] = /fulltime|finished|post-match/.test(rawStatus) ? 'finished'
    : /^(live|inplay|streaming)$/.test(rawStatus) ? 'live'
      : rawStatus === 'upcoming' ? 'scheduled'
        : /^(postponed|cancelled|scheduled)$/.test(rawStatus) ? rawStatus as NewsMatch['status'] : undefined
  return { matchId: id === undefined ? null : String(id), home, away, kickoff, date: info.kickoff.slice(0, 10), limit, ...(status ? { status } : {}), ...(competitionId ? { competitionId } : {}) }
}

export const mentionsTeam = (text: string, names: string[]) => {
  const normalized = ` ${normalize(text)} `
  return names.some(name => normalized.includes(` ${name} `))
}
