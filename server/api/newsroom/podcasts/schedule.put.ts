// Saves the daily podcast schedule (newsroom). Body: { subjects: PodcastSubject[], langs: Lang[] };
// unknown subjects are dropped, at most 12 subjects.
import type { PodcastSchedule, PodcastSubject } from '#shared/types/podcast'
import type { Lang } from '#shared/utils/format'

const MAX_SUBJECTS = 12

export default defineEventHandler(async (event): Promise<PodcastSchedule> => {
  await requireEntitlement(event, 'newsroom')
  const body = await readBody<{ subjects?: unknown, langs?: unknown }>(event)
  const seen = new Set<string>()
  const subjects = (Array.isArray(body?.subjects) ? body.subjects : [])
    .map(parseSubject)
    .filter((s): s is PodcastSubject => !!s && s.kind !== 'match' && !seen.has(podcastSubjectId(s)) && !!seen.add(podcastSubjectId(s)))
    .slice(0, MAX_SUBJECTS)
  const langs = (Array.isArray(body?.langs) ? body.langs : []).filter((l): l is Lang => l === 'en' || l === 'fi')
  const schedule = { subjects, langs: langs.length ? [...new Set(langs)] : ['en', 'fi'] as Lang[] }
  await savePodcastSchedule(schedule)
  return schedule
})
