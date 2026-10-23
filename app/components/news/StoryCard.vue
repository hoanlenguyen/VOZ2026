<script setup lang="ts">
import type { Story } from '#shared/types/stories'

withDefaults(defineProps<{ story: Story, variant?: 'lead' | 'card' | 'row' }>(), { variant: 'card' })
</script>

<template>
  <article class="story" :class="`story--${variant}`">
    <NuxtLink :to="story.href" class="media" tabindex="-1" aria-hidden="true">
      <NewsMatchVisual :story="story" :size="variant === 'lead' ? 'lg' : variant === 'row' ? 'sm' : 'md'" />
    </NuxtLink>
    <div class="body">
      <p class="kicker">
        <span>{{ story.competitionName }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ story.kind === 'result' ? 'Result' : 'Preview' }}</span>
      </p>
      <h3 class="headline">
        <NuxtLink :to="story.href">{{ story.headline }}</NuxtLink>
      </h3>
      <p v-if="variant === 'row'" class="stamp num">{{ storyStamp(story.time) }}</p>
      <p v-if="variant !== 'card' && story.summary" class="summary">{{ story.summary }}</p>
      <p v-if="variant === 'lead'" class="auto">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
        Written automatically from official match data
      </p>
    </div>
  </article>
</template>

<style scoped>
.story { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.media { display: block; border-radius: 6px; color: inherit; text-decoration: none; }
.media:focus-visible { outline: none; }
.body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.kicker {
  margin: 0; display: flex; gap: 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--muted);
}
.headline { margin: 0; font-size: 17px; line-height: 1.3; font-weight: 700; letter-spacing: -0.01em; }
.headline a { color: var(--text); text-decoration: none; }
.headline a:hover { text-decoration: underline; text-underline-offset: 3px; }
.stamp { margin: 0; font-size: 13px; color: var(--muted); }
.summary { margin: 0; font-size: 15px; line-height: 1.55; color: var(--text-2); }
.auto { margin: 4px 0 0; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }

.story--lead .headline { font-size: clamp(24px, 3vw, 32px); line-height: 1.2; text-align: center; }
.story--lead .kicker, .story--lead .auto { justify-content: center; }
.story--lead .summary { text-align: center; font-size: 16px; }

.story--row { flex-direction: row; gap: 16px; padding: 20px 0; border-top: 1px solid var(--line); }
.story--row .media { flex: 0 0 132px; }
.story--row .headline { font-size: 18px; }
.story--row .summary { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
@media (min-width: 768px) {
  .story--row .media { flex-basis: 220px; }
  .story--row .headline { font-size: 21px; }
}
@media (max-width: 479px) {
  .story--row .summary { display: none; }
}
</style>
