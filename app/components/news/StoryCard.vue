<script setup lang="ts">
import type { Story } from '#shared/types/stories'

const props = withDefaults(defineProps<{ story: Story, variant?: 'lead' | 'side' | 'card' | 'row' }>(), { variant: 'card' })
const { t } = useI18n()
const { stamp } = useFormat()
const ai = computed(() => props.story.headlineOrigin === 'agent')
// One title and one short detail (at most two lines): the AI subtitle, else the summary.
const detail = computed(() => keepScoresTogether((ai.value && props.story.subtitle) || props.story.summary || ''))
</script>

<template>
  <article class="story" :class="`story--${variant}`">
    <NuxtLink :to="story.href" class="media" tabindex="-1" aria-hidden="true">
      <!-- The newsroom's cover image when it set one, otherwise the data visual. -->
      <img v-if="story.cover" :src="story.cover.src" :alt="story.cover.alt" class="cover" loading="lazy">
      <NewsMatchVisual v-else :story="story" :size="variant === 'lead' ? 'lg' : variant === 'row' ? 'sm' : 'md'" />
    </NuxtLink>
    <div class="body">
      <p class="kicker">
        <span>{{ story.competitionName }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ t(`story.${story.kind}`) }}</span>
        <span v-if="ai" class="ai-tag">{{ t('story.aiTag') }}</span>
      </p>
      <h3 class="headline">
        <NuxtLink :to="story.href">{{ keepScoresTogether(story.headline) }}</NuxtLink>
      </h3>
      <p v-if="variant === 'row'" class="stamp num">{{ stamp(story.time) }}</p>
      <p v-if="variant !== 'card' && detail" class="detail">{{ detail }}</p>
      <p v-if="variant === 'lead' && !ai" class="auto">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
        {{ t('story.auto') }}
      </p>
    </div>
  </article>
</template>

<style scoped>
.story { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.media { display: block; border-radius: 4px; color: inherit; text-decoration: none; }
.media:focus-visible { outline: none; }
.cover { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 4px; background: var(--surface); }
.body { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.kicker {
  margin: 0; display: flex; gap: 6px; font-size: 11px; line-height: 16px; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--meta);
}
.headline { margin: 0; font-size: 16px; line-height: 1.4; font-weight: 700; color: var(--headline); }
.headline a { color: inherit; text-decoration: none; transition: color var(--dur-fast) var(--ease-out); }
.headline a:hover, .story:has(.media:hover) .headline a { color: var(--link-hover); }
.stamp { margin: 0; font-size: 12px; color: var(--meta); }
.detail {
  margin: 0; font-size: 15px; line-height: 1.45; color: var(--summary);
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.ai-tag {
  align-self: center; padding: 0 4px; border: 1px solid currentColor; border-radius: 3px;
  font-size: 9px; line-height: 13px; font-weight: 700; letter-spacing: 0.06em; color: var(--link-hover);
}
.auto { margin: 4px 0 0; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--meta); }

.story--lead { gap: 15px; }
.story--lead .body { padding: 0 20px; gap: 10px; }
.story--lead .headline { font-size: clamp(22px, 2.6vw, 28px); line-height: 1.29; text-align: center; }
.story--lead .kicker, .story--lead .auto { justify-content: center; }
.story--lead .detail { text-align: center; font-size: 17px; line-height: 1.5; }
.story--side .detail { font-size: 14px; }

.story--side .headline { font-size: 18px; line-height: 1.22; }

.story--row { flex-direction: row; gap: 15px; padding: 15px 0; border-bottom: 1px solid var(--line); }
.story--row:first-of-type { padding-top: 0; }
.story--row:last-of-type { border-bottom: 0; }
.story--row .media { flex: 0 0 33%; }
.story--row .headline { font-size: 17px; line-height: 1.3; }
@media (min-width: 1360px) { .story--row .headline { font-size: 18px; } }
@media (max-width: 479px) {
  .story--row .media { flex-basis: 120px; }
  .story--row .detail { display: none; }
}
</style>
