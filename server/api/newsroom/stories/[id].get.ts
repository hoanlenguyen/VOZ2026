// One front-page story for the editor, in the requested language: the generated version, the
// newsroom's edit (if any), and the match story control when the match page has a story section.
// Newsroom accounts only.
import type { LandingData, MatchStorySection } from '#shared/types/stories'

export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  const lang = requestLang(event)
  const [landing, edits, control] = await Promise.all([
    event.$fetch<LandingData>('/api/landing', { query: { lang, moderation: 'all', edits: 'off' } }),
    storyEdits(lang),
    matchStoryControl(id.slice(2), lang),
  ])
  const story = landing.stories.find(s => s.id === id)
  if (!story) throw createError({ statusCode: 404, statusMessage: 'Story is not on the front page' })
  // The match API decides whether the page has a story section (finished match with full data).
  const page = await event.$fetch<{ story: MatchStorySection | null }>(`/api/competitions/${story.competitionId}/matches/${story.href.split('/').pop()}`, { query: { lang } })
    .catch(() => ({ story: null }))
  // `story` is the generated version (what "Revert to automatic" brings back).
  return { story, edit: edits[id] ?? null, matchStory: { available: page.story !== null, control } }
})
