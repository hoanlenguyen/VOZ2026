// One simulated match file, in the structure of data/mock/<competition>/<id>.json.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  const found = await getMockMatch(id)
  if (!found) throw createError({ statusCode: 404, statusMessage: 'No simulated match with this id' })
  setResponseHeader(event, 'cache-control', 'no-store')
  return found.file
})
