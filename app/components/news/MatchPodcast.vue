<script setup lang="ts">
// Match page podcast: the 20–30 second AI audio summary of this match in the reader's language, and
// for newsroom accounts the "Generate podcast" button (writes and records English and Finnish
// together, about 15 seconds; "Regenerate" makes new versions even when the facts are unchanged).
import { PhMicrophone } from '@phosphor-icons/vue'
import type { PodcastEpisode, PodcastListResponse } from '#shared/types/podcast'

const props = defineProps<{ competitionId: string, matchId: string }>()
const { t, locale } = useI18n()
const { can } = useAccount()
const subject = computed(() => `match-${props.competitionId}-${props.matchId}`)
const { data, refresh } = useLazyFetch<PodcastListResponse>('/api/podcasts', {
  query: computed(() => ({ lang: locale.value, subject: subject.value, limit: 1 })),
  server: false,
})
const episode = computed<PodcastEpisode | null>(() => data.value?.episodes[0] ?? null)

const busy = ref(false)
const failure = ref<string | null>(null)
async function generate() {
  busy.value = true
  failure.value = null
  try {
    await $fetch('/api/newsroom/podcasts', {
      method: 'POST',
      body: { subject: { kind: 'match', competitionId: props.competitionId, matchId: props.matchId }, langs: ['en', 'fi'], force: !!episode.value },
    })
    await refresh()
  }
  catch (err) {
    failure.value = (err as { statusMessage?: string }).statusMessage ?? t('podcast.failed')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <section v-if="episode || can.newsroom" class="block" aria-labelledby="match-podcast-title">
    <NewsSectionTitle id="match-podcast-title">{{ t('podcast.matchTitle') }}</NewsSectionTitle>
    <NewsPodcastPlayer v-if="episode" :episode="episode" :show-link="false" />
    <div v-if="can.newsroom" class="desk">
      <p class="desk-text">
        <strong>{{ t('podcast.deskLabel') }}</strong>
        {{ episode ? t('podcast.deskHas') : t('podcast.deskNone') }}
      </p>
      <button type="button" class="generate" :disabled="busy" :aria-busy="busy" @click="generate">
        <PhMicrophone :size="16" weight="bold" aria-hidden="true" />
        {{ busy ? t('podcast.generating') : episode ? t('podcast.regenerate') : t('podcast.generate') }}
      </button>
      <p class="status" role="status" aria-live="polite">
        <template v-if="busy">{{ t('podcast.generatingNote') }}</template>
        <template v-else-if="failure">{{ t('podcast.failedReason', { reason: failure }) }}</template>
      </p>
    </div>
  </section>
</template>

<style scoped>
.block { margin-top: 40px; }
.desk {
  margin-top: 12px; padding: 12px 14px; border: 1px dashed var(--border-control); border-radius: 4px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px;
}
.desk-text { flex: 1 1 260px; margin: 0; font-size: 13px; color: var(--summary); }
.desk-text strong { color: var(--headline); margin-right: 4px; }
.generate {
  min-height: 44px; padding: 0 16px; display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 999px;
  background: var(--accent); color: var(--on-accent); font-size: 13px; font-weight: 700; cursor: pointer;
  transition: opacity var(--dur-fast) var(--ease-out);
}
.generate:hover { opacity: 0.85; }
.generate:disabled { opacity: 0.6; cursor: progress; }
.generate:focus-visible { outline: 2px solid var(--link-hover); outline-offset: 3px; }
.status { flex: 1 0 100%; margin: 0; font-size: 13px; color: var(--meta); }
.status:empty { display: none; }
</style>
