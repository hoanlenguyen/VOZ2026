<script setup lang="ts">
// Event timeline: home events left, away events right, minute in the middle; half-time and
// full-time as dividers. "Key events" (goals, cards, subs, VAR, period ends) by default,
// "All events" adds shots, corners and offsides.
import { PhArrowsLeftRight, PhCrosshair, PhFlag, PhFlagPennant, PhMonitorPlay, PhShieldSlash, PhSoccerBall, PhXCircle } from '@phosphor-icons/vue'
import type { Component } from 'vue'
import type { TimelineEvent, TimelineKind } from '#shared/types/match-detail'

const props = defineProps<{
  events: TimelineEvent[]
  home: { name: string, logo: string | null }
  away: { name: string, logo: string | null }
}>()

const showAll = ref(false)
const visible = computed(() => props.events.filter(e => showAll.value || e.key))
const hiddenCount = computed(() => props.events.filter(e => !e.key).length)

const ICONS: Partial<Record<TimelineKind, Component>> = {
  'goal': PhSoccerBall,
  'sub': PhArrowsLeftRight,
  'var': PhMonitorPlay,
  'shot-saved': PhCrosshair,
  'shot-missed': PhXCircle,
  'shot-blocked': PhShieldSlash,
  'offside': PhFlagPennant,
  'corner': PhFlag,
}
const isPeriod = (e: TimelineEvent) => e.kind === 'half-time' || e.kind === 'full-time'
const teamName = (e: TimelineEvent) => (e.side ? props[e.side].name : '')
// One sentence per event for screen readers; the visual layout carries the same facts.
const spoken = (e: TimelineEvent) =>
  [e.minute, teamName(e), e.label, e.player, e.detail, e.score ? `score ${e.score}` : null].filter(Boolean).join(', ')
</script>

<template>
  <div class="timeline">
    <div class="toolbar">
      <div class="teams" aria-hidden="true">
        <span class="team"><img v-if="home.logo" :src="home.logo" alt="" width="20" height="20">{{ home.name }}</span>
        <span class="team team--away">{{ away.name }}<img v-if="away.logo" :src="away.logo" alt="" width="20" height="20"></span>
      </div>
      <div class="switch" role="group" aria-label="Events shown">
        <button type="button" :aria-pressed="!showAll" @click="showAll = false">Key events</button>
        <button type="button" :aria-pressed="showAll" @click="showAll = true">All events<span class="count num"> +{{ hiddenCount }}</span></button>
      </div>
    </div>

    <ol class="events">
      <li v-for="e in visible" :key="e.id" class="event" :class="[`event--${e.side ?? 'none'}`, { 'event--period': isPeriod(e), 'event--minor': !e.key }]">
        <span class="sr-only">{{ spoken(e) }}</span>
        <template v-if="isPeriod(e)">
          <span class="period" aria-hidden="true"><span class="period-label">{{ e.label }}</span><span class="period-score num">{{ e.score }}</span></span>
        </template>
        <template v-else>
          <span class="minute num" aria-hidden="true">{{ e.minute }}</span>
          <span class="body" aria-hidden="true">
            <span class="icon" :class="`icon--${e.kind}`">
              <span v-if="e.kind === 'yellow' || e.kind === 'red'" class="booking" :class="`booking--${e.kind}`" />
              <component :is="ICONS[e.kind]" v-else-if="ICONS[e.kind]" :size="16" :weight="e.kind === 'goal' ? 'fill' : 'bold'" />
            </span>
            <span class="text">
              <span class="label">{{ e.label }}<span v-if="e.score" class="score num">{{ e.score }}</span></span>
              <span v-if="e.player" class="player">{{ e.player }}</span>
              <span v-if="e.detail" class="detail">{{ e.detail }}</span>
            </span>
          </span>
        </template>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.teams { flex: 1 1 280px; display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: var(--headline); }
.team { display: inline-flex; align-items: center; gap: 6px; }
.team img { object-fit: contain; }
.switch { display: inline-flex; padding: 3px; border-radius: 999px; background: var(--surface); }
.switch button {
  min-height: 36px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent;
  font-size: 13px; font-weight: 600; color: var(--meta); position: relative;
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}
.switch button::after { content: ''; position: absolute; inset: -4px 0; } /* 44px hit area */
.switch button[aria-pressed="true"] { background: var(--bg); color: var(--headline); box-shadow: 0 1px 3px rgb(17 18 20 / 0.12); }
.count { color: var(--meta); font-weight: 500; }

.events { list-style: none; margin: 0; padding: 0; position: relative; }
/* centre spine */
.events::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: var(--line-strong); }
.event { position: relative; display: grid; grid-template-columns: 1fr 52px 1fr; align-items: center; min-height: 48px; padding: 4px 0; }
.minute {
  grid-column: 2; grid-row: 1; justify-self: center; z-index: 1; min-width: 40px; padding: 2px 6px; border-radius: 999px;
  background: var(--bg); border: 1px solid var(--line-strong); font-size: 12px; font-weight: 700; text-align: center; color: var(--headline);
}
.body { grid-row: 1; display: flex; align-items: center; gap: 10px; min-width: 0; }
.event--home .body { grid-column: 1; flex-direction: row-reverse; text-align: right; }
.event--away .body { grid-column: 3; }
.text { display: flex; flex-direction: column; min-width: 0; }
.label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta); display: inline-flex; gap: 6px; align-items: center; }
.event--home .label { justify-content: flex-end; }
.player { font-size: 15px; font-weight: 600; color: var(--headline); }
.detail { font-size: 12px; color: var(--meta); }
.score { font-size: 12px; letter-spacing: 0; padding: 0 6px; border-radius: 4px; background: var(--headline); color: var(--bg); }
.icon { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); color: var(--headline); }
.icon--goal { background: var(--headline); color: var(--bg); }
.booking { width: 11px; height: 15px; border-radius: 2px; border: 1px solid var(--card-edge); }
.booking--yellow { background: var(--card-yellow); }
.booking--red { background: var(--card-red); }

.event--minor .player { font-size: 14px; font-weight: 500; color: var(--summary); }
.event--minor .icon { width: 26px; height: 26px; color: var(--meta); }

.event--period { grid-template-columns: 1fr; padding: 10px 0; }
.period { justify-self: center; z-index: 1; display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line-strong); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--headline); }
.period-score { font-size: 14px; letter-spacing: 0; }

/* Phones: one column, minute on the left, side shown by alignment colour bar */
@media (max-width: 559px) {
  .events::before { left: 26px; }
  .event { grid-template-columns: 52px 1fr; }
  .minute { grid-column: 1; }
  .event--home .body, .event--away .body { grid-column: 2; flex-direction: row; text-align: left; }
  .event--home .label { justify-content: flex-start; }
  .event--home .body { box-shadow: inset 3px 0 0 var(--headline); padding-left: 8px; }
  .event--away .body { box-shadow: inset 3px 0 0 var(--line-strong); padding-left: 8px; }
  .event--period { grid-template-columns: 1fr; }
}
</style>
