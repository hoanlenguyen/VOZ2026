<script setup lang="ts">
import { PhArrowUpRight } from '@phosphor-icons/vue'
import type { NewsCoverage } from '#shared/types/news-coverage'

const props = defineProps<{ competitionId: string, matchId: string, matchStatus?: string, homeScore?: number | null, awayScore?: number | null }>()
const emit = defineEmits<{ matchChange: [] }>()
const { data, status, error, refresh } = useLazyFetch<NewsCoverage>(
  () => `/api/competitions/${props.competitionId}/matches/${props.matchId}/press`,
  { server: false, retry: 0 },
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
    <NewsSectionTitle id="press-title">News</NewsSectionTitle>
    <p class="intro">Match reports and updates on each team. Open a team headline for its AI summary.</p>
    <p v-if="data" class="coverage-status" role="status">{{ data.newsPhase === 'post-match' ? 'Post-match news' : 'Pre-match news' }}<span v-if="data.match.status === 'live'"> · Pre-match sources retained during play. Follow this match page for live updates.</span><span v-else-if="['cancelled', 'postponed'].includes(data.match.status)"> · Match {{ data.match.status }}</span></p>

    <ul v-if="!data && (status === 'pending' || status === 'idle')" class="list" aria-hidden="true">
      <li v-for="i in 3" :key="i" class="item skeleton">
        <span class="sk sk--title" /><span class="sk sk--meta" />
      </li>
    </ul>

    <div v-else-if="data" class="news-content">
      <ul v-if="matchArticles.length" class="match-reports" aria-label="Match news sources">
        <li v-for="article in matchArticles" :key="article.id" class="match-report">
          <a :href="article.link" target="_blank" rel="noopener noreferrer nofollow">{{ article.title }} <PhArrowUpRight :size="14" aria-hidden="true" /><span class="sr-only">(opens original in a new tab)</span></a>
          <p class="report-meta">{{ article.source }} · <time :datetime="article.publishedAt">{{ storyStamp(article.publishedAt) }}</time></p>
        </li>
      </ul>
      <div v-if="teamGroups.length" class="coverage-grid" :class="{ 'coverage-grid--single': teamGroups.length === 1 }">
        <section v-for="group in teamGroups" :key="group.key" class="coverage-group" :aria-labelledby="`news-${matchId}-${group.key}`">
          <h3 :id="`news-${matchId}-${group.key}`" class="group-title">{{ group.title }}</h3>
          <p class="group-subtitle">{{ data.newsPhase === 'post-match' ? 'Post-match' : 'Pre-match' }} coverage · Form, players &amp; injuries</p>
          <NewsArticleSummary v-for="article in group.articles" :key="`${matchId}-${group.key}-${article.id}-${article.contentHash ?? ''}-${data.match.status}`" :article="article" :panel-id="`summary-${matchId}-${group.key}-${article.id}`" :summary-available="data.summaryAvailable" :paused="data.match.status === 'live'" />
          <p v-if="group.note" class="empty">{{ group.note }}</p>
        </section>
      </div>
      <p v-if="!matchArticles.length && !teamGroups.length" class="empty">No verified news is available for this match yet.</p>
    </div>
    <div v-else-if="error" class="empty" role="alert">
      News is unavailable right now.
      <button type="button" class="retry" @click="refresh()">Try again</button>
    </div>
    <p class="source-note">News covers pre-match and post-match reporting; live updates stay on the match page. Team summaries are cached for up to 24 hours and refreshed sooner if the source changes.</p>
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
.retry { display: inline-block; min-height: 44px; margin-left: 12px; border: 0; background: transparent; color: var(--link-hover); font: inherit; cursor: pointer; }
.retry:focus-visible { outline: 2px solid var(--link-hover); outline-offset: 2px; }
@media (max-width: 639px) { .coverage-grid { grid-template-columns: minmax(0, 1fr); gap: 28px; } }

.skeleton { display: flex; flex-direction: column; gap: 8px; }
.sk { display: block; height: 14px; border-radius: 4px; background: var(--surface); }
.sk--title { width: 85%; height: 18px; }
.sk--meta { width: 40%; }
@media (prefers-reduced-motion: no-preference) {
  .sk { animation: pulse 1.2s ease-in-out infinite alternate; }
  @keyframes pulse { from { opacity: 1; } to { opacity: 0.5; } }
}
</style>
