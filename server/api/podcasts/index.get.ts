// AI podcast episodes, newest first: ?lang=en|fi (default the reader's), ?subject=<subject id>
// (e.g. match-premier-league-2645271), ?limit= (1–30). Public: episodes are free to listen to.
import type { PodcastListResponse } from '#shared/types/podcast'

export default defineEventHandler(async (event): Promise<PodcastListResponse> => {
  const q = getQuery(event)
  const lang = requestLang(event)
  const subjectId = typeof q.subject === 'string' && /^[a-z0-9-]+$/.test(q.subject) ? q.subject : undefined
  const limit = Math.min(30, Math.max(1, Number(q.limit) || 8))
  // Revalidated every time: the newsroom page lists a regenerated episode right after making it.
  setResponseHeader(event, 'cache-control', 'no-cache')
  return { episodes: await listEpisodes({ lang, subjectId, limit }) }
})
