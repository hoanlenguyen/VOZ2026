// Daily AI podcasts: every team and league in the newsroom's schedule gets a new episode in each
// scheduled language when its facts changed since the last one. Runs from the Workers cron trigger
// (wrangler.jsonc `triggers.crons`, mapped in nuxt.config `nitro.scheduledTasks`); in dev:
// GET /_nitro/tasks/podcasts:daily.
export default defineTask({
  meta: { name: 'podcasts:daily', description: 'Write and read aloud the daily team and league podcasts' },
  async run() {
    const run = await runDailyPodcasts('schedule')
    const count = (s: string) => run.results.filter(r => r.status === s).length
    console.info(`[podcast] daily run: ${count('created')} created, ${count('unchanged')} unchanged, ${count('failed')} failed`)
    return { result: run }
  },
})
