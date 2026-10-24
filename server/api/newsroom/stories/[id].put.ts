// Save (publish) the newsroom's version of a story in one language:
// { headline, summary, body (HTML, sanitised here), audience: 'everyone' | 'subscribers' }.
export default defineEventHandler(async (event) => {
  const { account } = await requireEntitlement(event, 'newsroom')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  const edit = cleanEdit(await readBody<Record<string, unknown>>(event), account!.name)
  await saveStoryEdit(requestLang(event), id, edit)
  return { id, edit }
})
