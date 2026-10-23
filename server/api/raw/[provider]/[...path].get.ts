// Debug passthrough to an upstream API (keys stay on the server). Disabled in production builds.
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 404 })
  const provider = getRouterParam(event, 'provider') as ProviderId
  if (provider !== 'liiga' && provider !== 'football-data') throw createError({ statusCode: 404, statusMessage: 'Unknown provider' })
  const { data, source } = await upstream<unknown>(provider, getRouterParam(event, 'path') ?? '', getQuery(event) as UpstreamQuery)
  setDataSource(event, source)
  return data
})
