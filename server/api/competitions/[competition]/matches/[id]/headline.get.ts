// AI title + subtitle for a match post: ?lang=en|fi. Written from the fact ledger and the "edge"
// facts, checked before it is returned, and cached with the landing page's headlines (one cache,
// so a headline written for either page is reused by both). ?fresh=1 regenerates (dev only).
// headline is null without an API key or when no version passed the check: the page keeps its score title.
import type { HeadlineResponse } from '#shared/types/headline'

export default defineEventHandler(async (event): Promise<HeadlineResponse> => {
  const lang = requestLang(event)
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })

  const season = await provider.matches(def, {}).then(r => r.data, () => [])
  // Facts are written in English (like the story's); mocks are read in English for the same reason.
  const mock = await findMockMatch(def, id, season)
  const match = mock?.match ?? (await provider.match(def, id)).data
  if (match.status !== 'finished' && match.status !== 'scheduled') return { headline: null, cached: false }

  return matchHeadline(
    { competition: def, match, extras: mock?.extras ?? null, season },
    lang,
    { fresh: import.meta.dev && getQuery(event).fresh === '1' },
  )
})
