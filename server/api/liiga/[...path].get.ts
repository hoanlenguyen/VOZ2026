// Read-only proxy to the Liiga stats API (relative to /api/v1). The API key stays on the server.
export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') ?? ''
  const query = getQuery(event) as LiigaQuery
  const { data, source } = await liiga<unknown>(path, query)
  setDataSource(event, source)
  return data
})
