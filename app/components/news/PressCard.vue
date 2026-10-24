<script setup lang="ts">
// "What the press says": other outlets' headlines about this game, linked to the original.
// Headline, source and link only, so we point readers to the coverage instead of republishing it.
// Loaded in the browser after the page, so it never delays the match page or spends the
// news-search quota on crawlers.
import { PhArrowUpRight } from '@phosphor-icons/vue'
import type { PressResult } from '#shared/types/press'

const props = defineProps<{ competitionId: string, matchId: string }>()
const { t, locale } = useI18n()
const { data, status } = useLazyFetch<PressResult>(
  () => `/api/competitions/${props.competitionId}/matches/${props.matchId}/press`,
  { server: false, query: { lang: locale } },
)
const { stamp } = useFormat()
</script>

<template>
  <section class="block" aria-labelledby="press-title" :aria-busy="status === 'pending'">
    <NewsSectionTitle id="press-title">{{ t('press.title') }}</NewsSectionTitle>

    <ul v-if="status === 'pending' || status === 'idle'" class="list" aria-hidden="true">
      <li v-for="i in 3" :key="i" class="item skeleton">
        <span class="sk sk--title" /><span class="sk sk--meta" />
      </li>
    </ul>

    <ul v-else-if="data?.status === 'ok'" class="list">
      <li v-for="a in data.articles" :key="a.url" class="item">
        <a :href="a.url" target="_blank" rel="noopener noreferrer nofollow" class="headline">
          {{ a.title }}
          <PhArrowUpRight :size="14" weight="bold" class="ext" aria-hidden="true" />
          <span class="sr-only">{{ t('press.opens', { source: a.source }) }}</span>
        </a>
        <p class="meta">
          <span class="source">{{ a.source }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ t(`press.${a.timing}`) }}</span>
          <span aria-hidden="true">·</span>
          <span class="num">{{ stamp(a.publishedAt) }}</span>
        </p>
      </li>
    </ul>

    <p v-else class="empty">{{ data?.note ?? t('press.unavailable') }}</p>

    <p class="source-note">
      {{ t('press.sourceNote') }}
    </p>
  </section>
</template>

<style scoped>
.block { margin-top: 50px; }
.list { list-style: none; margin: 0; padding: 0; }
.item { padding: 14px 0; border-bottom: 1px solid var(--line); }
.item:first-child { padding-top: 0; }
.item:last-child { border-bottom: 0; }
.headline {
  font-size: 17px; line-height: 1.35; font-weight: 700; color: var(--headline); text-decoration: none;
  transition: color var(--dur-fast) var(--ease-out);
}
.headline:hover { color: var(--link-hover); }
.ext { vertical-align: -1px; margin-left: 2px; color: var(--meta); }
.meta { margin: 6px 0 0; display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; color: var(--meta); }
.source { font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
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
