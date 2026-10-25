import { reserveNewsJob } from '../lib/news/database'
import { newsDatabase, newsMonitor } from '../utils/news-monitor'

// Background news monitoring, without Cloudflare Queues (the free plan's 10,000 queue operations a
// day ran out by morning). Every minute the cron plans the due jobs (tick) and then runs a few of
// them itself: at most NEWS_JOBS_PER_RUN, within NEWS_RUN_MS, and only while the daily job budget
// (D1 news_job_budget, newsJobsDailyLimit) lasts. Jobs left over wait for the next minute.
export const NEWS_JOBS_PER_RUN = 4
const NEWS_RUN_MS = 25_000

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('cloudflare:scheduled', async ({ controller }) => {
    // Only the every-minute cron (wrangler.jsonc); the others belong to the podcasts and the newsroom agent.
    if (controller?.cron && controller.cron !== '* * * * *') return
    const config = useRuntimeConfig()
    if (!config.newsMonitorEnabled) return
    const started = Date.now()
    const [monitor, db] = await Promise.all([newsMonitor(), newsDatabase()])
    await monitor.tick()
    const daily = Math.max(0, Number(config.newsJobsDailyLimit) || 0)
    await monitor.drain(NEWS_JOBS_PER_RUN, async () => Date.now() - started < NEWS_RUN_MS && reserveNewsJob(db, Date.now(), daily))
  })

  // Nuxt dev has no Cron delivery. This loop uses the same persisted scheduler and job handlers.
  if (import.meta.dev) {
    let stopped = false, running: Promise<void> | undefined, timer: ReturnType<typeof setTimeout>
    let lastTick = 0
    const run = () => {
      running = (async () => {
        if (!useRuntimeConfig().newsMonitorEnabled) return
        const monitor = await newsMonitor()
        if (Date.now() - lastTick >= 60_000) { await monitor.tick(); lastTick = Date.now() }
        await monitor.drain(4)
      })().catch(() => console.warn('[news-monitor] Background check failed; the next cycle will retry.'))
        .finally(() => { if (!stopped) { timer = setTimeout(run, 1000); timer.unref?.() } })
    }
    timer = setTimeout(run, 5000); timer.unref?.()
    nitro.hooks.hook('close', async () => { stopped = true; clearTimeout(timer); await running })
  }
})
