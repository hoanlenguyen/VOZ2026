// Removes a simulated match, e.g. to simulate the fixture again (same seed, same match).
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  if (!await deleteMockMatch(id)) throw createError({ statusCode: 404, statusMessage: 'No simulated match with this id' })
  return { deleted: id }
})
