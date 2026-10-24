<script setup lang="ts">
// Live-blog style commentary feed, newest entry first. "Replay live" streams the entries in one
// by one with a running score, as if the match were on now.
import { PhCrosshair, PhFlag, PhFlagPennant, PhHandPalm, PhPause, PhPlay, PhSkipForward, PhSoccerBall, PhTimer } from '@phosphor-icons/vue'
import type { Component } from 'vue'
import type { CommentaryEntry, CommentaryKind, MatchCommentary } from '#shared/types/commentary'

type Side = { name: string, logo: string | null }
const props = defineProps<{ commentary: MatchCommentary, home: Side, away: Side }>()

const STEP_MS = 1600
const entries = computed(() => props.commentary.entries)
const shown = ref(entries.value.length)
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const visible = computed(() => entries.value.slice(0, shown.value).reverse())
const latest = computed(() => entries.value[shown.value - 1])
const score = computed(() => entries.value.slice(0, shown.value).filter(e => e.score).at(-1)?.score ?? { home: 0, away: 0 })
const finished = computed(() => shown.value === entries.value.length)
const started = computed(() => shown.value > 0)

const clock = (e: CommentaryEntry) => (e.added ? `${e.minute}+${e.added}'` : `${e.minute}'`)
const status = computed(() => {
  if (finished.value) return 'FT'
  if (!latest.value) return 'Kick-off soon'
  return latest.value.kind === 'half-time' ? 'HT' : clock(latest.value)
})

function stop() {
  if (timer) clearInterval(timer)
  timer = null
  playing.value = false
}
function play() {
  if (finished.value) shown.value = 0
  playing.value = true
  timer = setInterval(() => {
    shown.value++
    if (finished.value) stop()
  }, STEP_MS)
}
function skip() {
  stop()
  shown.value = entries.value.length
}
onBeforeUnmount(stop)

const ICONS: Partial<Record<CommentaryKind, Component>> = {
  'kick-off': PhTimer,
  'half-time': PhTimer,
  'full-time': PhTimer,
  'chance': PhCrosshair,
  'save': PhHandPalm,
  'corner': PhFlagPennant,
  'offside': PhFlag,
  'goal': PhSoccerBall,
}
const KIND_LABEL: Record<CommentaryKind, string> = {
  'kick-off': 'Kick-off',
  'half-time': 'Half-time',
  'full-time': 'Full-time',
  'chance': 'Chance',
  'save': 'Save',
  'corner': 'Corner',
  'offside': 'Offside',
  'card': 'Yellow card',
  'goal': 'Goal',
}
const team = (e: CommentaryEntry) => (e.side ? (e.side === 'home' ? props.home : props.away) : null)
</script>

<template>
  <div class="live">
    <p v-if="commentary.sample" class="disclaimer">
      <span class="sample">Sample</span>
      Commentary written for this demo, not a real match report.
    </p>

    <div class="board">
      <div class="score num" :aria-label="`${home.name} ${score.home}, ${away.name} ${score.away}, ${status}`">
        <span class="team">
          <img v-if="home.logo" :src="home.logo" alt="" width="24" height="24">
          <span class="team-name">{{ home.name }}</span>
        </span>
        <span class="result">{{ score.home }}–{{ score.away }}</span>
        <span class="team team--away">
          <span class="team-name">{{ away.name }}</span>
          <img v-if="away.logo" :src="away.logo" alt="" width="24" height="24">
        </span>
      </div>
      <div class="controls">
        <span class="status num" :class="{ 'status--live': playing || (started && !finished) }">
          <span v-if="playing" class="dot" aria-hidden="true" />{{ playing || (started && !finished) ? 'Live' : '' }} {{ status }}
        </span>
        <button v-if="!playing" type="button" class="btn" @click="play">
          <PhPlay :size="14" weight="fill" aria-hidden="true" />
          {{ finished ? 'Replay live' : 'Resume' }}
        </button>
        <button v-else type="button" class="btn" @click="stop">
          <PhPause :size="14" weight="fill" aria-hidden="true" />
          Pause
        </button>
        <button v-if="!finished" type="button" class="btn btn--quiet" @click="skip">
          <PhSkipForward :size="14" weight="fill" aria-hidden="true" />
          Full-time
        </button>
      </div>
    </div>

    <p class="sr-only" aria-live="polite">{{ playing && latest ? `${clock(latest)} ${latest.text}` : '' }}</p>

    <ol class="feed" aria-label="Commentary, newest first">
      <TransitionGroup name="entry">
        <li
          v-for="e in visible" :key="e.id" class="entry"
          :class="[`entry--${e.kind}`, { 'entry--marker': e.kind === 'kick-off' || e.kind === 'half-time' || e.kind === 'full-time' }]"
        >
          <span class="minute num">{{ clock(e) }}</span>
          <span class="icon" :title="KIND_LABEL[e.kind]">
            <span v-if="e.kind === 'card'" class="card-icon" aria-hidden="true" />
            <component :is="ICONS[e.kind]" v-else :size="16" weight="bold" aria-hidden="true" />
            <span class="sr-only">{{ KIND_LABEL[e.kind] }}</span>
          </span>
          <div class="body">
            <p class="text">{{ e.text }}</p>
            <p v-if="e.score" class="goal-line num">
              <img v-if="team(e)?.logo" :src="team(e)!.logo!" alt="" width="18" height="18">
              {{ home.name }} {{ e.score.home }}–{{ e.score.away }} {{ away.name }}
            </p>
          </div>
        </li>
      </TransitionGroup>
      <li v-if="!started" class="entry entry--marker entry--waiting">
        <span class="minute" />
        <span class="icon"><PhTimer :size="16" weight="bold" aria-hidden="true" /></span>
        <div class="body"><p class="text">Kick-off is coming up.</p></div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.disclaimer {
  margin: 0 0 16px; display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;
  font-size: 13px; color: var(--meta); text-align: center;
}
.sample {
  font-size: 10px; line-height: 16px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 0 6px; border: 1px solid var(--border-control); border-radius: 999px; color: var(--summary);
}

.board { border: 1px solid var(--line-strong); border-radius: 4px; padding: 14px 16px; display: grid; gap: 12px; }
.score { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; }
.team { display: inline-flex; align-items: center; gap: 8px; min-width: 0; font-weight: 700; color: var(--headline); }
.team--away { justify-content: flex-end; }
.team img { object-fit: contain; flex-shrink: 0; }
.team-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result { font-family: var(--font-display); font-size: 36px; line-height: 1; font-weight: 700; color: var(--headline); }

.controls { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
.status {
  min-width: 72px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta);
}
.status--live { color: var(--loss); }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--loss); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.3; } }
.btn {
  min-height: 44px; padding: 0 16px; display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--border-control); border-radius: 999px; background: var(--bg); color: var(--headline);
  font-size: 13px; font-weight: 700; transition: background-color var(--dur-fast) var(--ease-out);
}
.btn:hover { background: var(--surface); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn--quiet { border-color: transparent; color: var(--summary); }

.feed { list-style: none; margin: 16px 0 0; padding: 0; }
.entry {
  display: grid; grid-template-columns: 52px 32px 1fr; gap: 10px; align-items: start;
  padding: 14px 0; border-bottom: 1px solid var(--line);
}
.entry:last-child { border-bottom: 0; }
.minute { padding-top: 6px; font-size: 14px; font-weight: 700; color: var(--headline); }
.icon {
  width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
  background: var(--surface); color: var(--summary);
}
.card-icon { width: 10px; height: 14px; border-radius: 2px; background: var(--accent); }
.body { min-width: 0; padding-top: 5px; }
.text { margin: 0; font-size: 15px; line-height: 1.5; color: var(--headline); }
.goal-line { margin: 8px 0 0; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--headline); }
.goal-line img { object-fit: contain; }

.entry--goal { margin: 0 -10px; padding-left: 7px; padding-right: 10px; background: var(--surface); border-left: 3px solid var(--stat-lead); }
.entry--goal .icon { background: var(--stat-lead); color: var(--board-text); }
.entry--goal .text { font-weight: 700; }
.entry--marker .text { font-weight: 700; text-transform: uppercase; font-size: 13px; letter-spacing: 0.04em; padding-top: 2px; }
.entry--waiting .text { color: var(--meta); text-transform: none; font-weight: 400; }

.entry-enter-active { transition: opacity var(--dur) var(--ease-out), transform var(--dur) var(--ease-out); }
.entry-enter-from { opacity: 0; transform: translateY(-8px); }
.entry-move { transition: transform var(--dur) var(--ease-out); }

@media (prefers-reduced-motion: reduce) {
  .dot { animation: none; }
  .entry-enter-active, .entry-move { transition: none; }
}
@media (max-width: 479px) {
  .entry { grid-template-columns: 44px 28px 1fr; gap: 8px; }
  .icon { width: 28px; height: 28px; }
  .result { font-size: 28px; }
}
</style>
