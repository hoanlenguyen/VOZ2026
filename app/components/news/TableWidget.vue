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
.widget { border: 1px solid var(--line-soft); border-radius: 4px; padding: 24px; }
.widget-title { margin: 0 0 16px; font-size: 20px; line-height: 24px; font-weight: 700; color: var(--headline); }
.widget-title::before {
  content: '#'; margin-right: 4px; background: var(--section-bar);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--meta); padding: 0 4px 8px; }
th:nth-child(n+3), td:nth-child(n+3) { text-align: right; width: 40px; }
td { padding: 8px 4px; border-top: 1px solid var(--line); color: var(--headline); }
.rank { color: var(--meta) !important; width: 24px; }
.team { display: flex; align-items: center; gap: 8px; min-width: 0; }
.team img { object-fit: contain; flex-shrink: 0; }
.team span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pts { font-weight: 700; }
abbr { text-decoration: none; }
</style>
