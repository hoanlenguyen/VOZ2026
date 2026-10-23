<script setup lang="ts">
// Screen 1 placeholder; built in Phase 4.
const { data } = await useFetch('/api/teams')
</script>

<template>
  <main class="card">
    <p class="display" style="color: var(--accent); font-size: 22px; letter-spacing: 0.08em">VOZ</p>
    <h1 class="display" style="font-size: 34px">Make it your sports world</h1>
    <p class="muted">Onboarding comes in Phase 4. Teams loaded: {{ data?.teams.length ?? 0 }}</p>
    <ul>
      <li v-for="t in data?.teams" :key="t.slug">{{ t.name }} · {{ t.town }}</li>
    </ul>
  </main>
</template>
