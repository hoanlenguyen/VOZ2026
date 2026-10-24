import type { H3Event } from 'h3'

/** Both discovery and synthesis resolve status server-side, never trusting a client-supplied phase. */
export async function resolveNewsMatch(event: H3Event) {
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  const mock = await findMockMatch(def, id, [])
  if (mock) return mock.match
  const result = await provider.match(def, id)
  setDataSource(event, result.source)
  return result.data
}
