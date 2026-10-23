<script setup lang="ts">
// Screen 3 placeholder; the AI match story is built in Phase 2.
const route = useRoute()
const { data, error } = await useFetch(`/api/games/${route.params.id}`)
const game = computed(() => data.value?.game)
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
</script>

<template>
  <main>
    <NuxtLink to="/" class="muted" style="display: inline-block; padding: 16px">← Back</NuxtLink>
    <p v-if="error" class="card">Could not load game: {{ error.statusMessage }}</p>
    <section v-else-if="game" class="card">
      <p class="eyebrow">Liiga · {{ game.finishType ?? (game.started ? 'live' : 'upcoming') }}</p>
      <h1 class="display" style="font-size: 40px">
        {{ game.home.name }} {{ game.home.score }}–{{ game.away.score }} {{ game.away.name }}
      </h1>
      <p class="muted">xG {{ game.home.xg ?? '–' }} – {{ game.away.xg ?? '–' }} · {{ game.spectators ?? '–' }} spectators · {{ game.rink }}</p>
      <ol>
        <li v-for="g in game.goals" :key="g.eventId">
          {{ clock(g.gameTime) }} {{ g.scorer.name }} ({{ g.homeScore }}–{{ g.awayScore }})
          <span v-if="g.types.length" class="muted">{{ g.types.join(', ') }}</span>
        </li>
      </ol>
    </section>
  </main>
</template>
