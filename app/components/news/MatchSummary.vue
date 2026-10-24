<script setup lang="ts">
import { PhArrowUpRight } from '@phosphor-icons/vue'
import type { MatchNewsDigest, NewsCoverage } from '#shared/types/news-coverage'

const props = defineProps<{ competitionId: string, matchId: string, coverage: NewsCoverage }>()
const emit = defineEmits<{ coverageChanged: [] }>()
const result = ref<MatchNewsDigest | null>(null)
const pending = ref(false)
const error = ref<string | null>(null)
let requestId = 0
let pendingRevision = ''

async function load(force = false) {
  if (import.meta.server || document.hidden) return
  if (props.coverage.match.status === 'live') {
    requestId++
    pending.value = false
    result.value = null
    error.value = 'These are pre-match sources. Follow the match page for live updates; post-match news summaries will appear after full time.'
    return
  }
  const revision = props.coverage.revision
  if (!force && pending.value && pendingRevision === revision) return
  if (!force && result.value?.revision === revision && Date.parse(result.value.expiresAt) > Date.now()) return
  if (result.value?.revision !== revision) result.value = null
  const current = ++requestId
  pending.value = false
  error.value = null
  if (!props.coverage.summaryAvailable) { error.value = 'AI summaries are temporarily unavailable. The source reports are linked below.'; return }
  if (props.coverage.groups[0]?.articles.length !== 3) { error.value = 'The combined summary will appear when three verified sources are available.'; return }
  if (['postponed', 'cancelled'].includes(props.coverage.policy.phase)) { error.value = `This match is ${props.coverage.policy.phase}.`; return }
  pending.value = true
  pendingRevision = revision
  try {
    const response = await $fetch<MatchNewsDigest>(`/api/competitions/${props.competitionId}/matches/${props.matchId}/summary`, { method: 'POST', retry: 0 })
    if (current !== requestId) return
    // A status can change between discovery and synthesis; never display a summary for an older revision.
    if (response.revision !== props.coverage.revision) {
      error.value = 'Match coverage has changed. Refreshing the news will show the latest summary.'
      emit('coverageChanged')
      return
    }
    result.value = response
  }
  catch (failure) {
    if (current !== requestId) return
    error.value = (failure as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'The combined summary is unavailable right now. Please try again.'
  }
  finally { if (current === requestId) pending.value = false }
}

watch(() => props.coverage, () => load(), { immediate: true })
onBeforeUnmount(() => { requestId++ })
</script>

<template>
  <div class="match-digest" :aria-busy="pending" aria-live="polite">
    <div class="digest-meta">
      <span class="phase-label">{{ coverage.newsPhase === 'post-match' ? 'Post-match' : 'Pre-match' }}</span>
      <span v-if="result" class="ai-label">AI summary · 3 sources</span>
    </div>
    <p v-if="pending && !result" class="digest-notice">Preparing a combined summary from three news reports…</p>
    <template v-else-if="result">
      <p class="digest-text">{{ result.summary }}</p>
      <p class="digest-updated">Updated {{ storyStamp(result.generatedAt) }}<span v-if="pending"> · Checking for updates…</span></p>
    </template>
    <p v-if="error" class="digest-notice" role="status">{{ error }} <button v-if="coverage.summaryAvailable && coverage.groups[0]?.articles.length === 3 && !['cancelled', 'postponed'].includes(coverage.policy.phase)" type="button" class="digest-retry" @click="load(true)">Try again</button></p>
    <div v-if="coverage.groups[0]?.articles.length" class="digest-sources">
      <h4>Source reports</h4>
      <ol>
        <li v-for="article in coverage.groups[0].articles" :key="article.id">
          <a :href="article.link" target="_blank" rel="noopener noreferrer nofollow">{{ article.title }} <PhArrowUpRight :size="13" aria-hidden="true" /><span class="sr-only">(opens original in a new tab)</span></a>
          <span class="digest-publisher">{{ article.source }}</span>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.match-digest { margin-top: 16px; padding: 20px; border-left: 3px solid var(--link-hover); border-radius: 0 4px 4px 0; background: var(--surface); }
.digest-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--meta); }
.phase-label { color: var(--headline); }
.digest-text { margin: 14px 0 0; color: var(--summary); font-size: 16px; line-height: 1.7; }
.digest-updated { margin: 10px 0 0; font-size: 12px; color: var(--meta); }
.digest-notice { margin: 12px 0 0; color: var(--summary); font-size: 14px; line-height: 1.6; }
.digest-retry { min-height: 44px; padding: 0 8px; border: 0; background: transparent; color: var(--link-hover); font: inherit; cursor: pointer; }
.digest-sources { margin-top: 20px; border-top: 1px solid var(--line-strong); padding-top: 16px; }
.digest-sources h4 { margin: 0 0 8px; color: var(--headline); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.digest-sources ol { margin: 0; padding-left: 20px; color: var(--meta); font-size: 12px; }
.digest-sources li { padding: 4px 0 10px 4px; }
.digest-sources a { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; color: var(--headline); font-size: 13px; line-height: 1.5; text-decoration: none; }
.digest-sources a:hover { color: var(--link-hover); }
.digest-publisher { display: block; margin-top: 2px; color: var(--meta); font-size: 11px; }
.digest-sources a:focus-visible, .digest-retry:focus-visible { outline: 2px solid var(--link-hover); outline-offset: 3px; }
@media (max-width: 639px) { .match-digest { padding: 16px; } }
</style>
