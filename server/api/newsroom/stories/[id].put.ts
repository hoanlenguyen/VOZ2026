// Publish the newsroom's version of a story in one language:
// { front: { headline, summary, body (HTML), audience } | null,
//   story: { mode: 'ai' | 'edited' | 'hidden', audience, headline, body (HTML) } | null }.
// null drops that part (the generated front-page story / the default AI story for subscribers).
export default defineEventHandler(async (event) => {
  const { account } = await requireEntitlement(event, 'newsroom')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  const lang = requestLang(event)
  const body = await readBody<{ front?: Record<string, unknown> | null, story?: Record<string, unknown> | null }>(event)
  // Validate both before saving either.
  const edit = body?.front ? cleanEdit(body.front, account!.name) : null
  const control = body?.story ? cleanStoryControl(body.story, account!.name) : null
  await Promise.all([saveStoryEdit(lang, id, edit), saveMatchStoryControl(lang, id.slice(2), control)])
  return { id, edit, control }
})
