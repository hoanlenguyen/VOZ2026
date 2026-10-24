<script setup lang="ts">
import type { LandingData } from '#shared/types/stories'

// `highlight`: team keys to mark (the match page marks its two teams).
const props = withDefaults(defineProps<{ table: LandingData['tables'][number], limit?: number, highlight?: string[] }>(), { limit: 8, highlight: () => [] })
const rows = computed(() => props.table.rows.slice(0, props.limit))
const { t } = useI18n()
</script>

<template>
  <section class="widget" :aria-labelledby="`table-${table.competitionId}`">
    <h2 :id="`table-${table.competitionId}`" class="widget-title">{{ t('table.title', { league: table.competitionName }) }}</h2>
    <table class="num">
      <thead>
        <tr><th scope="col">#</th><th scope="col">{{ t('table.team') }}</th><th scope="col"><abbr :title="t('table.played')">{{ t('table.playedShort') }}</abbr></th><th scope="col"><abbr :title="t('table.points')">{{ t('table.pointsShort') }}</abbr></th></tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.teamKey" :class="{ 'row--on': highlight.includes(r.teamKey) }" :aria-current="highlight.includes(r.teamKey) ? 'true' : undefined">
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
.row--on td { background: var(--surface); font-weight: 700; }
.row--on td:first-child { box-shadow: inset 3px 0 0 var(--accent); }
abbr { text-decoration: none; }
</style>
