<script setup lang="ts">
// Newsroom dashboard: daily AI podcasts. The schedule lists the teams and leagues that get a new
// episode every morning (when their facts changed) in the chosen languages; the scheduled task runs
// it at the cron time. "Generate now" makes one subject's episodes at once, "Run now" the whole list.
import { PhMicrophone, PhPlay, PhTrash } from '@phosphor-icons/vue'
import type { PodcastDesk, PodcastRun, PodcastSchedule, PodcastSubject } from '#shared/types/podcast'
import type { Lang } from '#shared/utils/format'
import { podcastSubjectId } from '#shared/utils/podcast'

const { t, locale } = useI18n()
const { stamp } = useFormat()
const { data, error } = useLazyFetch<PodcastDesk>('/api/newsroom/podcasts/desk', { query: { lang: locale }, server: false })

const subjects = ref<PodcastSubject[]>([])
const langs = ref<Lang[]>(['en', 'fi'])
const lastRun = ref<PodcastRun | null>(null)
watch(data, (d) => {
  if (!d) return
  subjects.value = [...d.schedule.subjects]
  langs.value = [...d.schedule.langs]
  lastRun.value = d.lastRun
}, { immediate: true })

const idOf = podcastSubjectId
const options = computed(() => data.value?.options ?? [])
const optionById = computed(() => new Map(options.value.map(o => [o.subjectId, o])))
const labelOf = (id: string) => optionById.value.get(id)?.label ?? id
const scheduled = computed(() => new Set(subjects.value.map(idOf)))
const groups = computed(() => {
  const out = new Map<string, typeof options.value>()
  for (const o of options.value) if (!scheduled.value.has(o.subjectId)) out.set(o.competitionName, [...(out.get(o.competitionName) ?? []), o])
  return [...out]
})
const dirty = computed(() => !!data.value && (
  JSON.stringify(subjects.value.map(idOf)) !== JSON.stringify(data.value.schedule.subjects.map(idOf))
  || [...langs.value].sort().join() !== [...data.value.schedule.langs].sort().join()))
// "0 5 * * *" -> "05:00 UTC"
const runTime = computed(() => {
  const [m, h] = (data.value?.cron ?? '').split(' ')
  return h && m ? `${h.padStart(2, '0')}:${m.padStart(2, '0')} UTC` : ''
})

const pick = ref('')
function add() {
  const o = optionById.value.get(pick.value)
  if (o) subjects.value.push(o.subject)
  pick.value = ''
}
const remove = (i: number) => subjects.value.splice(i, 1)

const busy = ref<string | null>(null)
const note = ref('')
async function act(id: string, job: () => Promise<string>) {
  busy.value = id
  note.value = ''
  try {
    note.value = await job()
  }
  catch (err) {
    note.value = t('podcast.failedReason', { reason: (err as { statusMessage?: string }).statusMessage ?? t('podcast.failed') })
  }
  finally {
    busy.value = null
  }
}
const save = () => act('save', async () => {
  const saved = await $fetch<PodcastSchedule>('/api/newsroom/podcasts/schedule', { method: 'PUT', body: { subjects: subjects.value, langs: langs.value } })
  if (data.value) data.value.schedule = saved
  subjects.value = [...saved.subjects]
  langs.value = [...saved.langs]
  return t('podcast.desk.saved')
})
const generate = (s: PodcastSubject) => act(idOf(s), async () => {
  const r = await $fetch<{ episodes: Array<{ status: string }> }>('/api/newsroom/podcasts', { method: 'POST', body: { subject: s, langs: langs.value, force: true } })
  return t('podcast.desk.generated', { label: labelOf(idOf(s)), n: r.episodes.length })
})
const runNow = () => act('run', async () => {
  lastRun.value = await $fetch<PodcastRun>('/api/newsroom/podcasts/run', { method: 'POST' })
  return t('podcast.desk.ran')
})
</script>

<template>
  <section class="block" aria-labelledby="podcast-desk-title">
    <NewsSectionTitle id="podcast-desk-title">{{ t('podcast.desk.title') }}</NewsSectionTitle>
    <p class="meta">{{ t('podcast.desk.lead', { time: runTime }) }}</p>
    <p v-if="error" class="meta" role="alert">{{ t('podcast.failedReason', { reason: error.statusMessage }) }}</p>
    <p v-else-if="!data" class="meta">{{ t('podcast.desk.loading') }}</p>

    <template v-else>
      <ul class="subjects">
        <li v-for="(s, i) in subjects" :key="idOf(s)" class="subject">
          <span class="subject-name">
            <span class="kind">{{ t(`podcast.kinds.${s.kind}`) }}</span>
            <strong>{{ labelOf(idOf(s)) }}</strong>
            <span v-if="s.kind === 'team'" class="comp">{{ optionById.get(idOf(s))?.competitionName }}</span>
          </span>
          <span class="subject-actions">
            <button type="button" class="btn" :disabled="!!busy" :aria-busy="busy === idOf(s)" @click="generate(s)">
              <PhMicrophone :size="16" weight="bold" aria-hidden="true" />
              {{ busy === idOf(s) ? t('podcast.generating') : t('podcast.desk.generateNow') }}
              <span class="sr-only">: {{ labelOf(idOf(s)) }}</span>
            </button>
            <button type="button" class="icon-btn" :aria-label="t('podcast.desk.remove', { label: labelOf(idOf(s)) })" :disabled="!!busy" @click="remove(i)">
              <PhTrash :size="18" weight="bold" aria-hidden="true" />
            </button>
          </span>
        </li>
        <li v-if="!subjects.length" class="meta">{{ t('podcast.desk.empty') }}</li>
      </ul>

      <div class="controls">
        <label class="add">
          <span class="sr-only">{{ t('podcast.desk.addLabel') }}</span>
          <select v-model="pick" class="pick">
            <option value="" disabled>{{ t('podcast.desk.addLabel') }}</option>
            <optgroup v-for="[comp, list] in groups" :key="comp" :label="comp">
              <option v-for="o in list" :key="o.subjectId" :value="o.subjectId">{{ o.subject.kind === 'league' ? `${t('podcast.kinds.league')}: ${o.label}` : o.label }}</option>
            </optgroup>
          </select>
        </label>
        <button type="button" class="btn" :disabled="!pick" @click="add">{{ t('podcast.desk.add') }}</button>
        <fieldset class="langs">
          <legend class="sr-only">{{ t('podcast.desk.langs') }}</legend>
          <label v-for="l in (['en', 'fi'] as const)" :key="l" class="lang">
            <input v-model="langs" type="checkbox" :value="l"> {{ t(`podcast.langs.${l}`) }}
          </label>
        </fieldset>
      </div>

      <div class="controls">
        <button type="button" class="btn btn--primary" :disabled="!dirty || !langs.length || !!busy" @click="save">{{ t('podcast.desk.save') }}</button>
        <button type="button" class="btn" :disabled="dirty || !!busy" :aria-busy="busy === 'run'" @click="runNow">
          <PhPlay :size="16" weight="bold" aria-hidden="true" />
          {{ busy === 'run' ? t('podcast.generating') : t('podcast.desk.runNow') }}
        </button>
        <p class="note" role="status" aria-live="polite">{{ note }}</p>
      </div>

      <div v-if="lastRun" class="run">
        <p class="meta">{{ t('podcast.desk.lastRun', { time: stamp(lastRun.at), by: t(`podcast.desk.by.${lastRun.trigger}`) }) }}</p>
        <ul class="results">
          <li v-for="r in lastRun.results" :key="`${r.subjectId}.${r.lang}`">
            <span class="dot" :class="`dot--${r.status}`" aria-hidden="true" />
            {{ labelOf(r.subjectId) }} · {{ r.lang.toUpperCase() }} · {{ t(`podcast.desk.status.${r.status}`) }}<template v-if="r.error"> ({{ r.error }})</template>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>

<style scoped>
.block { margin-top: 40px; }
.meta { margin: 0 0 12px; font-size: 13px; color: var(--meta); }
.subjects { list-style: none; margin: 0 0 16px; padding: 0; }
.subject { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.subject-name { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; color: var(--headline); }
.kind { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta); }
.comp { font-size: 13px; color: var(--summary); }
.subject-actions { display: flex; align-items: center; gap: 6px; }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 12px; }
.pick {
  min-height: 44px; max-width: 100%; padding: 0 12px; border: 1px solid var(--border-control); border-radius: 4px;
  background: var(--bg); color: var(--headline); font: inherit; font-size: 16px;
}
.pick:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn {
  min-height: 44px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--border-control); border-radius: 999px; background: var(--bg); color: var(--headline);
  font-size: 13px; font-weight: 700; cursor: pointer;
}
.btn:hover:not(:disabled) { background: var(--surface); }
.btn:disabled { opacity: 0.55; cursor: default; }
.btn--primary { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
.btn--primary:hover:not(:disabled) { background: var(--accent); opacity: 0.85; }
.btn:focus-visible, .icon-btn:focus-visible { outline: 2px solid var(--link-hover); outline-offset: 2px; }
.icon-btn { width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 4px; background: transparent; color: var(--summary); cursor: pointer; }
.icon-btn:hover:not(:disabled) { background: var(--surface); color: var(--loss); }
.langs { margin: 0; padding: 0; border: 0; display: flex; gap: 14px; }
.lang { min-height: 44px; display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--headline); cursor: pointer; }
.lang input { width: 18px; height: 18px; accent-color: var(--headline); }
.note { margin: 0; font-size: 13px; color: var(--summary); }
.results { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--headline); }
.dot { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; }
.dot--created { background: var(--win); }
.dot--unchanged { background: var(--draw); }
.dot--failed { background: var(--loss); }
</style>
