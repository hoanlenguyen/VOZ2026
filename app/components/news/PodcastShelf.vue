<script setup lang="ts">
// Front page "Podcasts": the newest AI audio bulletins in the reader's language (daily team and
// league episodes, and match episodes the newsroom made). Loaded after the page, never blocks it.
import type { PodcastListResponse } from '#shared/types/podcast'

const { t, locale } = useI18n()
const { data } = useLazyFetch<PodcastListResponse>('/api/podcasts', { query: { lang: locale, limit: 6 }, server: false })
const episodes = computed(() => data.value?.episodes ?? [])
</script>

<template>
  <section v-if="episodes.length" class="shelf" aria-labelledby="podcasts-title">
    <NewsSectionTitle id="podcasts-title">{{ t('podcast.title') }}</NewsSectionTitle>
    <div class="grid">
      <NewsPodcastPlayer v-for="e in episodes" :key="e.id" :episode="e" />
    </div>
  </section>
</template>

<style scoped>
.shelf { margin-top: 50px; }
.grid { display: grid; gap: 16px; align-items: start; }
@media (min-width: 768px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
