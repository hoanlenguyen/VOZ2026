// AI match story: ?length=short|standard|long&tone=neutral|home-fan|away-fan|analyst&lang=en|fi
// Written by the story agent from the fact ledger and checked before it is returned; cached in
// memory, KV and (for the demo) pre-written bundles. ?fresh=1 regenerates (dev only).
// Who may read it follows the newsroom's control for the match (?lang=, per language): by default
// subscribers; everyone when published for everyone; only the newsroom when the newsroom replaced
// it with an edited version or hid it. Readers get the version the newsroom published (length and
// tone); only newsroom accounts may ask for the others.
import type { StoryLength, StoryResponse, StoryTone } from '#shared/types/story'

const LENGTHS: StoryLength[] = ['short', 'standard', 'long']
const TONES: StoryTone[] = ['neutral', 'home-fan', 'away-fan', 'analyst']

export default defineEventHandler(async (event): Promise<StoryResponse> => {
  const lang = requestLang(event)
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  const q = getQuery(event)
  let length = LENGTHS.includes(q.length as StoryLength) ? q.length as StoryLength : 'standard'
  let tone = TONES.includes(q.tone as StoryTone) ? q.tone as StoryTone : 'neutral'

  const season = await provider.matches(def, {}).then(r => r.data, () => [])
  const mock = await findMockMatch(def, id, season)
  const match = mock?.match ?? (await provider.match(def, id)).data
  // A newsroom preview of a draft reads as a subscriber or free reader (readerContext).
  const reader = await readerContext(event, match.key, requestLang(event))
  const { entitlements } = reader
  const published = controlSettings(reader.control)
  const { audience } = published
  const mode = (await isMatchHidden(match.key)) ? 'hidden' : published.mode
  if (!entitlements.newsroom) {
    if (mode !== 'ai') throw createError({ statusCode: 404, statusMessage: 'No AI story for this match' })
    if (audience === 'subscribers' && !entitlements.premium) {
      if (!reader.preview) await requireEntitlement(event, 'premium')
      throw createError({ statusCode: 403, statusMessage: 'Subscribers only' })
    }
    ;[length, tone] = [published.length, published.tone]
  }
  if (match.status !== 'finished') throw createError({ statusCode: 409, statusMessage: 'Stories are written after the final whistle' })

  const extras = mock?.extras ?? null
  const facts = buildFacts(def, match, extras, season)
  const names = factNames(match, extras)
  const { story, cached } = await cachedStory({
    competitionId: def.id,
    matchId: match.id,
    length,
    tone,
    lang,
    facts,
    names,
    fresh: import.meta.dev && q.fresh === '1',
    generate: () => runStoryAgent({ match, competitionName: def.name, facts, names, length, tone, lang }),
  })
  return { story, facts, names, cached: cached !== false }
})
