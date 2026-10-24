<script setup lang="ts">
// Tall demo advertiser's post (a "skyscraper") for the left of the match article: a stadium tour.
// Fictional advertiser, illustration drawn here with the colour tokens; the call to action is not
// a link (demo).
const { t } = useI18n()
</script>

<template>
  <article class="tall" :aria-label="t('ads.label')">
    <p class="tall-label"><span>{{ t('ads.label') }}</span> · {{ t('ads.tour.sponsor') }}</p>
    <svg class="art" viewBox="0 0 260 300" aria-hidden="true">
      <!-- floodlights -->
      <path d="M30 120V30M230 120V30" class="pole" />
      <rect x="16" y="18" width="28" height="16" rx="3" class="lamp" />
      <rect x="216" y="18" width="28" height="16" rx="3" class="lamp" />
      <path d="M30 34L0 150M30 34L70 150M230 34L190 150M230 34L260 150" class="beam" />
      <!-- stands -->
      <path d="M10 150Q130 96 250 150V190H10z" class="stand" />
      <path d="M22 160Q130 116 238 160M34 172Q130 134 226 172" class="rows" />
      <!-- pitch in perspective, centre line and circle -->
      <path d="M10 190H250L278 300H-18z" class="pitch" />
      <path d="M130 190V300M-4 245H264" class="lines" />
      <ellipse cx="130" cy="245" rx="34" ry="12" class="lines" />
      <!-- tunnel -->
      <path d="M112 190v-22a18 18 0 0 1 36 0v22z" class="tunnel" />
    </svg>
    <h3 class="tall-title">{{ t('ads.tour.title') }}</h3>
    <p class="tall-text">{{ t('ads.tour.text') }}</p>
    <ul class="tall-points">
      <li v-for="k in (['tunnel', 'dugout', 'museum'] as const)" :key="k">{{ t(`ads.tour.points.${k}`) }}</li>
    </ul>
    <span class="tall-cta">{{ t('ads.tour.cta') }}</span>
  </article>
</template>

<style scoped>
.tall {
  border-radius: 4px; padding: 20px; display: flex; flex-direction: column; gap: 10px;
  background: var(--board); color: var(--board-text);
}
.tall-label { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--board-muted); }
.tall-label span { padding: 1px 6px; border: 1px solid currentColor; border-radius: 3px; }
.art { width: 100%; height: auto; margin: 4px 0 6px; border-radius: 4px; }
.pole { stroke: var(--board-muted); stroke-width: 4; }
.lamp { fill: var(--accent); }
.beam { stroke: var(--accent); stroke-width: 1; opacity: 0.35; }
.stand { fill: var(--surface-2); }
.rows { fill: none; stroke: var(--board-muted); stroke-width: 1.5; opacity: 0.5; }
.pitch { fill: var(--win); }
.lines { fill: none; stroke: var(--board-text); stroke-width: 2; opacity: 0.8; }
.tunnel { fill: var(--board); }
.tall-title { margin: 0; font-family: var(--font-display); font-size: 30px; line-height: 1.05; font-weight: 700; letter-spacing: 0.01em; text-transform: uppercase; }
.tall-text { margin: 0; font-size: 14px; line-height: 1.5; color: var(--board-muted); }
.tall-points { margin: 0; padding: 0 0 0 18px; font-size: 14px; line-height: 1.6; }
.tall-points li::marker { color: var(--accent); }
.tall-cta {
  align-self: stretch; margin-top: 8px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px; background: var(--accent); color: var(--on-accent); font-size: 14px; font-weight: 700;
}
</style>
