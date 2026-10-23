<script setup lang="ts">
// Screen 1 placeholder; built in Phase 4. Sport -> competition -> team.
const { bySport } = await useCompetitions()
const competition = ref('liiga')
const { data, error } = await useFetch(() => `/api/competitions/${competition.value}/teams`)
const unavailableNote = (c: Competition) => (c.available ? '' : ` (${c.unavailableReason})`)
</script>

<template>
  <main class="card">
    <p class="display" style="color: var(--accent); font-size: 22px; letter-spacing: 0.08em">VOZ</p>
    <h1 class="display" style="font-size: 34px">Make it your sports world</h1>
    <p class="muted">Onboarding comes in Phase 4. Pick a league to see its teams.</p>

    <label for="competition" style="display: block; font-weight: 600; margin: 16px 0 6px">League</label>
    <select id="competition" v-model="competition" class="select">
      <optgroup v-for="group in bySport" :key="group.sport" :label="group.label">
        <option v-for="c in group.competitions" :key="c.id" :value="c.id" :disabled="!c.available">
          {{ c.name }}{{ unavailableNote(c) }}
        </option>
      </optgroup>
    </select>

    <p v-if="error" class="muted">Could not load teams: {{ error.statusMessage }}</p>
    <ul v-else>
      <li v-for="t in data?.teams" :key="t.key">{{ t.shortName }}<span class="muted"> · {{ t.town ?? t.venue }}</span></li>
    </ul>
  </main>
</template>
