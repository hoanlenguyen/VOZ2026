// One front-page story for the match story editor, in the requested language: the story (for its
// match), the newsroom's control of the match story, and whether the match page has a story section.
// Newsroom accounts only.
import type { LandingData, MatchStorySection } from '#shared/types/stories'

export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  const lang = requestLang(event)
  const [landing, control, pending, hidden] = await Promise.all([
    event.$fetch<LandingData>('/api/landing', { query: { lang, moderation: 'all' } }),
    matchStoryControl(id.slice(2), lang),
    pendingEdits(lang).then(m => m[id.slice(2)] ?? null),
    hiddenStories().then(h => h.has(id)),
  ])
  const story = landing.stories.find(s => s.id === id)
  if (!story) throw createError({ statusCode: 404, statusMessage: 'Story is not on the front page' })
  // The match API decides whether the page has a story section (finished match with full data).
  const page = await event.$fetch<{ story: MatchStorySection | null }>(`/api/competitions/${story.competitionId}/matches/${story.href.split('/').pop()}`, { query: { lang } })
    .catch(() => ({ story: null }))
  return { story, matchStory: { available: page.story !== null, control }, pending, hidden, status: storyStatus(hidden, pending ?? undefined) }
})
