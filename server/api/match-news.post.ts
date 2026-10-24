import { NewsInputError, parseNewsInput } from '../lib/news/input'

export default defineEventHandler(async (event) => {
  if (!(getHeader(event, 'content-type') ?? '').toLowerCase().startsWith('application/json')) {
    throw createError({ statusCode: 415, statusMessage: 'Send application/json.' })
  }
  // Read a bounded body even when Content-Length is missing or untrusted.
  const reader = getRequestWebStream(event)?.getReader()
  if (!reader) throw createError({ statusCode: 400, statusMessage: 'JSON body is required.' })
  const decoder = new TextDecoder()
  let text = '', size = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 256 * 1024) {
        await reader.cancel()
        throw createError({ statusCode: 413, statusMessage: 'Match JSON must be at most 256 KiB.' })
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
  }
  finally { reader.releaseLock() }
  try {
    const match = parseNewsInput(JSON.parse(text))
    setResponseHeader(event, 'cache-control', 'no-store')
    return await cachedMatchNews(JSON.stringify(match))
  }
  catch (error) {
    if (error instanceof SyntaxError || error instanceof NewsInputError) {
      throw createError({ statusCode: 400, statusMessage: error instanceof NewsInputError ? error.message : 'Invalid JSON.' })
    }
    throw error
  }
})
