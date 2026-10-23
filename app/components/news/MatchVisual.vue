<script setup lang="ts">
// Data-driven "photo" for a story: crests and score on the dark VOZ scoreboard. No generated or
// borrowed imagery, so the picture can never show something that did not happen.
import type { Story } from '#shared/types/stories'

const props = withDefaults(defineProps<{ story: Story, size?: 'lg' | 'md' | 'sm' }>(), { size: 'md' })
const m = computed(() => props.story.match)
const finished = computed(() => m.value.status === 'finished')
// formatScore gives "4–3 SO" / "1–1, 5–4 pens": big number first, the rest goes in the chip.
const score = computed(() => {
  const [main = '', ...rest] = formatScore(m.value).split(/,? /)
  return { main, extra: rest.join(' ') }
})
const when = computed(() => fixtureTime(m.value.start).split(', '))
const label = computed(() => (finished.value
  ? `${m.value.home.shortName} ${formatScore(m.value)} ${m.value.away.shortName}`
  : `${m.value.home.shortName} vs ${m.value.away.shortName}, ${fixtureTime(m.value.start)}`))
</script>

<template>
  <figure class="visual" :class="`visual--${size}`" role="img" :aria-label="label">
    <span class="tag">{{ story.competitionName }}</span>
    <div class="row">
      <div class="side">
        <img v-if="m.home.logo" :src="m.home.logo" alt="" class="crest" loading="lazy">
        <span v-else class="crest crest--text display">{{ m.home.shortName.slice(0, 3).toUpperCase() }}</span>
        <span class="name">{{ m.home.shortName }}</span>
      </div>
      <div class="centre">
        <template v-if="finished">
          <span class="score display num">{{ score.main }}</span>
          <span class="score-chip">{{ score.extra || 'Final' }}</span>
        </template>
        <template v-else>
          <span class="score score--time display num">{{ when[0] }}</span>
          <span class="score-chip score-chip--accent">{{ when[1] }}</span>
        </template>
      </div>
      <div class="side">
        <img v-if="m.away.logo" :src="m.away.logo" alt="" class="crest" loading="lazy">
        <span v-else class="crest crest--text display">{{ m.away.shortName.slice(0, 3).toUpperCase() }}</span>
        <span class="name">{{ m.away.shortName }}</span>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.visual {
  margin: 0; position: relative; aspect-ratio: 16 / 9; border-radius: 6px; overflow: hidden;
  background:
    linear-gradient(90deg, transparent 49.8%, rgba(255, 255, 255, 0.06) 50%, transparent 50.2%),
    var(--board);
  color: var(--board-text); display: flex; align-items: center; justify-content: center;
}
.tag {
  position: absolute; top: 10px; left: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--board-muted);
}
.row { width: 100%; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0 6%; }
.centre { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 4%; }
.side { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; text-align: center; }
.crest { width: 34%; max-width: 120px; aspect-ratio: 1; object-fit: contain; }
.crest--text {
  display: grid; place-items: center; border: 2px solid var(--accent); border-radius: 50%;
  color: var(--accent); font-size: clamp(14px, 3vw, 28px);
}
.name { font-weight: 600; font-size: 15px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.score { font-size: clamp(36px, 6vw, 72px); line-height: 1; white-space: nowrap; }
.score--time { font-size: clamp(28px, 4.5vw, 56px); }
.score-chip {
  font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  display: inline-block; line-height: 1.5; background: var(--board-text); color: var(--board);
  border-radius: 999px; padding: 1px 10px; white-space: nowrap;
}
.score-chip--accent { background: var(--accent); color: var(--on-accent); }

.visual--md .crest { width: 40%; }
.visual--md .score { font-size: clamp(28px, 3.4vw, 44px); }
.visual--md .score--time { font-size: clamp(22px, 2.6vw, 32px); }
.visual--md .name { font-size: 13px; }

.visual--sm { aspect-ratio: 4 / 3; }
.visual--sm .tag, .visual--sm .name { display: none; }
.visual--sm .row { padding: 0 4%; }
.visual--sm .crest { width: 70%; }
.visual--sm .centre { padding: 0 2%; gap: 4px; }
.visual--sm .score { font-size: 24px; }
.visual--sm .score--time { font-size: 18px; }
.visual--sm .score-chip { font-size: 10px; padding: 1px 6px; }
</style>
