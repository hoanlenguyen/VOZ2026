// One front-page story for the editor: the generated version and the newsroom edit (if any), in
// the requested language. Newsroom accounts only.
import type { LandingData } from '#shared/types/stories'

export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  const lang = requestLang(event)
  const [landing, edits] = await Promise.all([
    event.$fetch<LandingData>('/api/landing', { query: { lang, moderation: 'all', edits: 'off' } }),
    storyEdits(lang),
  ])
  const story = landing.stories.find(s => s.id === id)
  if (!story) throw createError({ statusCode: 404, statusMessage: 'Story is not on the front page' })
  // `story` is the generated version (what "Revert to automatic" brings back).
  return { story, edit: edits[id] ?? null }
})
