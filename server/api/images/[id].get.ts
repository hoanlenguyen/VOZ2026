// Newsroom cover images (server/utils/story-images.ts). Public: covers show on the front page.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!IMAGE_ID.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid image id' })
  const img = await loadImage(id)
  if (!img) throw createError({ statusCode: 404, statusMessage: 'Image not found' })
  setResponseHeaders(event, {
    'content-type': img.type,
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  })
  return img.bytes
})
