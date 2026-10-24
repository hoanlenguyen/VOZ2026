<script setup lang="ts">
// Subscription offer shown on match pages to free and signed-out readers, in place of the premium
// parts (the server leaves those out of the response). Illustration drawn here, not borrowed.
import { PhCheck, PhCheckCircle } from '@phosphor-icons/vue'

// `hideHeadline`: the match page already shows the teaser's headline as its title.
defineProps<{ teaser?: { headline: string, text: string, translated: boolean, source: 'ai' | 'newsroom' } | null, hideHeadline?: boolean }>()
const { t } = useI18n()
const { account } = useAccount()
const route = useRoute()
const loginLink = computed(() => ({ path: '/login', query: { redirect: route.fullPath } }))
// Signed-out readers subscribe by signing in (demo); free readers go to their account.
const offerLink = computed(() => (account.value ? '/account' : loginLink.value))
const BENEFITS = ['unlimited', 'stories', 'stats', 'languages'] as const
</script>

<template>
  <!-- The opening of the locked story, fading out into the offer. The rest is never sent to the browser. -->
  <div v-if="teaser" class="teaser">
    <p class="teaser-kicker">{{ teaser.source === 'newsroom' ? t('match.story') : t('paywall.teaserKicker') }}<template v-if="teaser.translated"> · {{ t('press.translated') }}</template></p>
    <h2 v-if="!hideHeadline" class="teaser-headline">{{ teaser.headline }}</h2>
    <p class="teaser-text">{{ teaser.text }}</p>
  </div>
  <section class="offer" :class="{ 'offer--after-teaser': teaser }" aria-labelledby="offer-title">
    <svg class="art" viewBox="0 0 680 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <circle cx="560" cy="62" r="34" class="sun-glow" />
      <circle cx="560" cy="62" r="24" class="sun" />
      <path d="M470 40q6-6 12 0q6-6 12 0M500 28q5-5 10 0q5-5 10 0M486 54q4-4 8 0q4-4 8 0" class="birds" />
      <path d="M0 210 Q140 120 300 170 T680 140 V300 H0Z" class="hill" />
      <path d="M0 240 Q200 170 380 215 T680 200 V300 H0Z" class="hill-2" />
      <path d="M-10 300 Q340 200 690 300Z" class="ground" />
      <!-- trees -->
      <g class="tree"><rect x="92" y="150" width="8" height="70" class="trunk" /><circle cx="96" cy="140" r="30" class="leaf" /><circle cx="76" cy="160" r="20" class="leaf-2" /></g>
      <g class="tree"><rect x="610" y="140" width="8" height="80" class="trunk" /><circle cx="614" cy="128" r="34" class="leaf-2" /><circle cx="636" cy="150" r="20" class="leaf" /></g>
      <g class="tree"><rect x="196" y="170" width="6" height="50" class="trunk" /><circle cx="199" cy="162" r="22" class="leaf" /></g>
      <!-- goal, ball and the falling leaves -->
      <path d="M420 250 V205 H520 V250 M420 205 L432 215 H508 L520 205" class="goal" />
      <path d="M436 215 V250 M452 215 V250 M468 215 V250 M484 215 V250 M500 215 V250 M432 228 H508 M432 240 H508" class="net" />
      <circle cx="350" cy="258" r="11" class="ball" />
      <path d="M344 254 l6 -3 l6 3 l-2 6 h-8z" class="ball-mark" />
      <path d="M260 120 q6 4 2 10M310 90 q-6 5 0 10M380 130 q5 3 1 9M150 100 q6 3 2 9" class="falling" />
    </svg>

    <div class="body">
      <h2 id="offer-title" class="title">{{ t('paywall.title') }}</h2>
      <p class="sub">
        {{ t('paywall.subBefore') }} <span class="mark">{{ t('paywall.subPrice') }}</span>
      </p>
      <ul class="benefits">
        <li v-for="b in BENEFITS" :key="b"><PhCheck :size="18" weight="bold" aria-hidden="true" />{{ t(`paywall.benefits.${b}`) }}</li>
      </ul>
      <NuxtLink :to="offerLink" class="cta">{{ t('paywall.cta') }}</NuxtLink>
      <p class="manage"><PhCheckCircle :size="20" weight="fill" aria-hidden="true" />{{ t('paywall.manage') }}</p>
      <p class="brand display" aria-hidden="true">VOZ</p>
      <p v-if="!account" class="login">
        {{ t('paywall.already') }} <NuxtLink :to="loginLink">{{ t('paywall.logIn') }}</NuxtLink>
      </p>
    </div>
  </section>
</template>

<style scoped>
.teaser { margin-top: 40px; }
.teaser-kicker { margin: 0; font-size: 11px; line-height: 16px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta); }
.teaser-headline { margin: 6px 0 0; font-size: clamp(22px, 3vw, 28px); line-height: 1.25; font-weight: 700; color: var(--headline); }
/* Fades to nothing over the last lines, like a print page running into the offer. */
.teaser-text {
  margin: 12px 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(19px, 2.4vw, 24px); line-height: 1.55; color: var(--summary);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, black 25%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 0%, black 25%, transparent 100%);
}
.offer { margin-top: 40px; border-radius: 4px; overflow: hidden; background: var(--offer-bg); color: var(--offer-text); }
.offer--after-teaser { margin-top: 8px; }
.art { display: block; width: 100%; height: auto; aspect-ratio: 680 / 300; }
.sun { fill: var(--offer-sun); }
.sun-glow { fill: var(--offer-sun); opacity: 0.35; }
.birds { fill: none; stroke: var(--offer-text); stroke-width: 2; stroke-linecap: round; }
.hill { fill: var(--offer-hill); }
.hill-2 { fill: var(--offer-hill-2); }
.ground { fill: var(--offer-ground); }
.trunk { fill: var(--offer-trunk); }
.leaf { fill: var(--offer-leaf); }
.leaf-2 { fill: var(--offer-leaf-2); }
.goal { fill: none; stroke: var(--bg); stroke-width: 4; stroke-linejoin: round; }
.net { fill: none; stroke: var(--bg); stroke-width: 1; opacity: 0.8; }
.ball { fill: var(--bg); stroke: var(--offer-text); stroke-width: 1.5; }
.ball-mark { fill: var(--offer-text); }
.falling { fill: none; stroke: var(--offer-leaf-2); stroke-width: 3; stroke-linecap: round; }

.body { padding: 8px 24px 32px; text-align: center; }
.title { margin: 0; font-size: clamp(30px, 6vw, 44px); line-height: 1.1; font-weight: 800; letter-spacing: -0.01em; }
.sub { margin: 12px 0 0; font-size: clamp(18px, 3.4vw, 24px); font-weight: 300; line-height: 1.35; }
.mark { font-weight: 400; text-decoration: underline; text-decoration-color: var(--offer-ink); text-decoration-thickness: 3px; text-underline-offset: 5px; }
.benefits { list-style: none; margin: 22px auto 0; padding: 0; display: flex; flex-direction: column; gap: 8px; text-align: left; width: fit-content; max-width: 420px; }
.benefits li { display: flex; align-items: flex-start; gap: 10px; font-size: 16px; line-height: 1.35; }
.benefits li :deep(svg) { flex-shrink: 0; margin-top: 1px; color: var(--offer-ink); }
.cta {
  margin: 26px auto 0; min-height: 52px; min-width: 260px; width: fit-content; padding: 0 32px; display: flex; align-items: center; justify-content: center;
  border-radius: 999px; background: var(--offer-ink); color: var(--bg); font-size: 17px; font-weight: 800;
  letter-spacing: 0.04em; text-transform: uppercase; text-decoration: none;
  transition: background-color var(--dur-fast) var(--ease-out);
}
.cta:hover { background: var(--offer-ink-hover); color: var(--bg); }
.cta:focus-visible { outline: 3px solid var(--offer-text); outline-offset: 3px; }
.manage { margin: 18px 0 0; display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 15px; }
.manage :deep(svg) { color: var(--offer-ink); flex-shrink: 0; }
.brand { margin: 16px 0 0; font-size: 40px; line-height: 1; letter-spacing: 0.06em; }
.login { margin: 12px 0 0; font-size: 15px; }
.login a { color: var(--offer-ink); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.login a:hover { color: var(--offer-ink-hover); }
.login a:focus-visible { outline: 2px solid var(--offer-text); outline-offset: 2px; }
@media (max-width: 479px) {
  .body { padding: 4px 16px 28px; }
  .cta { min-width: 0; width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .cta { transition: none; } }
</style>
