// Drop the newsroom's version of a story in one language: the generated front-page story and the
// default AI match story (for subscribers) come back.
export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  const lang = requestLang(event)
  await Promise.all([saveStoryEdit(lang, id, null), saveMatchStoryControl(lang, id.slice(2), null)])
  return { id, edit: null, control: null }
})
