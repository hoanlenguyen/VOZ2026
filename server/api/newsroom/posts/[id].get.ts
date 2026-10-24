// One AI match post with its stories, facts and publisher links (newsroom only; readers get
// approved posts through the match page).
import type { AiPost } from '#shared/types/ai-post'

export default defineEventHandler(async (event): Promise<AiPost> => {
  await requireEntitlement(event, 'newsroom')
  const post = await getAiPost(getRouterParam(event, 'id') ?? '')
  if (!post) throw createError({ statusCode: 404, statusMessage: 'No AI post with this id' })
  setResponseHeader(event, 'cache-control', 'no-store')
  return post
})
