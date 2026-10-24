<script setup lang="ts">
// Newsroom dashboard: the AI newsroom agent. It turns new SportWorld matches (simulated match data)
// into AI match posts that wait here for review. The cron ticks every 5 minutes and runs the agent
// when the interval chosen here has passed; "Run now" runs it at once.
import { PhArrowSquareOut, PhPlay } from '@phosphor-icons/vue'
import type { AgentDesk, AgentRun, AgentSettings } from '#shared/types/ai-post'
import type { Lang } from '#shared/utils/format'
import { INTERVAL_OPTIONS } from '#shared/utils/newsroom-agent'

const { t, locale } = useI18n()
const { stamp } = useFormat()
const { data, error, refresh } = useLazyFetch<AgentDesk>('/api/newsroom/agent', { server: false })

const form = reactive<AgentSettings>({ enabled: true, intervalMinutes: 15, langs: ['en', 'fi'] })
watch(() => data.value?.settings, (s) => { if (s) Object.assign(form, { ...s, langs: [...s.langs] }) }, { immediate: true })
const dirty = computed(() => !!data.value && JSON.stringify({ ...form, langs: [...form.langs].sort() }) !== JSON.stringify({ ...data.value.settings, langs: [...data.value.settings.langs].sort() }))

const intervalLabel = (m: number) => (m < 60
  ? t('agent.minutes', { n: m }, m)
  : t('agent.hours', { n: m / 60 }, m / 60))
const score = (s: { home: number, away: number }) => `${s.home}–${s.away}`

const busy = ref<'save' | 'run' | null>(null)
const note = ref('')
async function act(kind: 'save' | 'run', job: () => Promise<string>) {
  busy.value = kind
  note.value = ''
  try {
    note.value = await job()
    await refresh()
  }
  catch (err) {
    note.value = t('agent.failed', { reason: (err as { statusMessage?: string }).statusMessage ?? String(err) })
  }
  finally {
    busy.value = null
  }
}
const save = () => act('save', async () => {
  await $fetch('/api/newsroom/agent/settings', { method: 'PUT', body: form })
  return t('agent.saved')
})
const runNow = () => act('run', async () => {
  const run = await $fetch<AgentRun>('/api/newsroom/agent/run', { method: 'POST' })
  const made = run.results.filter(r => r.status === 'created').length
  return run.results.length ? t('agent.ran', { n: made }, made) : t('agent.nothing')
})
const LANGS: Lang[] = ['en', 'fi']
</script>

<template>
  <section class="block" aria-labelledby="agent-title">
    <NewsSectionTitle id="agent-title">{{ t('agent.title') }}</NewsSectionTitle>
    <p class="meta">{{ t('agent.lead') }}</p>
    <p v-if="error" class="meta" role="alert">{{ t('agent.failed', { reason: error.statusMessage }) }}</p>
    <p v-else-if="!data" class="meta">{{ t('agent.loading') }}</p>

    <template v-else>
      <p v-if="!data.aiConfigured" class="warn">{{ t('agent.noKey') }}</p>

      <div class="controls">
        <label class="check">
          <input v-model="form.enabled" type="checkbox"> {{ t('agent.enabled') }}
        </label>
        <label class="field">
          <span class="field-label">{{ t('agent.interval') }}</span>
          <select v-model.number="form.intervalMinutes" class="pick">
            <option v-for="m in INTERVAL_OPTIONS" :key="m" :value="m">{{ intervalLabel(m) }}</option>
          </select>
        </label>
        <fieldset class="langs">
          <legend class="field-label">{{ t('agent.langs') }}</legend>
          <label v-for="l in LANGS" :key="l" class="check">
            <input v-model="form.langs" type="checkbox" :value="l"> {{ t(`podcast.langs.${l}`) }}
          </label>
        </fieldset>
      </div>

      <div class="controls">
        <button type="button" class="btn btn--primary" :disabled="!dirty || !form.langs.length || !!busy" @click="save">{{ t('agent.save') }}</button>
        <button type="button" class="btn" :disabled="!!busy" :aria-busy="busy === 'run'" @click="runNow">
          <PhPlay :size="16" weight="bold" aria-hidden="true" />
          {{ busy === 'run' ? t('agent.running') : t('agent.runNow') }}
        </button>
        <NuxtLink to="/sportworld" class="btn">
          {{ t('sportworld.link') }}<PhArrowSquareOut :size="16" weight="bold" aria-hidden="true" />
        </NuxtLink>
        <p class="note" role="status" aria-live="polite">{{ note }}</p>
      </div>

      <ul class="facts">
        <li><span class="num">{{ data.waiting }}</span> {{ t('agent.waiting', data.waiting) }}</li>
        <li>{{ data.nextRunAt ? t('agent.next', { time: stamp(data.nextRunAt) }) : t('agent.off') }}</li>
        <li v-if="data.lastRun">
          {{ t('agent.lastRun', { time: stamp(data.lastRun.at), by: t(`agent.by.${data.lastRun.trigger}`) }) }}
          <template v-for="r in data.lastRun.results" :key="r.matchId">
            · <span :class="r.status === 'failed' ? 'bad' : ''">{{ r.label }}<template v-if="r.error"> ({{ r.error }})</template></span>
          </template>
        </li>
      </ul>

      <h3 class="sub">{{ t('agent.postsTitle') }}</h3>
      <p v-if="!data.posts.length" class="meta">{{ t('agent.empty') }}</p>
      <ol class="posts">
        <li v-for="p in data.posts" :key="p.id" class="post">
          <p class="kicker">
            <span>{{ p.competitionName }}</span><span aria-hidden="true">·</span>
            <span class="num">{{ score(p.match.score) }}</span><span aria-hidden="true">·</span>
            <span class="num">{{ stamp(p.createdAt) }}</span>
          </p>
          <p class="headline" :lang="p.langs.includes(locale as Lang) ? undefined : 'en'">
            <NuxtLink :to="`/newsroom/posts/${p.id}`">{{ p.headline }}</NuxtLink>
          </p>
          <p class="tags">
            <span class="tag tag--status" :class="`tag--${p.status}`">{{ t(`agent.status.${p.status}`) }}</span>
            <span class="tag tag--ai">{{ t('story.aiTag') }}</span>
            <span class="tag tag--sim">{{ t('agent.simulated') }}</span>
            <span v-if="p.origin === 'template'" class="tag">{{ t('agent.template') }}</span>
            <span v-if="p.edited" class="tag">{{ t('review.edited') }}</span>
            <span class="tag">{{ p.langs.map(l => l.toUpperCase()).join(' + ') }}</span>
            <span class="tag">{{ t('agent.press', { n: p.pressCount }, p.pressCount) }}</span>
          </p>
          <p v-if="p.error" class="meta bad">{{ p.error }}</p>
        </li>
      </ol>
    </template>
  </section>
</template>

<style scoped>
.block { margin-top: 40px; }
.meta { margin: 0 0 12px; font-size: 13px; color: var(--meta); }
.warn { margin: 0 0 12px; padding: 10px 14px; border-radius: 4px; background: var(--surface); font-size: 13px; color: var(--headline); }
.controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 16px; margin-bottom: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field-label { padding: 0; font-size: 13px; font-weight: 600; color: var(--headline); }
.pick {
  min-height: 44px; padding: 0 12px; border: 1px solid var(--border-control); border-radius: 4px;
  background: var(--bg); color: var(--headline); font: inherit; font-size: 16px;
}
.pick:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.langs { margin: 0; padding: 0; border: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; }
.langs .field-label { width: 100%; }
.check { min-height: 44px; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--headline); cursor: pointer; }
.check input { width: 18px; height: 18px; accent-color: var(--headline); }
.btn {
  min-height: 44px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--border-control); border-radius: 999px; background: var(--bg); color: var(--headline);
  font-size: 13px; font-weight: 700; text-decoration: none; cursor: pointer;
}
.btn:hover:not(:disabled) { background: var(--surface); }
.btn:disabled { opacity: 0.55; cursor: default; }
.btn--primary { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
.btn--primary:hover:not(:disabled) { background: var(--accent); opacity: 0.85; }
.btn:focus-visible { outline: 2px solid var(--link-hover); outline-offset: 2px; }
.note { margin: 0; font-size: 13px; color: var(--summary); }
.facts { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--summary); }
.bad { color: var(--loss); }
.sub { margin: 20px 0 8px; font-size: 16px; font-weight: 700; color: var(--headline); }
.posts { list-style: none; margin: 0; padding: 0; }
.post { padding: 12px 0; border-bottom: 1px solid var(--line); }
.kicker { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta); }
.headline { margin: 4px 0 0; font-size: 16px; font-weight: 700; line-height: 1.35; color: var(--headline); }
.headline a { color: inherit; text-decoration: none; }
.headline a:hover { color: var(--link-hover); text-decoration: underline; }
.headline a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.tags { margin: 6px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.tag {
  padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line-strong); font-size: 11px; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase; color: var(--summary); white-space: nowrap;
}
.tag--status { border-color: transparent; color: var(--board-text); background: var(--meta); }
.tag--pending { background: var(--link-hover); }
.tag--approved { background: var(--win); }
.tag--rejected, .tag--failed { background: var(--loss); }
.tag--ai, .tag--sim { border-color: var(--link-hover); color: var(--link-hover); }
</style>
