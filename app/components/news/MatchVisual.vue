<script setup lang="ts">
// Data-driven "photo" for a story: crests and score on the dark VOZ scoreboard. No generated or
// borrowed imagery, so the picture can never show something that did not happen.
import type { Story } from '#shared/types/stories'

const props = withDefaults(defineProps<{ story: Pick<Story, 'competitionName' | 'match'>, size?: 'lg' | 'md' | 'sm' }>(), { size: 'md' })
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
    <!-- 160×90 field, sliced to fill any aspect ratio; markings are scaled from real dimensions -->
    <svg class="field" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g v-if="m.sport === 'football'" class="pitch">
        <rect v-for="i in 5" :key="i" :x="(i - 1) * 32 + 16" y="0" width="16" height="90" class="stripe" />
        <rect x="6" y="6" width="148" height="78" />
        <line x1="80" y1="6" x2="80" y2="84" />
        <circle cx="80" cy="45" r="13" />
        <circle cx="80" cy="45" r="0.9" class="spot" />
        <rect x="6" y="22" width="23" height="46" />
        <rect x="131" y="22" width="23" height="46" />
        <rect x="6" y="34.5" width="8" height="21" />
        <rect x="146" y="34.5" width="8" height="21" />
        <path d="M29 37.5a9 9 0 0 1 0 15M131 37.5a9 9 0 0 0 0 15" />
      </g>
      <g v-else class="rink">
        <rect x="6" y="6" width="148" height="78" rx="20" />
        <line x1="14" y1="9" x2="14" y2="81" class="red" />
        <line x1="146" y1="9" x2="146" y2="81" class="red" />
        <line x1="56" y1="6" x2="56" y2="84" class="blue" />
        <line x1="104" y1="6" x2="104" y2="84" class="blue" />
        <line x1="80" y1="6" x2="80" y2="84" class="red" />
        <circle cx="80" cy="45" r="12" class="blue-thin" />
        <circle v-for="([x, y]) in [[32, 27], [32, 63], [128, 27], [128, 63]]" :key="`${x}-${y}`" :cx="x" :cy="y" r="9" class="red-thin" />
      </g>
    </svg>
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
  margin: 0; position: relative; aspect-ratio: 16 / 9; border-radius: 4px; overflow: hidden;
  background: var(--board);
  color: var(--board-text); display: flex; align-items: center; justify-content: center;
}
.tag {
  position: absolute; top: 10px; left: 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--board-muted);
}
.field { position: absolute; inset: 0; width: 100%; height: 100%; }
.field * { fill: none; stroke: var(--board-line); stroke-width: 1; vector-effect: non-scaling-stroke; }
.field .stripe { fill: var(--board-stripe); stroke: none; }
.field .spot { fill: var(--board-line); }
.field .red, .field .red-thin { stroke: var(--board-rink-red); }
.field .blue, .field .blue-thin { stroke: var(--board-rink-blue); }
.field .red, .field .blue { stroke-width: 2; }
.row { position: relative; width: 100%; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0 6%; }
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
