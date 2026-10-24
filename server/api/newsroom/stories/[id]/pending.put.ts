// Save the editor's changes without publishing: { state: 'draft' | 'review', ...control }.
// 'review' marks it ready for review (status "preview"). Readers keep the published version.
export default defineEventHandler(async (event) => {
  const { account } = await requireEntitlement(event, 'newsroom')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  const body = await readBody<Record<string, unknown>>(event)
  const control = cleanStoryControl(body, account!.name)
  if (control.cover && !(await loadImage(control.cover.id))) throw createError({ statusCode: 400, statusMessage: 'Upload the cover image again' })
  const pending = { control, state: body?.state === 'review' ? 'review' as const : 'draft' as const, by: account!.name, at: control.at }
  await savePending(requestLang(event), id.slice(2), pending)
  return { id, pending }
})
