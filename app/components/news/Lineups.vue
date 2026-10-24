<script setup lang="ts">
// Starting line-ups drawn on the scoreboard pitch (goalkeeper at the bottom), with goal, card and
// substitution markers taken from the match timeline, then substitutes and manager.
import { PhArrowDown, PhArrowUp, PhSoccerBall } from '@phosphor-icons/vue'
import type { LineupPlayer, TeamLineup, TimelineEvent } from '#shared/types/match-detail'

const props = defineProps<{
  lineups: { home: TeamLineup, away: TeamLineup }
  teams: { home: { name: string, logo: string | null }, away: { name: string, logo: string | null } }
  timeline: TimelineEvent[]
}>()

const { t } = useI18n()

interface Marks { goals: number, yellow: boolean, red: boolean, off: string | null, on: string | null }

// Markers per player name, from the official events in the timeline.
const marks = computed(() => {
  const m = new Map<string, Marks>()
  const get = (name: string) => m.get(name) ?? m.set(name, { goals: 0, yellow: false, red: false, off: null, on: null }).get(name)!
  for (const e of props.timeline) {
    if (!e.player) continue
    if (e.kind === 'goal' && e.goalType !== 'own') get(e.player).goals++
    if (e.kind === 'yellow') get(e.player).yellow = true
    if (e.kind === 'red') get(e.player).red = true
    if (e.kind === 'sub') {
      get(e.player).on = e.minute
      if (e.playerOff) get(e.playerOff).off = e.minute
    }
  }
  return m
})

/** Pitch label: surname for two-part names, the first name for longer ones ("Murillo", "Florentino"). */
const shortName = (name: string) => {
  const parts = name.split(' ')
  return parts.length <= 2 ? parts.at(-1)! : parts[0]!
}
const byName = (l: TeamLineup) => new Map(l.starters.map(p => [p.name, p]))
// Forwards at the top, goalkeeper at the bottom.
const pitchRows = (l: TeamLineup) => [...l.rows].reverse()
const sides = ['home', 'away'] as const
const playerLabel = (p: LineupPlayer | undefined, name: string) =>
  [p?.number != null ? `${p.number}` : null, name, p?.captain ? t('lineups.captain') : null].filter(Boolean).join(', ')
</script>

<template>
  <div class="lineups">
    <section v-for="side in sides" :key="side" class="team" :aria-labelledby="`lineup-${side}`">
      <header class="team-head">
        <img v-if="teams[side].logo" :src="teams[side].logo!" alt="" width="28" height="28">
        <h3 :id="`lineup-${side}`" class="team-name">{{ teams[side].name }}</h3>
        <span v-if="lineups[side].formation" class="formation num">{{ lineups[side].formation }}</span>
      </header>

      <div class="pitch" role="img" :aria-label="t('lineups.starting', { team: teams[side].name, formation: lineups[side].formation ?? '', players: lineups[side].starters.map(p => p.name).join(', ') })">
        <svg class="lines" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true">
          <rect x="4" y="4" width="92" height="112" />
          <line x1="4" y1="4" x2="96" y2="4" />
          <path d="M30 116 v-18 h40 v18 M40 116 v-7 h20 v7" />
          <path d="M38 98 a12 10 0 0 1 24 0" />
          <path d="M30 4 a20 14 0 0 0 40 0" />
        </svg>
        <div class="rows" aria-hidden="true">
          <div v-for="(row, ri) in pitchRows(lineups[side])" :key="ri" class="row">
            <div v-for="name in row" :key="name" class="player" :title="name">
              <span class="disc num" :class="{ 'disc--gk': ri === pitchRows(lineups[side]).length - 1 }">
                {{ byName(lineups[side]).get(name)?.number ?? '' }}
                <span v-if="byName(lineups[side]).get(name)?.captain" class="captain">C</span>
                <span v-if="marks.get(name)?.goals" class="mark mark--goal"><PhSoccerBall :size="12" weight="fill" /></span>
                <span v-if="marks.get(name)?.yellow || marks.get(name)?.red" class="mark mark--card" :class="{ 'mark--red': marks.get(name)?.red }" />
                <span v-if="marks.get(name)?.off" class="mark mark--off"><PhArrowDown :size="10" weight="bold" /></span>
              </span>
              <span class="pname">{{ shortName(name) }}</span>
            </div>
          </div>
        </div>
      </div>

      <h4 class="sub-title">{{ t('lineups.subs') }}</h4>
      <ul class="subs">
        <li v-for="p in lineups[side].substitutes" :key="p.name" class="sub" :class="{ 'sub--used': marks.get(p.name)?.on }">
          <span class="sub-num num">{{ p.number ?? '' }}</span>
          <span class="sub-name">{{ p.name }}</span>
          <span v-if="marks.get(p.name)?.on" class="sub-on num"><PhArrowUp :size="12" weight="bold" aria-hidden="true" /><span class="sr-only">{{ t('lineups.cameOn') }} </span>{{ marks.get(p.name)?.on }}</span>
          <span v-else class="sub-pos">{{ p.position }}</span>
        </li>
      </ul>
      <p v-if="lineups[side].manager" class="manager"><span>{{ t('lineups.manager') }}</span> {{ lineups[side].manager }}</p>
      <ul class="sr-only">
        <li v-for="p in lineups[side].starters" :key="p.name">{{ playerLabel(p, p.name) }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.lineups { display: grid; gap: 30px; }
@media (min-width: 640px) { .lineups { grid-template-columns: 1fr 1fr; } }
.team-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.team-head img { object-fit: contain; }
.team-name { margin: 0; flex: 1 1 auto; font-size: 17px; font-weight: 700; color: var(--headline); }
.formation { font-size: 13px; font-weight: 700; padding: 2px 10px; border-radius: 999px; background: var(--surface); color: var(--headline); }

.pitch { position: relative; aspect-ratio: 100 / 120; border-radius: 6px; overflow: hidden; background: var(--board); }
.lines { position: absolute; inset: 0; width: 100%; height: 100%; }
.lines * { fill: none; stroke: var(--board-line); stroke-width: 1; vector-effect: non-scaling-stroke; }
.rows { position: absolute; inset: 6% 2% 4%; display: flex; flex-direction: column; justify-content: space-between; }
.row { display: flex; justify-content: space-evenly; }
.player { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 22%; min-width: 0; }
.disc {
  position: relative; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
  background: var(--board-text); color: var(--board); font-size: 13px; font-weight: 700;
}
.disc--gk { background: var(--accent); color: var(--on-accent); }
.pname { max-width: 100%; font-size: 12px; font-weight: 600; color: var(--board-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.captain { position: absolute; left: -6px; top: -4px; width: 16px; height: 16px; border-radius: 50%; display: grid; place-items: center; font-size: 9px; background: var(--accent); color: var(--on-accent); border: 1px solid var(--board); }
.mark { position: absolute; display: grid; place-items: center; }
.mark--goal { right: -7px; top: -5px; width: 16px; height: 16px; border-radius: 50%; background: var(--bg); color: var(--headline); }
.mark--card { right: -5px; bottom: -3px; width: 9px; height: 12px; border-radius: 2px; background: var(--card-yellow); border: 1px solid var(--card-edge); }
.mark--red { background: var(--card-red); }
.mark--off { left: -6px; bottom: -4px; width: 15px; height: 15px; border-radius: 50%; background: var(--card-red); color: var(--board-text); }

.sub-title { margin: 16px 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.subs { list-style: none; margin: 0; padding: 0; }
.sub { display: grid; grid-template-columns: 28px 1fr auto; gap: 8px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); font-size: 14px; color: var(--summary); }
.sub--used { color: var(--headline); }
.sub-num { font-weight: 700; color: var(--meta); text-align: right; }
.sub-pos { font-size: 12px; color: var(--meta); }
.sub-on { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; font-weight: 700; color: var(--headline); }
.manager { margin: 10px 0 0; font-size: 14px; color: var(--headline); }
.manager span { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); margin-right: 6px; }
</style>
