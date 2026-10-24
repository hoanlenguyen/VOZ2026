// Publish the newsroom's control of a match story in one language:
// { mode: 'ai' | 'edited' | 'hidden', audience: 'everyone' | 'subscribers', headline, body (HTML),
//   cover: { id, alt, credit } | null }.
export default defineEventHandler(async (event) => {
  const { account } = await requireEntitlement(event, 'newsroom')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  const control = cleanStoryControl(await readBody<Record<string, unknown>>(event), account!.name)
  if (control.cover && !(await loadImage(control.cover.id))) throw createError({ statusCode: 400, statusMessage: 'Upload the cover image again' })
  // Publishing makes it live: the saved draft (if any) is done.
  await Promise.all([saveMatchStoryControl(requestLang(event), id.slice(2), control), savePending(requestLang(event), id.slice(2), null)])
  return { id, control }
})
