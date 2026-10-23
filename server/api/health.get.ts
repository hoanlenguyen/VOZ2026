// Quick check that the Liiga API (or the snapshot) answers; shown on the dev status page.
export default defineEventHandler(async () => {
  const mode = String(useRuntimeConfig().dataMode)
  const keyConfigured = !!useRuntimeConfig().liigaApiKey
  try {
    const { source } = await liiga<unknown>('teams', { season: currentSeason(), serie: currentSerie() })
    return { ok: true, mode, keyConfigured, source }
  }
  catch (err) {
    return { ok: false, mode, keyConfigured, source: null, error: (err as Error).message }
  }
})
