<script setup lang="ts">
import type { LandingData } from '#shared/types/stories'

const props = defineProps<{ leagues: LandingData['ticker'] }>()
const selected = ref(props.leagues[0]?.competitionId ?? '')
const league = computed(() => props.leagues.find(l => l.competitionId === selected.value) ?? props.leagues[0])
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
    <ol class="fixtures">
      <li v-for="f in league.fixtures" :key="f.key" class="fixture">
        <p class="when num">{{ fixtureTime(f.start) }}</p>
        <p v-for="t in [f.home, f.away]" :key="t.name" class="team">
          <img v-if="t.logo" :src="t.logo" alt="" width="22" height="22" loading="lazy">
          <span>{{ t.name }}</span>
        </p>
      </li>
      <li v-if="!league.fixtures.length" class="fixture empty">No upcoming fixtures</li>
    </ol>
  </section>
</template>

<style scoped>
.ticker {
  max-width: 1200px; margin: 16px auto 0; display: flex; border: 1px solid var(--line);
  border-radius: 8px; overflow: hidden; background: var(--bg);
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
.fixtures { list-style: none; margin: 0; padding: 0; display: flex; overflow-x: auto; scroll-snap-type: x proximity; }
.fixture {
  flex: 0 0 168px; padding: 12px 14px; border-right: 1px solid var(--line); scroll-snap-align: start;
  display: flex; flex-direction: column; gap: 6px;
}
.fixture.empty { flex-basis: auto; color: var(--muted); justify-content: center; }
.when { margin: 0 0 2px; font-size: 13px; color: var(--muted); }
.team { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; min-width: 0; }
.team img { object-fit: contain; flex-shrink: 0; }
.team span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 1232px) { .ticker { margin-left: 16px; margin-right: 16px; } }
@media (max-width: 480px) { .league { width: 116px; } .fixture { flex-basis: 150px; } }
</style>
