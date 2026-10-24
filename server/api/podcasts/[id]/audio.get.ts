// MP3 of a generated podcast episode (kvcache). Supports Range requests, which Safari needs to play
// audio. Bundled demo episodes are static files under /podcasts/ instead.

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^[a-z0-9.-]+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid episode id' })
  const audio = await episodeAudio(id)
  if (!audio) throw createError({ statusCode: 404, statusMessage: 'No audio for this episode' })
  setResponseHeaders(event, {
    'content-type': 'audio/mpeg',
    'accept-ranges': 'bytes',
    // The URL carries ?v=<version>, so a regenerated episode gets a new URL.
    'cache-control': 'public, max-age=86400',
  })
  const range = /^bytes=(\d*)-(\d*)$/.exec(getRequestHeader(event, 'range') ?? '')
  if (!range || (!range[1] && !range[2])) {
    setResponseHeader(event, 'content-length', audio.length)
    return audio
  }
  const size = audio.length
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
  if (start >= size || start > end) {
    setResponseStatus(event, 416)
    setResponseHeader(event, 'content-range', `bytes */${size}`)
    return ''
  }
  setResponseStatus(event, 206)
  setResponseHeaders(event, { 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 })
  return audio.subarray(start, end + 1)
})
