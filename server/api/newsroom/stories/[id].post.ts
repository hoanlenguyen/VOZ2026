// Hide or show a front-page story: { hidden: boolean }. Newsroom accounts only.
export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  if (!/^[rp]-[\w-]+:\w+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid story id' })
  const body = await readBody<{ hidden?: unknown }>(event)
  const set = await setStoryHidden(id, body?.hidden === true)
  return { id, hidden: set.has(id) }
})
