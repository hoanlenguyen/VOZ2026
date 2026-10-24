<script setup lang="ts">
import { PhArrowUpRight } from '@phosphor-icons/vue'
import type { NewsCoverage } from '#shared/types/news-coverage'

const props = defineProps<{ competitionId: string, matchId: string, matchStatus?: string, homeScore?: number | null, awayScore?: number | null }>()
const emit = defineEmits<{ matchChange: [] }>()
const { t, locale } = useI18n()
const { stamp } = useFormat()
const { data, status, error, refresh } = useLazyFetch<NewsCoverage>(
  () => `/api/competitions/${props.competitionId}/matches/${props.matchId}/press`,
  { server: false, retry: 0, query: { lang: locale } },
)
const matchArticles = computed(() => data.value?.groups.find(group => group.key === 'match')?.articles ?? [])
const teamGroups = computed(() => data.value?.groups.filter(group => group.key !== 'match' && group.articles.length > 0) ?? [])
let refreshTimer: ReturnType<typeof setTimeout> | undefined
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  if (import.meta.server) return
  refreshTimer = setTimeout(async () => {
    try { if (!document.hidden) await refresh() } finally { scheduleRefresh() }
  }, Math.max(1, data.value?.policy.pollSeconds ?? 60) * 1000)
}
function resumeRefresh() { if (!document.hidden && status.value !== 'pending') void refresh() }
watch(data, (coverage) => {
  scheduleRefresh()
  if (coverage && props.matchStatus && (coverage.match.status !== props.matchStatus || coverage.match.home.score !== props.homeScore || coverage.match.away.score !== props.awayScore)) emit('matchChange')
})
onMounted(() => { scheduleRefresh(); document.addEventListener('visibilitychange', resumeRefresh) })
onBeforeUnmount(() => { if (refreshTimer) clearTimeout(refreshTimer); document.removeEventListener('visibilitychange', resumeRefresh) })
</script>

<template>
  <section class="block" aria-labelledby="press-title" :aria-busy="status === 'pending'">
    <NewsSectionTitle id="press-title">{{ t('press.title') }}</NewsSectionTitle>
    <p class="intro">{{ t('press.intro') }}</p>
    <p v-if="data" class="coverage-status" role="status">{{ t(data.newsPhase === 'post-match' ? 'press.postMatchNews' : 'press.preMatchNews') }}<span v-if="data.match.status === 'live'"> · {{ t('press.liveNote') }}</span><span v-else-if="['cancelled', 'postponed'].includes(data.match.status)"> · {{ t(`press.matchStatus.${data.match.status}`) }}</span></p>

    <ul v-if="status === 'pending' || status === 'idle'" class="list" aria-hidden="true">
      <li v-for="i in 3" :key="i" class="item skeleton">
        <span class="sk sk--title" /><span class="sk sk--meta" />
      </li>
    </ul>

    <div v-else-if="data" class="news-content">
      <ul v-if="matchArticles.length" class="match-reports" :aria-label="t('press.sources')">
        <li v-for="article in matchArticles" :key="article.id" class="match-report">
          <a :href="article.link" :title="article.originalTitle" target="_blank" rel="noopener noreferrer nofollow">{{ article.title }} <PhArrowUpRight :size="14" aria-hidden="true" /><span class="sr-only">{{ t('press.opens', { source: article.source }) }}</span></a>
          <p class="report-meta">{{ article.source }} · <time :datetime="article.publishedAt">{{ stamp(article.publishedAt) }}</time><span v-if="article.translated"> · {{ t('press.translated') }}<span class="sr-only"> · {{ t('press.original') }}: {{ article.originalTitle }}</span></span></p>
        </li>
      </ul>
      <div v-if="teamGroups.length" class="coverage-grid" :class="{ 'coverage-grid--single': teamGroups.length === 1 }">
        <section v-for="group in teamGroups" :key="group.key" class="coverage-group" :aria-labelledby="`news-${matchId}-${group.key}`">
          <h3 :id="`news-${matchId}-${group.key}`" class="group-title">{{ group.title }}</h3>
          <p class="group-subtitle">{{ t(data.newsPhase === 'post-match' ? 'press.postMatchTeam' : 'press.preMatchTeam') }}</p>
          <NewsArticleSummary v-for="article in group.articles" :key="`${matchId}-${group.key}-${article.id}-${article.contentHash ?? ''}-${data.match.status}-${locale}`" :article="article" :panel-id="`summary-${matchId}-${group.key}-${article.id}`" :summary-available="data.summaryAvailable" :paused="data.match.status === 'live'" />
          <p v-if="group.articles.length < 3" class="empty">{{ t('press.teamGap', { count: group.articles.length }) }}</p>
        </section>
      </div>
      <p v-if="!matchArticles.length && !teamGroups.length" class="empty">{{ t('press.empty') }}</p>
    </div>
    <div v-else-if="error" class="empty" role="alert">
      {{ t('press.unavailable') }}
      <button type="button" class="retry" @click="refresh()">{{ t('press.retry') }}</button>
    </div>
    <p class="source-note">{{ t('press.sourceNote') }}</p>
  </section>
</template>

<style scoped>
.block { margin-top: 50px; }
.intro { margin: -4px 0 24px; font-size: 14px; line-height: 1.6; color: var(--summary); }
.coverage-status { margin: -8px 0 24px; color: var(--summary); font-size: 13px; line-height: 1.6; font-weight: 600; }
.coverage-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; }
.coverage-grid--single { grid-template-columns: minmax(0, 1fr); }
.coverage-group { min-width: 0; }
.match-reports { list-style: none; margin: 0 0 28px; padding: 0; }
.match-report { padding: 12px 0; border-bottom: 1px solid var(--line); }
.match-report:first-child { padding-top: 0; }
.match-report a { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; color: var(--headline); font-size: 17px; line-height: 1.5; font-weight: 600; text-decoration: none; }
.match-report a svg { flex-shrink: 0; }
.match-report a:hover { color: var(--link-hover); }
.match-report a:focus-visible { outline: 2px solid var(--link-hover); outline-offset: 3px; }
.report-meta { margin: 0; color: var(--meta); font-size: 12px; line-height: 1.5; }
.group-title { margin: 0; color: var(--headline); font-size: 20px; line-height: 1.3; font-weight: 700; }
.group-subtitle { margin: 6px 0 0; color: var(--meta); font-size: 12px; }
.list { list-style: none; margin: 0; padding: 0; }
.item { padding: 14px 0; border-bottom: 1px solid var(--line); }
.item:first-child { padding-top: 0; }
.item:last-child { border-bottom: 0; }
.empty { margin: 0; padding: 14px 16px; border-radius: 4px; background: var(--surface); color: var(--summary); font-size: 14px; }
.source-note { margin: 16px 0 0; text-align: center; font-size: 13px; color: var(--meta); }

.skeleton { display: flex; flex-direction: column; gap: 8px; }
.sk { display: block; height: 14px; border-radius: 4px; background: var(--surface); }
.sk--title { width: 85%; height: 18px; }
.sk--meta { width: 40%; }
@media (prefers-reduced-motion: no-preference) {
  .sk { animation: pulse 1.2s ease-in-out infinite alternate; }
  @keyframes pulse { from { opacity: 1; } to { opacity: 0.5; } }
}
</style>
