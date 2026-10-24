// Headlines about one match from other outlets (title, source, link only).
export default defineEventHandler(async (event) => {
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  const { data: match } = await provider.match(def, id)
  setResponseHeader(event, 'cache-control', 'public, max-age=900')
  // ?lang= keeps the two languages apart in browser and CDN caches.
  return pressForMatch(match, requestLang(event))
})
