// "Generate podcast" (newsroom): writes and reads aloud an episode about one match, team or league.
// Body: { subject: PodcastSubject, langs?: ['en', 'fi'], force?: boolean }. Without `force` an
// episode whose facts did not change is returned as is. Languages are written at the same time.
import type { PodcastEpisode } from '#shared/types/podcast'
import type { Lang } from '#shared/utils/format'

export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  const body = await readBody<{ subject?: unknown, langs?: unknown, force?: unknown }>(event)
  const subject = parseSubject(body?.subject)
  if (!subject) throw createError({ statusCode: 400, statusMessage: 'Unknown podcast subject' })
  const langs = (Array.isArray(body?.langs) ? body.langs : ['en', 'fi']).filter((l): l is Lang => l === 'en' || l === 'fi')
  if (!langs.length) throw createError({ statusCode: 400, statusMessage: 'No language' })
  const episodes: Array<{ episode: PodcastEpisode, status: 'created' | 'unchanged' }> = await Promise.all(
    [...new Set(langs)].map(lang => generateEpisode(subject, lang, { trigger: 'newsroom', force: body?.force === true })),
  )
  return { episodes }
})
