import { SummaryError } from '../../../lib/news/summary'

// This is deliberately POST-only and is called by the headline click handler, never discovery.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[a-f0-9]{64}$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid news item.' })
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    const result = await summarizeRegisteredNews(id)
    setResponseHeader(event, 'x-voz-summary-cache', result.cached ? 'hit' : 'miss')
    return result
  }
  catch (error) {
    if (error instanceof SummaryError) throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    throw error
  }
})
