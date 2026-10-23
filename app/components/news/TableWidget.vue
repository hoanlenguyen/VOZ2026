<script setup lang="ts">
import type { LandingData } from '#shared/types/stories'

const props = withDefaults(defineProps<{ table: LandingData['tables'][number], limit?: number }>(), { limit: 8 })
const rows = computed(() => props.table.rows.slice(0, props.limit))
</script>

<template>
  <section class="widget" :aria-labelledby="`table-${table.competitionId}`">
    <h2 :id="`table-${table.competitionId}`" class="widget-title">{{ table.competitionName }} table</h2>
    <table class="num">
      <thead>
        <tr><th scope="col">#</th><th scope="col">Team</th><th scope="col"><abbr title="Played">P</abbr></th><th scope="col"><abbr title="Points">Pts</abbr></th></tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.teamKey">
          <td class="rank">{{ r.rank }}</td>
          <td class="team">
            <img v-if="r.logo" :src="r.logo" alt="" width="20" height="20" loading="lazy">
            <span>{{ r.name }}</span>
          </td>
          <td>{{ r.played }}</td>
          <td class="pts">{{ r.points }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.widget { border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
.widget-title {
  margin: 0 0 8px; font-family: var(--font-display); font-size: 20px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.02em;
}
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; font-size: 12px; font-weight: 600; color: var(--muted); padding: 6px 4px; }
th:nth-child(n+3), td:nth-child(n+3) { text-align: right; width: 40px; }
td { padding: 7px 4px; border-top: 1px solid var(--line-soft); }
.rank { color: var(--muted); width: 24px; }
.team { display: flex; align-items: center; gap: 8px; min-width: 0; }
.team img { object-fit: contain; flex-shrink: 0; }
.team span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pts { font-weight: 700; }
abbr { text-decoration: none; }
</style>
