// Mock fan communities and their posts for the Communities tab (demo; server/utils/communities.ts).
import type { CommunitiesFeed } from '#shared/types/communities'

export default defineEventHandler((event): CommunitiesFeed => {
  setResponseHeader(event, 'cache-control', 'public, max-age=60')
  return communitiesFeed()
})
