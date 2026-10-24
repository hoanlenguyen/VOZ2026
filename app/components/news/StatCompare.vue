<script setup lang="ts">
// Two-sided stat bars: each side grows from the centre, scaled to the larger value of the row.
// The stronger side (more goals, fewer conceded, ...) gets the accent colour.
import type { CompareRow, FormResult, MatchCompare } from '#shared/types/compare'

type Side = { name: string, logo: string | null }
defineProps<{ compare: MatchCompare, home: Side, away: Side }>()

function bars(r: CompareRow) {
  const max = Math.max(r.home, r.away)
  const lead = r.better === 'none' || r.home === r.away ? null : (r.home > r.away) === (r.better === 'higher') ? 'home' : 'away'
  return {
    home: max ? (r.home / max) * 100 : 0,
    away: max ? (r.away / max) * 100 : 0,
    lead,
  }
}
const { number } = useFormat()
const fmt = (v: number, r: CompareRow) => `${number(v, { minimumFractionDigits: r.decimals, maximumFractionDigits: r.decimals })}${r.unit}`
const { t } = useI18n()
const formLabel = (r: FormResult) => t(`compare.form.${r}`)
</script>

<template>
  <div class="compare">
    <div class="teams" aria-hidden="true">
      <span class="team">
        <img v-if="home.logo" :src="home.logo" alt="" width="28" height="28">
        {{ home.name }}
      </span>
      <span class="team team--away">
        {{ away.name }}
        <img v-if="away.logo" :src="away.logo" alt="" width="28" height="28">
      </span>
    </div>

    <section v-for="g in compare.groups" :key="g.id" class="group" :aria-labelledby="`cmp-${g.id}`">
      <h3 :id="`cmp-${g.id}`" class="group-title">{{ g.title }}</h3>

      <div v-if="g.id === 'form'" class="form-row">
        <ol v-for="side in (['home', 'away'] as const)" :key="side" class="form" :class="`form--${side}`" :aria-label="t('compare.formLabel', { team: side === 'home' ? home.name : away.name })">
          <li v-for="(r, i) in compare.form[side]" :key="i" class="pill" :class="`pill--${r}`" :title="formLabel(r)">
            <span aria-hidden="true">{{ t(`compare.formLetter.${r}`) }}</span><span class="sr-only">{{ formLabel(r) }}</span>
          </li>
        </ol>
      </div>

      <ul class="rows">
        <li v-for="r in g.rows" :key="r.id" class="row">
          <p class="values num">
            <span class="value" :class="{ 'value--lead': bars(r).lead === 'home' }"><span class="sr-only">{{ home.name }}</span> {{ fmt(r.home, r) }}</span>
            <span class="label">{{ r.label }}</span>
            <span class="value" :class="{ 'value--lead': bars(r).lead === 'away' }"><span class="sr-only">{{ away.name }}</span> {{ fmt(r.away, r) }}</span>
          </p>
          <div class="track" aria-hidden="true">
            <span class="half half--home"><span class="fill" :class="{ 'fill--lead': bars(r).lead === 'home' }" :style="{ width: `${bars(r).home}%` }" /></span>
            <span class="half"><span class="fill" :class="{ 'fill--lead': bars(r).lead === 'away' }" :style="{ width: `${bars(r).away}%` }" /></span>
          </div>
        </li>
      </ul>
      <p v-if="g.note" class="note">{{ g.note }}</p>
    </section>
  </div>
</template>

<style scoped>
.teams {
  display: flex; justify-content: space-between; gap: 16px; padding-bottom: 16px; margin-bottom: 8px;
  border-bottom: 1px solid var(--line);
}
.team { display: inline-flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; color: var(--headline); min-width: 0; }
.team img { object-fit: contain; flex-shrink: 0; }

.group { padding: 20px 0; border-bottom: 1px solid var(--line); }
.group:last-child { border-bottom: 0; }
.group-title {
  margin: 0 0 14px; text-align: center; font-size: 11px; line-height: 16px; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta);
}

.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
.values { margin: 0 0 6px; display: grid; grid-template-columns: minmax(56px, auto) 1fr minmax(56px, auto); align-items: baseline; gap: 8px; }
.label { text-align: center; font-size: 13px; font-weight: 600; color: var(--headline); }
.value { font-size: 16px; color: var(--summary); white-space: nowrap; }
.value:last-child { text-align: right; }
.value--lead { font-weight: 700; color: var(--headline); }

.track { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.half { height: 8px; background: var(--line-soft); border-radius: 0 4px 4px 0; overflow: hidden; display: flex; }
.half--home { justify-content: flex-end; border-radius: 4px 0 0 4px; }
.fill { display: block; height: 100%; background: var(--stat-trail); transition: width var(--dur) var(--ease-out); }
.fill--lead { background: var(--stat-lead); }

.form-row { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.form { list-style: none; margin: 0; padding: 0; display: flex; gap: 4px; }
.form--away { justify-content: flex-end; }
.pill {
  width: 26px; height: 26px; border-radius: 4px; display: grid; place-items: center;
  font-size: 12px; font-weight: 700; color: var(--board-text);
}
.pill--W { background: var(--win); }
.pill--D { background: var(--draw); }
.pill--L { background: var(--loss); }

.note { margin: 14px 0 0; text-align: center; font-size: 13px; color: var(--meta); }

@media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
@media (max-width: 479px) {
  .values { grid-template-columns: minmax(44px, auto) 1fr minmax(44px, auto); }
  .label { font-size: 12px; }
}
</style>
