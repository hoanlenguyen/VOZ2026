<script setup lang="ts">
// Phase 0 status page: proves the data layer works end to end. Replaced by My feed in Phase 5.
const [{ data: health }, { data: standings }, { data: games }] = await Promise.all([
  useFetch('/api/health'),
  useFetch('/api/standings'),
  useFetch('/api/games', { query: { state: 'ended' } }),
])
const latest = computed(() => games.value?.games.slice(-8).reverse() ?? [])
</script>

<template>
  <main>
    <header style="padding: 20px">
      <p class="display" style="color: var(--accent); font-size: 26px; letter-spacing: 0.08em; margin: 0">VOZ</p>
      <p class="muted" style="margin: 0">My Sports World · data layer status</p>
    </header>

    <section class="card">
      <h2 style="font-size: 17px">Liiga API</h2>
      <p v-if="health">
        <span class="badge" :class="{ 'badge--warn': !health.ok || health.source === 'snapshot' }">
          {{ health.ok ? `OK · ${health.source}` : 'unreachable' }}
        </span>
        <span class="muted"> mode {{ health.mode }} · key {{ health.keyConfigured ? 'set' : 'missing' }}</span>
      </p>
      <p class="muted">Season {{ standings?.season }} · {{ games?.count ?? 0 }} finished regular-season games</p>
      <NuxtLink to="/onboarding">Onboarding →</NuxtLink>
    </section>

    <section class="card">
      <h2 style="font-size: 17px; margin-bottom: 8px">Latest results</h2>
      <NuxtLink
        v-for="g in latest" :key="g.id" :to="`/match/${g.id}`"
        style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid var(--line-soft); color: var(--text); text-decoration: none"
      >
        <span>{{ g.home.name }} – {{ g.away.name }}</span>
        <span class="display num" style="font-size: 18px">{{ g.home.score }}–{{ g.away.score }}<small v-if="g.finishType !== 'regulation'" class="muted"> {{ g.finishType === 'overtime' ? 'OT' : 'SO' }}</small></span>
      </NuxtLink>
    </section>

    <section class="card">
      <h2 style="font-size: 17px; margin-bottom: 8px">Standings</h2>
      <div v-for="r in standings?.rows" :key="r.teamId" style="display: grid; grid-template-columns: 28px 1fr 40px 48px; padding: 6px 0; border-top: 1px solid var(--line-soft); font-size: 14px">
        <span class="muted">{{ r.rank }}</span><span>{{ r.name }}</span><span class="muted">{{ r.games }}</span><span style="text-align: right; font-weight: 600">{{ r.points }}</span>
      </div>
    </section>
  </main>
</template>
