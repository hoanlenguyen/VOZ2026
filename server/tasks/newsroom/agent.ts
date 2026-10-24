// Newsroom agent tick: every AGENT_CRON (wrangler.jsonc `triggers.crons`, mapped in nuxt.config
// `nitro.scheduledTasks`); writes posts only when the agent is enabled and the newsroom's interval
// has passed since the last run (server/utils/ai-posts.ts). In dev: GET /_nitro/tasks/newsroom:agent.
export default defineTask({
  meta: { name: 'newsroom:agent', description: 'Turn new SportWorld matches into AI posts for review' },
  async run() {
    const run = await runScheduledAgent()
    if (run) console.info(`[newsroom-agent] ${run.results.filter(r => r.status === 'created').length} posts written, ${run.waiting} matches waiting`)
    return { result: run ?? 'not due' }
  },
})
