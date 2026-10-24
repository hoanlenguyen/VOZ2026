// Mock social-media posts about the match for the discussion section (demo; server/utils/social-comments.ts).
import type { SocialComment } from '#shared/types/comments'

export default defineEventHandler(async (event): Promise<{ posts: SocialComment[], mock: true }> => {
  const { def, provider } = competitionParam(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid match id' })
  const season = await provider.matches(def, {}).then(r => r.data, () => [])
  const match = (await findMockMatch(def, id, season))?.match ?? (await provider.match(def, id)).data
  setResponseHeader(event, 'cache-control', 'public, max-age=300')
  return { posts: mockSocialComments(match), mock: true }
})
