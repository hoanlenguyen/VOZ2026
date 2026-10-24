<script setup lang="ts">
// Upcoming fixtures: league picker + a strip of match cards that advances one card every 5 s.
// Auto-advance stops for good once the reader takes over (arrows, drag, swipe, wheel, keys),
// pauses while hovered/focused or when the tab is hidden, and never runs with
// prefers-reduced-motion. No visible pause button or progress line, by design choice.
import { PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue'
import type { LandingData } from '#shared/types/stories'

const INTERVAL_MS = 5000

const props = defineProps<{ leagues: LandingData['ticker'] }>()
const selected = ref(props.leagues[0]?.competitionId ?? '')
const league = computed(() => props.leagues.find(l => l.competitionId === selected.value) ?? props.leagues[0])

const strip = ref<HTMLOListElement>()
const atStart = ref(true)
const atEnd = ref(true)

// --- auto-advance state ---
const userTookOver = ref(false) // reader scrolled the strip themselves: stop until the league changes
const hovered = ref(false)
const focused = ref(false)
const pageVisible = ref(true)
const reducedMotion = ref(false)

const canScroll = computed(() => !(atStart.value && atEnd.value))
const autoEnabled = computed(() => !reducedMotion.value && !userTookOver.value && canScroll.value)
const running = computed(() => autoEnabled.value && !hovered.value && !focused.value && pageVisible.value)

function updateEdges() {
  const el = strip.value
  if (!el) return
  atStart.value = el.scrollLeft <= 1
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
}

const cardWidth = () => strip.value?.querySelector<HTMLElement>('.fixture')?.offsetWidth ?? 0

// Arrow buttons: page by the visible width, keeping one card of overlap for context.
function page(dir: 1 | -1) {
  takeOver()
  const el = strip.value
  if (!el) return
  el.scrollBy({ left: dir * Math.max(el.clientWidth - cardWidth(), cardWidth()), behavior: 'smooth' })
}

// One automatic step: next card, or back to the first one at the end.
function advance() {
  const el = strip.value
  if (!el || !running.value) return
  if (atEnd.value) el.scrollTo({ left: 0, behavior: 'smooth' })
  else el.scrollBy({ left: cardWidth(), behavior: 'smooth' })
  restart()
}

// Step timer. Pausing keeps the time left, so hovering mid-way does not reset the countdown.
let timer: ReturnType<typeof setTimeout> | undefined
let startedAt = 0
let remaining = INTERVAL_MS

function startTimer() {
  if (timer || !running.value) return
  startedAt = Date.now()
  timer = setTimeout(() => {
    timer = undefined
    advance()
  }, remaining)
}
function stopTimer() {
  if (!timer) return
  clearTimeout(timer)
  timer = undefined
  remaining = Math.max(0, remaining - (Date.now() - startedAt))
}
function restart() {
  if (timer) clearTimeout(timer)
  timer = undefined
  remaining = INTERVAL_MS
  startTimer()
}
watch(running, r => (r ? startTimer() : stopTimer()))

function takeOver() {
  userTookOver.value = true
}

function onKeydown(e: KeyboardEvent) {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) takeOver()
}

watch(selected, async () => {
  userTookOver.value = false
  await nextTick()
  strip.value?.scrollTo({ left: 0 })
  updateEdges()
  restart()
})

let motionQuery: MediaQueryList | undefined
const onMotionChange = () => (reducedMotion.value = !!motionQuery?.matches)
const onVisibility = () => (pageVisible.value = document.visibilityState === 'visible')

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  onMotionChange()
  motionQuery.addEventListener('change', onMotionChange)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('resize', updateEdges, { passive: true })
  updateEdges()
  startTimer()
})
onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  motionQuery?.removeEventListener('change', onMotionChange)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('resize', updateEdges)
})

const timeParts = (iso: string) => {
  const [time, day] = fixtureTime(iso).split(', ')
  return { time, day }
}
</script>

<template>
  <section
    v-if="league" class="ticker" aria-roledescription="carousel" aria-label="Upcoming fixtures"
    @pointerenter="hovered = true" @pointerleave="hovered = false"
    @focusin="focused = true" @focusout="focused = false"
  >
    <div class="league">
      <NewsLeaguePicker v-model="selected" :leagues="leagues" />
      <p class="count num">{{ league.fixtures.length }} upcoming</p>
    </div>

    <div class="strip">
      <button
        v-show="!atStart" type="button" class="nav-btn prev" aria-label="Previous fixtures"
        aria-controls="ticker-fixtures" @click="page(-1)"
      >
        <PhCaretLeft :size="16" weight="bold" aria-hidden="true" />
      </button>

      <ol
        id="ticker-fixtures" ref="strip" class="fixtures" :aria-live="running ? 'off' : 'polite'"
        @scroll.passive="updateEdges" @pointerdown="takeOver" @wheel.passive="takeOver" @touchstart.passive="takeOver"
        @keydown="onKeydown"
      >
        <li v-for="(f, i) in league.fixtures" :key="f.key" class="fixture" aria-roledescription="slide" :aria-label="`${i + 1} of ${league.fixtures.length}`">
          <NuxtLink :to="f.href" class="fixture-card">
            <span class="when num">
              <strong>{{ timeParts(f.start).time }}</strong>
              <span class="day" :class="{ 'day--soon': ['Today', 'Tomorrow'].includes(timeParts(f.start).day ?? '') }">{{ timeParts(f.start).day }}</span>
            </span>
            <span v-for="(t, side) in { home: f.home, away: f.away }" :key="side" class="team">
              <img v-if="t.logo" :src="t.logo" alt="" width="24" height="24" loading="lazy">
              <span v-else class="crest-fallback" aria-hidden="true">{{ t.name.slice(0, 1) }}</span>
              <span class="team-name">{{ t.name }}</span>
            </span>
          </NuxtLink>
        </li>
        <li v-if="!league.fixtures.length" class="fixture empty">No upcoming fixtures</li>
      </ol>

      <button
        v-show="!atEnd" type="button" class="nav-btn next" aria-label="Next fixtures"
        aria-controls="ticker-fixtures" @click="page(1)"
      >
        <PhCaretRight :size="16" weight="bold" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.ticker {
  max-width: var(--page-max); margin: 16px auto 0; display: flex; border: 1px solid var(--line-strong);
  border-radius: 12px; background: var(--bg);
}
.league {
  flex: 0 0 236px; padding: 12px; background: var(--surface); border-radius: 12px 0 0 12px;
  display: flex; flex-direction: column; justify-content: center; gap: 8px; border-right: 1px solid var(--line);
}
.count { margin: 0; padding: 0 4px; font-size: 12px; color: var(--meta); }

.strip { position: relative; flex: 1 1 auto; min-width: 0; display: flex; overflow: hidden; border-radius: 0 12px 12px 0; }
.fixtures {
  flex: 1 1 auto; min-width: 0; list-style: none; margin: 0; padding: 0; display: flex;
  overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain;
}
.fixtures::-webkit-scrollbar { display: none; }
.fixture { flex: 0 0 184px; border-right: 1px solid var(--line); scroll-snap-align: start; }
.fixture.empty { flex-basis: auto; padding: 16px; color: var(--meta); display: flex; align-items: center; }
.fixture-card {
  height: 100%; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
  color: var(--headline); text-decoration: none; transition: background-color var(--dur-fast) var(--ease-out);
}
.fixture-card:hover { background: var(--surface); }
.fixture-card:hover .team-name { color: var(--link-hover); }
.fixture-card:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.when { display: flex; align-items: baseline; gap: 6px; font-size: 13px; margin-bottom: 2px; }
.when strong { font-size: 15px; font-weight: 700; color: var(--headline); }
.day { color: var(--meta); }
.day--soon { color: var(--accent-ink); font-weight: 600; }
.team { display: flex; align-items: center; gap: 10px; min-width: 0; font-size: 15px; font-weight: 600; }
.team img { object-fit: contain; flex-shrink: 0; }
.crest-fallback {
  width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center;
  background: var(--surface-2); color: var(--meta); font-size: 12px; font-weight: 700;
}
.team-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: color var(--dur-fast) var(--ease-out); }

/* 44px hit area around a 32px circle */
.nav-btn {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 1;
  width: 44px; height: 44px; display: grid; place-items: center; border: 0; padding: 0;
  background: transparent; color: var(--text); cursor: pointer;
}
.nav-btn::before {
  content: ''; position: absolute; inset: 6px; border-radius: 999px; z-index: -1;
  background: var(--bg); border: 1px solid var(--border-control);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.15); transition: background-color var(--dur-fast) var(--ease-out);
}
.nav-btn:hover::before { background: var(--surface); }
.nav-btn:focus-visible { outline: none; }
.nav-btn:focus-visible::before { outline: 2px solid var(--accent); outline-offset: 2px; }
.nav-btn.prev { left: 2px; }
.nav-btn.next { right: 2px; }


@media (max-width: 1199px) { .ticker { margin-left: 16px; margin-right: 16px; } }
@media (min-width: 768px) and (max-width: 1199px) { .ticker { margin-left: 30px; margin-right: 30px; } }
/* Phones: picker row on top, strip below */
@media (max-width: 639px) {
  .ticker { flex-direction: column; }
  .league { flex: none; flex-direction: row; align-items: center; border-right: 0; border-bottom: 1px solid var(--line); border-radius: 12px 12px 0 0; }
  .league :deep(.picker) { flex: 1 1 auto; min-width: 0; }
    .count { display: none; }
  .strip { border-radius: 0 0 12px 12px; }
  .fixture { flex-basis: 164px; }
}
</style>
