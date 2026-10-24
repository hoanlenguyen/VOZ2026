import { SummaryError } from '../../../../../lib/news/summary'

// Client auto-loads one synthesis for this match; status and source URLs are resolved server-side.
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    const match = await resolveNewsMatch(event)
    const coverage = await newsCoverageForMatch(match)
    const result = await summarizeMatchCoverage(coverage)
    setResponseHeader(event, 'x-voz-summary-cache', result.cached ? 'hit' : 'miss')
    return result
  }
  catch (error) {
    if (error instanceof SummaryError) throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    throw error
  }
})
