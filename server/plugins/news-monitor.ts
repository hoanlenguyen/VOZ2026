import { newsMonitor } from '../utils/news-monitor'

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('cloudflare:scheduled', async ({ env }) => {
    if (!useRuntimeConfig().newsMonitorEnabled) return
    const queue = (env as { VOZ_NEWS_QUEUE?: { send(value: object): Promise<void> } }).VOZ_NEWS_QUEUE
    if (!queue) throw new Error('News monitoring queue is not configured')
    await (await newsMonitor()).tick(id => queue.send({ id }))
  })
  nitro.hooks.hook('cloudflare:queue', async ({ batch }) => {
    if (!useRuntimeConfig().newsMonitorEnabled) { batch.ackAll(); return }
    if (batch.queue !== 'voz-news') return
    const monitor = await newsMonitor()
    for (const message of batch.messages) {
      const id = (message.body as { id?: unknown } | null)?.id
      if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) { message.ack(); continue }
      try { await monitor.process(id); message.ack() }
      catch { message.retry({ delaySeconds: Math.min(900, 60 * 2 ** Math.min(message.attempts, 4)) }) }
    }
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
