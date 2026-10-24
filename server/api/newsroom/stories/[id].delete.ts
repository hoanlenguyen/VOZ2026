// Drop the newsroom's version of a story in one language: the generated story comes back.
export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  await saveStoryEdit(requestLang(event), id, null)
  return { id, edit: null }
})
