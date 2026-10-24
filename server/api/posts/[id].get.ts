// An approved AI match post for readers (?lang=en|fi; falls back to the language it was written in).
import type { ReaderPost } from '#shared/types/ai-post'

export default defineEventHandler(async (event): Promise<ReaderPost> => {
  const post = await readerPost(getRouterParam(event, 'id') ?? '', requestLang(event))
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  setResponseHeader(event, 'cache-control', 'no-store')
  return post
})
