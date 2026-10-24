// Newsroom review of an AI post: { action: 'approve' | 'reject' (reason) | 'reopen' | 'edit' (lang,
// headline, text) | 'revert' (lang) }. Returns the updated post.
import type { AiPost, AiPostAction } from '#shared/types/ai-post'

export default defineEventHandler(async (event): Promise<AiPost> => {
  const { account } = await requireEntitlement(event, 'newsroom')
  const body = await readBody<AiPostAction>(event)
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'Missing action' })
  if ((body.action === 'edit' || body.action === 'revert') && !['en', 'fi'].includes(body.lang)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown language' })
  }
  return reviewAiPost(getRouterParam(event, 'id') ?? '', body, account!.name)
})
