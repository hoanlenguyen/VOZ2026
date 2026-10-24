// Newsroom dashboard data: today's front-page stories with their moderation state, data-source
// health and the AI caches. Newsroom accounts only.
import type { LandingData } from '#shared/types/stories'

export default defineEventHandler(async (event) => {
  const { account } = await requireEntitlement(event, 'newsroom')
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const lang = requestLang(event)
  // The same stories readers get, before moderation; event.$fetch forwards this editor's cookie.
  const hidden = await hiddenStories()
  const [landing, health] = await Promise.all([
    event.$fetch<LandingData>('/api/landing', { query: { lang, moderation: 'all' } }),
    event.$fetch<{ mode: string, providers: Record<string, { ok: boolean, source: string | null, error: string | null }> }>('/api/health'),
  ])
  const storage = useStorage('kvcache')
  const [translations, aiStories] = await Promise.all([
    storage.getKeys('tr').then(k => k.length, () => 0),
    useStorage('assets:stories').getKeys().then(k => k.filter(x => x.endsWith('.json')).length, () => 0),
  ])
  return {
    editor: account!,
    stories: landing.stories.map(s => ({ ...s, hidden: hidden.has(s.id) })),
    missing: landing.missing,
    health,
    ai: { translationsCached: translations, aiStoriesBundled: aiStories },
  }
})
