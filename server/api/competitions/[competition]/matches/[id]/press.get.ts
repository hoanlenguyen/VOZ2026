// Headlines about one match from other outlets (title, source, link only).
export default defineEventHandler(async (event) => {
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  const { data: match } = await provider.match(def, id)
  // ?lang= keeps the two languages apart in browser and CDN caches. Only real results are cached:
  // "unavailable" (no key, quota) and "none" must not stick in the browser for 15 minutes.
  const result = await pressForMatch(match, requestLang(event))
  setResponseHeader(event, 'cache-control', result.status === 'ok' ? 'public, max-age=900' : 'no-store')
  return result
})
