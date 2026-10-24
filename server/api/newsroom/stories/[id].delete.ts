// Drop the newsroom's control of a match story in one language: the AI story for subscribers comes back.
export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  await saveMatchStoryControl(requestLang(event), id.slice(2), null)
  return { id, control: null }
})
