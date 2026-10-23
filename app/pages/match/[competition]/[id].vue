<script setup lang="ts">
// Screen 3 placeholder; the AI match story is built in Phase 2.
const route = useRoute()
const { data, error } = await useFetch(`/api/competitions/${route.params.competition}/matches/${route.params.id}`)
const match = computed(() => data.value?.match)
const periods = computed(() => match.value?.periods.map(p => `${p.home}–${p.away}`).join(' · ') ?? '')
</script>

<template>
  <main>
    <NuxtLink to="/" class="muted" style="display: inline-block; padding: 16px">← Back</NuxtLink>
    <p v-if="error" class="card">Could not load match: {{ error.statusMessage }}</p>
    <section v-else-if="match" class="card">
      <p class="eyebrow">{{ data?.competition.name }} · {{ match.finishType ?? match.status }}</p>
      <h1 class="display num" style="font-size: 40px">
        {{ match.home.shortName }} {{ formatScore(match) }} {{ match.away.shortName }}
      </h1>
      <p class="muted">
        <template v-if="match.home.stats.xg != null">xG {{ match.home.stats.xg }} – {{ match.away.stats.xg }} · </template>
        <template v-if="match.attendance">{{ match.attendance }} spectators · </template>{{ match.venue }}
      </p>
      <p v-if="periods" class="muted num">{{ periods }}</p>
      <ol v-if="match.goals.length">
        <li v-for="g in match.goals" :key="g.id" class="num">
          {{ g.clockLabel }} {{ g.scorer.name }} ({{ g.homeScore }}–{{ g.awayScore }})
          <span v-if="g.tags.length" class="muted">{{ g.tags.join(', ') }}</span>
        </li>
      </ol>
      <p v-else-if="!data?.competition.hasScoringEvents" class="muted">Goal details are not included in this data plan.</p>
    </section>
  </main>
</template>
