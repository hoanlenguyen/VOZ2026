<script setup lang="ts">
import type { Story } from '#shared/types/stories'

withDefaults(defineProps<{ story: Story, variant?: 'lead' | 'side' | 'card' | 'row' }>(), { variant: 'card' })
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
      <p v-if="(variant === 'lead' || variant === 'row') && story.summary" class="summary">{{ story.summary }}</p>
      <p v-if="variant === 'lead'" class="auto">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
        Written automatically from official match data
      </p>
    </div>
  </article>
</template>

<style scoped>
.story { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.media { display: block; border-radius: 4px; color: inherit; text-decoration: none; }
.media:focus-visible { outline: none; }
.body { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.kicker {
  margin: 0; display: flex; gap: 6px; font-size: 11px; line-height: 16px; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--meta);
}
.headline { margin: 0; font-size: 16px; line-height: 1.4; font-weight: 700; color: var(--headline); }
.headline a { color: inherit; text-decoration: none; transition: color var(--dur-fast) var(--ease-out); }
.headline a:hover, .story:has(.media:hover) .headline a { color: var(--link-hover); }
.stamp { margin: 0; font-size: 12px; color: var(--meta); }
.summary { margin: 0; font-size: 14px; line-height: 1.5; color: var(--summary); }
.auto { margin: 4px 0 0; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--meta); }

.story--lead { gap: 15px; }
.story--lead .body { padding: 0 20px; gap: 10px; }
.story--lead .headline { font-size: clamp(22px, 2.6vw, 28px); line-height: 1.29; text-align: center; }
.story--lead .kicker, .story--lead .auto { justify-content: center; }
.story--lead .summary { text-align: center; font-size: 16px; line-height: 1.56; }

.story--side .headline { font-size: 18px; line-height: 1.22; }

.story--row { flex-direction: row; gap: 15px; padding: 15px 0; border-bottom: 1px solid var(--line); }
.story--row:first-of-type { padding-top: 0; }
.story--row:last-of-type { border-bottom: 0; }
.story--row .media { flex: 0 0 33%; }
.story--row .headline { font-size: 17px; line-height: 1.3; }
.story--row .summary { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
@media (min-width: 1360px) { .story--row .headline { font-size: 18px; } }
@media (max-width: 479px) {
  .story--row .media { flex-basis: 120px; }
  .story--row .summary { display: none; }
}
</style>
