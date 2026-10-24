// Discard the saved draft: the story is back to its published (live) version in the editor.
export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  await savePending(requestLang(event), id.slice(2), null)
  return { id, pending: null }
})
