<script setup lang="ts">
// Demo advertisement for readers who get ads (free and signed-out): a sports shop, a fan event or a
// local league. Advertisers are fictional; illustrations are drawn here with the colour tokens.
// The call to action is not a link (demo), so it never leads nowhere.
defineProps<{ kind: 'shop' | 'event' | 'league' }>()
const { t } = useI18n()
</script>

<template>
  <article class="ad" :class="`ad--${kind}`" :aria-label="t('ads.label')">
    <p class="ad-label"><span>{{ t('ads.label') }}</span> · {{ t(`ads.${kind}.sponsor`) }}</p>
    <svg class="art" viewBox="0 0 280 96" aria-hidden="true">
      <template v-if="kind === 'shop'">
        <!-- a football boot and a shirt -->
        <path d="M40 58c14 0 22-12 30-12h18c4 0 6 4 6 8v8c0 6-4 10-10 10H34c-6 0-10-4-10-8 0-4 4-6 16-6z" class="ink" />
        <path d="M30 72h62" class="stud" />
        <path d="M168 26l18-10h20l18 10 12 18-16 8-6-8v42h-56V44l-6 8-16-8z" class="ink" />
        <path d="M196 16c0 8 8 12 10 12s10-4 10-12" class="cut" />
        <text x="196" y="66" text-anchor="middle" class="num-art">10</text>
      </template>
      <template v-else-if="kind === 'event'">
        <!-- a big screen with a ball, crowd heads below -->
        <rect x="70" y="10" width="140" height="58" rx="6" class="ink" />
        <rect x="78" y="18" width="124" height="42" rx="3" class="screen" />
        <circle cx="140" cy="39" r="11" class="ball" />
        <path d="M134 35l6-3 6 3-2 6h-8z" class="ink" />
        <path d="M136 68v12M144 68v12" class="post" />
        <circle v-for="x in [30, 62, 94, 126, 158, 190, 222, 254]" :key="x" :cx="x" cy="90" r="10" class="crowd" />
      </template>
      <template v-else>
        <!-- a small goal and a ball on a pitch line -->
        <path d="M8 86h264" class="line" />
        <path d="M150 86V30h100v56" class="post-big" />
        <path d="M160 30v56M175 30v56M190 30v56M205 30v56M220 30v56M235 30v56M150 44h100M150 58h100M150 72h100" class="net" />
        <circle cx="80" cy="72" r="14" class="ball" />
        <path d="M74 67l6-4 6 4-2 7h-8z" class="ink" />
      </template>
    </svg>
    <h3 class="ad-title">{{ t(`ads.${kind}.title`) }}</h3>
    <p class="ad-text">{{ t(`ads.${kind}.text`) }}</p>
    <span class="ad-cta">{{ t(`ads.${kind}.cta`) }}</span>
  </article>
</template>

<style scoped>
.ad { border-radius: 4px; padding: 18px 18px 20px; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
.ad-label { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.8; }
.ad-label span { padding: 1px 6px; border: 1px solid currentColor; border-radius: 3px; }
.art { width: 100%; height: auto; margin: 4px 0; }
.ad-title { margin: 0; font-size: 18px; line-height: 1.25; font-weight: 700; }
.ad-text { margin: 0; font-size: 14px; line-height: 1.45; opacity: 0.9; }
.ad-cta {
  align-self: flex-start; margin-top: 6px; min-height: 36px; padding: 0 16px; display: inline-flex; align-items: center;
  border-radius: 999px; font-size: 13px; font-weight: 700;
}

/* Sports shop: pitch green (kept apart from VOZ's own warm subscription offer) */
.ad--shop { background: var(--win); color: var(--board-text); }
.ad--shop .ink { fill: var(--board-text); }
.ad--shop .stud { stroke: var(--board); stroke-width: 4; stroke-dasharray: 4 8; stroke-linecap: round; }
.ad--shop .cut { fill: none; stroke: var(--win); stroke-width: 3; }
.ad--shop .num-art { font: 700 30px var(--font-display); fill: var(--win); }
.ad--shop .ad-cta { background: var(--board-text); color: var(--board); }

/* Fan event: scoreboard dark */
.ad--event { background: var(--board); color: var(--board-text); }
.ad--event .ink { fill: var(--surface-2); }
.ad--event .screen { fill: var(--win); }
.ad--event .ball { fill: var(--board-text); }
.ad--event .ball + .ink { fill: var(--board); }
.ad--event .post { stroke: var(--surface-2); stroke-width: 4; }
.ad--event .crowd { fill: var(--board-muted); opacity: 0.5; }
.ad--event .ad-cta { background: var(--accent); color: var(--on-accent); }

/* Local league: light surface */
.ad--league { background: var(--surface); color: var(--headline); border: 1px solid var(--line-strong); }
.ad--league .line { stroke: var(--win); stroke-width: 3; }
.ad--league .post-big { fill: none; stroke: var(--headline); stroke-width: 5; stroke-linejoin: round; }
.ad--league .net { stroke: var(--border-control); stroke-width: 1; }
.ad--league .ball { fill: var(--bg); stroke: var(--headline); stroke-width: 2; }
.ad--league .ink { fill: var(--headline); }
.ad--league .ad-cta { background: var(--headline); color: var(--bg); }
</style>
