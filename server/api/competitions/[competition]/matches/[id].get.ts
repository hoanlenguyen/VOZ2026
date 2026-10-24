import type { MatchStorySection } from '#shared/types/stories'

export default defineEventHandler(async (event) => {
  const lang = requestLang(event)
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  // The season list is one cached call; without it the page still shows the match, just no comparison.
  const season = await provider.matches(def, {}).then(r => r.data, () => null)

  // A mock "deep data" match (by its own id or the provider's id of the same game) wins over the
  // provider's thinner record and adds the timeline and line-ups.
  const mock = await findMockMatch(def, id, season ?? [], lang)
  let match: Match
  if (mock) {
    match = mock.match
  }
  else {
    const res = await provider.match(def, id)
    match = res.data
    setDataSource(event, res.source)
  }
  // Paywall, enforced here: free and signed-out readers get the match itself, not the premium parts.
  const { entitlements } = await sessionInfo(event)
  const compare = season ? buildCompare(def, match, season, lang) : null
  const extras = mock?.extras ?? null
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const finished = match.status === 'finished'
  // Newsroom control (per language): the match story is the AI version, the newsroom's edit or
  // hidden, for everyone or for subscribers only.
  const control = await matchStoryControl(match.key, lang)
  const { mode, audience, length, tone } = controlSettings(control)
  const hasStory = !!extras && finished && (mode !== 'hidden' || entitlements.newsroom)
  const storyLocked = hasStory && audience === 'subscribers' && !entitlements.premium
  const edited = control?.mode === 'edited'
    ? { headline: control.headline, body: control.body, audience, by: control.by, at: control.at }
    : null
  // Newsroom accounts also get a hidden story's section (mode 'hidden'), so they can see the state.
  const story: MatchStorySection | null = hasStory && !storyLocked ? { mode, audience, length, tone, edited } : null

  // Locked readers see the opening of the match story, fading into the offer. AI text only from stories that already exist (cache / pre-written),
  // so a free reader never starts the agent.
  let teaser: { headline: string, text: string, translated: boolean, source: 'ai' | 'newsroom' } | null = null
  if (storyLocked && mode === 'edited' && edited) {
    teaser = { headline: edited.headline, text: excerpt(edited.body), translated: false, source: 'newsroom' }
  }
  else if (storyLocked) {
    const hit = await peekStory({
      competitionId: def.id, matchId: match.id, length, tone,
      facts: buildFacts(def, match, extras, season ?? []), names: factNames(match, extras),
    }).catch(() => null)
    if (hit) {
      const parts = [hit.story.headline, hit.story.sentences.slice(0, 2).map(s => s.text).join(' ')]
      // Stories are written in English; other languages go through the cached translation agent.
      const [headline, text] = lang === 'en' ? parts.map(p => ({ text: p, translated: false })) : await translateTexts(parts, lang)
      teaser = { headline: headline!.text, text: text!.text, translated: headline!.translated || text!.translated, source: 'ai' }
    }
  }
  return {
    teaser,
    story,
    /** The newsroom's cover image, in place of the match graphic (null: show the graphic). */
    cover: coverOf(control),
    competition: describeCompetition(def, lang),
    match,
    compare: entitlements.premium ? compare : null,
    extras: entitlements.premium ? extras : null,
    /** Premium parts this reader would see with a subscription (empty when nothing is locked). */
    locked: entitlements.premium
      ? []
      : [
          ...(storyLocked ? ['story' as const] : []),
          ...(compare ? ['compare' as const] : []),
          ...(extras?.timeline.length ? ['timeline' as const] : []),
          ...(extras?.lineups ? ['lineups' as const] : []),
        ],
  }
})
