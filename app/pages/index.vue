<script setup lang="ts">
// Data layer status page: proves each provider works end to end. Replaced by My feed in Phase 5.
const { bySport } = await useCompetitions()
const { data: health } = await useFetch('/api/health')
const selected = ref('liiga')

const { data: standings, error: standingsError } = await useFetch(() => `/api/competitions/${selected.value}/standings`)
const { data: results } = await useFetch(() => `/api/competitions/${selected.value}/matches`, { query: { state: 'finished' } })
const latest = computed(() => results.value?.matches.slice(-8).reverse() ?? [])
</script>

<template>
  <main>
    <header style="padding: 20px">
      <p class="display" style="color: var(--accent); font-size: 26px; letter-spacing: 0.08em; margin: 0">VOZ</p>
      <p class="muted" style="margin: 0">My Sports World · data layer status</p>
    </header>

    <section class="card">
      <h2 style="font-size: 17px; margin-bottom: 8px">Data sources · mode {{ health?.mode }}</h2>
      <p v-for="(p, name) in health?.providers" :key="name" style="margin: 4px 0">
        <span class="badge" :class="{ 'badge--warn': !p.ok || p.source === 'snapshot' }">{{ p.ok ? p.source : 'off' }}</span>
        {{ name }} <span v-if="p.error" class="muted">· {{ p.error }}</span>
      </p>
      <NuxtLink to="/onboarding">Onboarding →</NuxtLink>
    </section>

    <section class="card">
      <div v-for="group in bySport" :key="group.sport" style="margin-bottom: 12px">
        <p class="eyebrow" style="margin: 0 0 8px">{{ group.label }}</p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px">
          <button
            v-for="c in group.competitions" :key="c.id" type="button"
            :disabled="!c.available" :aria-pressed="selected === c.id" :title="c.unavailableReason ?? undefined"
            class="chip" @click="selected = c.id"
          >
            {{ c.name }}
          </button>
        </div>
      </div>
    </section>

    <p v-if="standingsError" class="card">Could not load {{ selected }}: {{ standingsError.statusMessage }}</p>
    <template v-else>
      <section class="card">
        <h2 style="font-size: 17px; margin-bottom: 8px">Latest results</h2>
        <NuxtLink
          v-for="m in latest" :key="m.key" :to="`/match/${m.competitionId}/${m.id}`"
          style="display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line-soft); color: var(--text); text-decoration: none"
        >
          <span>{{ m.home.shortName }} – {{ m.away.shortName }}</span>
          <span class="display num" style="font-size: 18px; white-space: nowrap">{{ formatScore(m) }}</span>
        </NuxtLink>
      </section>

      <section class="card">
        <h2 style="font-size: 17px; margin-bottom: 8px">Standings</h2>
        <div v-for="r in standings?.rows" :key="r.teamKey" class="num" style="display: grid; grid-template-columns: 28px 1fr 40px 48px; padding: 6px 0; border-top: 1px solid var(--line-soft); font-size: 14px">
          <span class="muted">{{ r.rank }}</span><span>{{ r.name }}</span><span class="muted">{{ r.played }}</span><span style="text-align: right; font-weight: 600">{{ r.points }}</span>
        </div>
      </section>
    </template>
  </main>
</template>
