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
  const compare = season ? buildCompare(def, match, season, lang) : null
  const extras = mock?.extras ?? null
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const finished = match.status === 'finished'
  // Newsroom control (per language): the match story is the AI version, the newsroom's edit or
  // hidden; audience 'everyone' opens the whole match page (story, comparison, timeline, line-ups)
  // to free and signed-out readers, 'subscribers' (the default) keeps them premium.
  // (A newsroom preview of a draft: the draft, seen as a subscriber or a free reader.)
  const { entitlements, control } = await readerContext(event, match.key, lang)
  const settings = controlSettings(control)
  // A story hidden in the newsroom is off the match page too (newsroom accounts see the note).
  const mode = (await isMatchHidden(match.key)) ? 'hidden' as const : settings.mode
  const { audience, length, tone } = settings
  const open = entitlements.premium || audience === 'everyone'
  const hasStory = !!extras && finished && (mode !== 'hidden' || entitlements.newsroom)
  const storyLocked = hasStory && !open
  const edited = control?.mode === 'edited'
    ? { headline: control.headline, body: control.body, audience, by: control.by, at: control.at }
    : null
  // Cached AI stories only (memory / KV / pre-written), never an agent run. Facts as the story endpoint
  // builds them (from the English mock), so the cache keys match.
  const peek = async (storyLang: typeof lang) => {
    const source = lang === 'en' ? mock : await findMockMatch(def, id, season ?? [])
    const m = source?.match ?? match
    const x = source?.extras ?? extras
    return peekStory({
      competitionId: def.id, matchId: match.id, length, tone, lang: storyLang,
      facts: buildFacts(def, m, x, season ?? []), names: factNames(m, x),
    }).catch(() => null)
  }
  // Newsroom accounts also get a hidden story's section (mode 'hidden'), so they can see the state.
  // The story's headline is the page title, with its date and author below; for the AI story they
  // come from the cache when it is there (otherwise the page takes them from the story once loaded).
  const cachedAi = hasStory && !storyLocked && mode === 'ai' ? (await peek(lang))?.story ?? null : null
  const story: MatchStorySection | null = hasStory && !storyLocked
    ? {
        mode, audience, length, tone, edited,
        headline: edited?.headline ?? cachedAi?.headline ?? null,
        publishedAt: edited?.at ?? cachedAi?.generatedAt ?? null,
      }
    : null

  // Locked readers see the opening of the match story, fading into the offer. AI text only from stories that already exist (cache / pre-written),
  // so a free reader never starts the agent.
  let teaser: { headline: string, text: string, translated: boolean, source: 'ai' | 'newsroom' } | null = null
  if (storyLocked && mode === 'edited' && edited) {
    teaser = { headline: edited.headline, text: excerpt(edited.body), translated: false, source: 'newsroom' }
  }
  else if (storyLocked) {
    // The story in the reader's language when one exists; otherwise the English one, translated.
    const own = lang === 'en' ? null : await peek(lang)
    const hit = own ?? await peek('en')
    if (hit) {
      const parts = [hit.story.headline, hit.story.sentences.slice(0, 2).map(s => s.text).join(' ')]
      const [headline, text] = own || lang === 'en' ? parts.map(p => ({ text: p, translated: false })) : await translateTexts(parts, lang)
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
    compare: open ? compare : null,
    extras: open ? extras : null,
    /** Premium parts this reader would see with a subscription (empty when nothing is locked). */
    locked: open
      ? []
      : [
          ...(storyLocked ? ['story' as const] : []),
          ...(compare ? ['compare' as const] : []),
          ...(extras?.timeline.length ? ['timeline' as const] : []),
          ...(extras?.lineups ? ['lineups' as const] : []),
        ],
  }
})
