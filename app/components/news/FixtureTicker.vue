<script setup lang="ts">
import { PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue'
import type { LandingData } from '#shared/types/stories'

const props = defineProps<{ leagues: LandingData['ticker'] }>()
const selected = ref(props.leagues[0]?.competitionId ?? '')
const league = computed(() => props.leagues.find(l => l.competitionId === selected.value) ?? props.leagues[0])

const strip = ref<HTMLOListElement>()
const atStart = ref(true)
const atEnd = ref(true)

function updateEdges() {
  const el = strip.value
  if (!el) return
  atStart.value = el.scrollLeft <= 1
  atEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
}

// Page by the visible width, keeping one card of overlap for context
function page(dir: 1 | -1) {
  const el = strip.value
  if (!el) return
  const card = el.querySelector<HTMLElement>('.fixture')?.offsetWidth ?? 0
  el.scrollBy({ left: dir * Math.max(el.clientWidth - card, card), behavior: 'smooth' })
}

watch(selected, async () => {
  await nextTick()
  strip.value?.scrollTo({ left: 0 })
  updateEdges()
})

onMounted(() => {
  updateEdges()
  window.addEventListener('resize', updateEdges, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('resize', updateEdges))
</script>

<template>
  <section v-if="league" class="ticker" aria-label="Upcoming fixtures">
    <div class="league">
      <img v-if="league.emblem" :src="league.emblem" alt="" width="40" height="40" class="emblem">
      <label class="sr-only" for="ticker-league">League</label>
      <select id="ticker-league" v-model="selected" class="league-select">
        <option v-for="l in leagues" :key="l.competitionId" :value="l.competitionId">{{ l.competitionName }}</option>
      </select>
    </div>
    <div class="strip">
      <button v-show="!atStart" type="button" class="nav-btn prev" aria-label="Previous fixtures" aria-controls="ticker-fixtures" @click="page(-1)">
        <PhCaretLeft :size="16" weight="bold" aria-hidden="true" />
      </button>
      <ol id="ticker-fixtures" ref="strip" class="fixtures" @scroll.passive="updateEdges">
        <li v-for="f in league.fixtures" :key="f.key" class="fixture">
          <p class="when num">{{ fixtureTime(f.start) }}</p>
          <p v-for="t in [f.home, f.away]" :key="t.name" class="team">
            <img v-if="t.logo" :src="t.logo" alt="" width="22" height="22" loading="lazy">
            <span>{{ t.name }}</span>
          </p>
        </li>
        <li v-if="!league.fixtures.length" class="fixture empty">No upcoming fixtures</li>
      </ol>
      <button v-show="!atEnd" type="button" class="nav-btn next" aria-label="Next fixtures" aria-controls="ticker-fixtures" @click="page(1)">
        <PhCaretRight :size="16" weight="bold" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.ticker {
  max-width: var(--page-max); margin: 16px auto 0; display: flex; border: 1px solid var(--line-strong);
  border-radius: 4px; overflow: hidden; background: var(--bg);
}
.league {
  flex: 0 0 auto; width: 150px; padding: 12px; background: var(--surface);
  display: flex; flex-direction: column; justify-content: center; gap: 8px; border-right: 1px solid var(--line);
}
.emblem { object-fit: contain; }
.league-select {
  width: 100%; min-height: 44px; border: 1px solid var(--border-control); border-radius: 8px;
  background: var(--bg); color: var(--text); font-weight: 600; padding: 0 6px;
}
.fixtures {
  flex: 1 1 auto; min-width: 0; list-style: none; margin: 0; padding: 0; display: flex;
  overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none;
}
.fixtures::-webkit-scrollbar { display: none; }
.strip { position: relative; flex: 1 1 auto; min-width: 0; display: flex; }
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
.fixture {
  flex: 0 0 168px; padding: 12px 14px; border-right: 1px solid var(--line); scroll-snap-align: start;
  display: flex; flex-direction: column; gap: 6px;
}
.fixture.empty { flex-basis: auto; color: var(--muted); justify-content: center; }
.when { margin: 0 0 2px; font-size: 13px; color: var(--muted); }
.team { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; min-width: 0; }
.team img { object-fit: contain; flex-shrink: 0; }
.team span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 1199px) { .ticker { margin-left: 16px; margin-right: 16px; } }
@media (min-width: 768px) and (max-width: 1199px) { .ticker { margin-left: 30px; margin-right: 30px; } }
@media (max-width: 480px) { .league { width: 116px; } .fixture { flex-basis: 150px; } }
</style>
