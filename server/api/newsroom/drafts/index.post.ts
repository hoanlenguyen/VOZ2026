// Save the editor's unsaved match story settings as a preview draft (1 hour): { id: storyId, ...control }.
// Returns the draft id for the match page's ?draft= preview. Newsroom accounts only.
export default defineEventHandler(async (event) => {
  const { account } = await requireEntitlement(event, 'newsroom')
  const body = await readBody<Record<string, unknown>>(event)
  const id = typeof body?.id === 'string' ? body.id : ''
  if (!STORY_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  const control = cleanStoryControl(body, account!.name)
  return { draft: await saveDraft(id.slice(2), control) }
})
