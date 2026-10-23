// Per-provider check that live data (or the snapshot) answers; shown on the status page.
export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const probe = async (provider: ProviderId, path: string, query: UpstreamQuery = {}) => {
    try {
      const { source } = await upstream<unknown>(provider, path, query)
      return { ok: true, source, error: null }
    }
    catch (err) {
      return { ok: false, source: null, error: (err as Error).message }
    }
  }
  return {
    mode: dataMode(),
    providers: {
      'liiga': { keyConfigured: !!config.liigaApiKey, ...await probe('liiga', 'teams', { season: config.liigaSeason, serie: 'runkosarja' }) },
      'football-data': config.footballDataToken || dataMode() === 'snapshot'
        ? { keyConfigured: !!config.footballDataToken, ...await probe('football-data', 'competitions/PL/standings') }
        : { keyConfigured: false, ok: false, source: null, error: 'NUXT_FOOTBALL_DATA_TOKEN is not set' },
    },
  }
})
