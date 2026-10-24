// AI press roundup of an upcoming match (server/utils/roundup-agent.ts): a breaking-news style
// headline and a short pre-match piece from the press headlines and VOZ facts. Subscribers get it
// in full and may trigger writing it; free and signed-out readers get the headline and opening
// from the cache only (no model call), locked.
import type { RoundupResponse } from '#shared/types/roundup'

export default defineEventHandler(async (event): Promise<RoundupResponse> => {
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const lang = requestLang(event)
  const [{ data: match }, season] = await Promise.all([provider.match(def, id), provider.matches(def, {}).then(r => r.data, () => [])])
  if (match.status === 'finished') throw createError({ statusCode: 409, statusMessage: 'Roundups are written before the match' })

  const press = await pressForMatch(match, lang)
  if (press.status !== 'ok') return { status: press.status === 'none' ? 'none' : 'unavailable', roundup: null, locked: false }
  const prepared = prepareRoundup({ competition: def, match, season, articles: press.articles }, lang)
  if (!prepared) return { status: 'none', roundup: null, locked: false }

  const { entitlements } = await sessionInfo(event)
  if (entitlements.premium) {
    const roundup = await pressRoundup(prepared, lang)
    return { status: roundup ? 'ok' : 'unavailable', roundup, locked: false }
  }
  const cached = await cachedRoundup(prepared)
  if (!cached) return { status: 'none', roundup: null, locked: true }
  // The opening only; the source list stays whole (those headlines are public in "What the press says").
  return { status: 'ok', locked: true, roundup: { ...cached, sentences: cached.sentences.slice(0, 1) } }
})
