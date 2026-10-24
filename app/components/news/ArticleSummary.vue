<script setup lang="ts">
import { PhArrowUpRight, PhCaretDown } from '@phosphor-icons/vue'
import type { NewsItem, NewsSummary } from '#shared/types/news-coverage'

const props = defineProps<{ article: NewsItem, panelId: string, summaryAvailable: boolean, paused?: boolean }>()
const open = ref(false)
const pending = ref(false)
const result = ref<NewsSummary | null>(null)
const error = ref<string | null>(null)
const topicLabel = { form: 'Current form', players: 'Player news', injuries: 'Injuries & fitness' } as const

async function toggle() {
  open.value = !open.value
  if (!open.value || pending.value || !props.summaryAvailable || props.paused) return
  if (result.value && Date.parse(result.value.expiresAt) > Date.now()) return
  pending.value = true
  error.value = null
  result.value = null
  try {
    // Only this explicit click starts generation. No prefetch, mount hook or watcher.
    result.value = await $fetch<NewsSummary>(`/api/news/${props.article.id}/summary`, { method: 'POST', retry: 0 })
  }
  catch (failure) {
    const message = failure as { data?: { statusMessage?: string } }
    error.value = message.data?.statusMessage ?? 'This summary is unavailable right now. Please try again or read the original.'
  }
  finally { pending.value = false }
}
</script>

<template>
  <article class="news-item">
    <p v-if="article.topic" class="news-topic">{{ topicLabel[article.topic] }}</p>
    <h4 class="news-heading">
      <button class="news-trigger" type="button" :aria-expanded="open" :aria-controls="panelId" @click="toggle">
        <span>{{ article.title }}</span>
        <PhCaretDown :size="18" weight="bold" class="news-caret" :class="{ 'news-caret--open': open }" aria-hidden="true" />
      </button>
    </h4>
    <div class="news-meta">
      <span class="news-publisher">{{ article.source }}</span>
      <span aria-hidden="true">·</span>
      <time :datetime="article.publishedAt">{{ storyStamp(article.publishedAt) }}</time>
    </div>
    <div v-if="open" :id="panelId" class="news-summary" :aria-busy="pending" aria-live="polite">
      <p v-if="pending" class="news-progress">Preparing your AI summary…</p>
      <template v-else-if="result">
        <span class="news-ai-label">AI summary</span>
        <p class="news-summary-text">{{ result.summary }}</p>
        <p class="news-summary-date">Summarized {{ storyStamp(result.generatedAt) }} from {{ result.source.name }}’s report.</p>
      </template>
      <p v-else-if="error" class="news-error" role="alert">{{ error }}</p>
      <p v-else-if="paused" class="news-error">Pre-match source retained. News summaries resume after full time; live updates are on the match page.</p>
      <p v-else-if="!summaryAvailable" class="news-error">AI summaries are temporarily unavailable. You can read the original below.</p>
      <button v-if="error && !pending" class="news-retry" type="button" @click="open = false; toggle()">Try summary again</button>
    </div>
    <div class="news-actions">
      <span class="news-hint">{{ open ? 'Select headline to close' : paused ? 'Pre-match source · summaries resume after full time' : 'Select headline for AI summary' }}</span>
      <a :href="article.link" target="_blank" rel="noopener noreferrer nofollow" class="news-original">
        Read original <PhArrowUpRight :size="14" aria-hidden="true" />
        <span class="sr-only">at {{ article.source }} (opens in a new tab)</span>
      </a>
    </div>
  </article>
</template>

<style scoped>
.news-item { padding: 18px 0; border-bottom: 1px solid var(--line); }
.news-topic { margin: 0 0 3px; color: var(--meta); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
.news-heading { margin: 0; font-size: 17px; line-height: 1.4; }
.news-trigger { width: 100%; min-height: 44px; padding: 4px 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 0; background: transparent; color: var(--headline); font: inherit; font-weight: 700; text-align: left; cursor: pointer; }
.news-trigger:hover, .news-original:hover { color: var(--link-hover); }
.news-trigger:focus-visible, .news-original:focus-visible, .news-retry:focus-visible { outline: 2px solid var(--link-hover); outline-offset: 4px; }
.news-caret { flex-shrink: 0; color: var(--meta); }
.news-caret--open { transform: rotate(180deg); }
.news-meta { display: flex; flex-wrap: wrap; gap: 6px; color: var(--meta); font-size: 12px; }
.news-publisher { font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
.news-summary { margin-top: 14px; padding: 16px; border-left: 3px solid var(--link-hover); background: var(--surface); border-radius: 0 4px 4px 0; }
.news-ai-label { color: var(--headline); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
.news-summary-text { margin: 8px 0 0; font-size: 15px; line-height: 1.65; color: var(--summary); }
.news-summary-date { margin: 10px 0 0; font-size: 12px; line-height: 1.5; color: var(--meta); }
.news-progress, .news-error { margin: 0; font-size: 14px; line-height: 1.6; color: var(--summary); }
.news-retry { min-height: 44px; margin-top: 8px; padding: 4px 0; background: transparent; border: 0; color: var(--link-hover); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.news-actions { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; margin-top: 4px; }
.news-hint { color: var(--meta); font-size: 11px; }
.news-original { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; color: var(--summary); font-size: 12px; text-decoration: none; }
</style>
