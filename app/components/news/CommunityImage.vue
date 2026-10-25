<script setup lang="ts">
// Mock picture for a community post (demo). Drawn here as SVG in the scoreboard style of
// NewsMatchVisual (board, faint line art, gold accents), never a photo from another site.
// The post's alt text describes it.
import type { CommunityImageKind } from '#shared/types/communities'

defineProps<{ kind: CommunityImageKind, alt: string }>()

// Shot map: 17 shots, the first 5 on target (filled), one goal (ringed).
const SHOTS: Array<[number, number]> = [[530, 150], [555, 190], [500, 120], [570, 220], [520, 205], [470, 170], [455, 240], [490, 95], [445, 130], [540, 255], [510, 280], [430, 200], [480, 300], [560, 110], [420, 260], [505, 160], [465, 210]]
// 3-4-2-1 from left to right: keeper, three, four, two, one.
const FORMATION: Array<[number, number]> = [[70, 180], [170, 100], [170, 180], [170, 260], [290, 60], [290, 140], [290, 220], [290, 300], [410, 130], [410, 230], [520, 180]]
</script>

<template>
  <svg class="community-image" viewBox="0 0 640 360" role="img" :aria-label="alt" preserveAspectRatio="xMidYMid slice">
    <title>{{ alt }}</title>
    <rect width="640" height="360" class="bg" />

    <!-- Stadium at night: stands, floodlights, pitch. -->
    <g v-if="kind === 'stadium'">
      <rect y="250" width="640" height="110" class="pitch" />
      <rect v-for="i in 8" :key="i" :x="(i - 1) * 80" y="250" width="40" height="110" class="stripe" />
      <path d="M0 250 L40 150 L600 150 L640 250 Z" class="stand" />
      <path d="M40 150 L80 110 L560 110 L600 150 Z" class="stand stand--upper" />
      <g v-for="i in 28" :key="`s${i}`"><circle :cx="40 + i * 20" :cy="175 + (i % 3) * 18" r="4" class="crowd" /></g>
      <g v-for="x in [60, 580]" :key="`f${x}`">
        <line :x1="x" y1="250" :x2="x" y2="40" class="mast" />
        <rect :x="x - 22" y="28" width="44" height="18" rx="3" class="lamp" />
        <path :d="`M${x - 22} 46 L${x - 110} 250 L${x + 110} 250 L${x + 22} 46 Z`" class="beam" />
      </g>
      <line x1="320" y1="250" x2="320" y2="360" class="line" />
      <ellipse cx="320" cy="305" rx="70" ry="22" class="line" />
    </g>

    <!-- Away day: coach on the road. -->
    <g v-else-if="kind === 'coach'">
      <rect y="270" width="640" height="90" class="road" />
      <line v-for="i in 7" :key="i" :x1="(i - 1) * 100 + 10" y1="318" :x2="(i - 1) * 100 + 60" y2="318" class="dash" />
      <circle cx="540" cy="80" r="34" class="moon" />
      <rect x="150" y="140" width="330" height="120" rx="18" class="coach" />
      <rect x="150" y="196" width="330" height="10" class="coach-band" />
      <rect v-for="i in 5" :key="`w${i}`" :x="166 + (i - 1) * 56" y="156" width="44" height="32" rx="5" class="window" />
      <rect x="436" y="156" width="30" height="32" rx="5" class="window" />
      <circle v-for="x in [215, 415]" :key="x" :cx="x" cy="262" r="24" class="wheel" />
      <circle v-for="x in [215, 415]" :key="`h${x}`" :cx="x" cy="262" r="9" class="hub" />
      <rect x="474" y="220" width="12" height="16" rx="3" class="lamp" />
    </g>

    <!-- Tactics board: 3-4-2-1 with movement arrows. -->
    <g v-else-if="kind === 'tactics'">
      <defs>
        <marker id="ci-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" class="arrow-head" />
        </marker>
      </defs>
      <rect x="20" y="20" width="600" height="320" rx="6" class="pitch-board" />
      <line x1="320" y1="20" x2="320" y2="340" class="line" />
      <circle cx="320" cy="180" r="48" class="line" />
      <rect x="20" y="100" width="70" height="160" class="line" />
      <rect x="550" y="100" width="70" height="160" class="line" />
      <path d="M290 60 C 360 40, 430 50, 480 80" class="arrow" marker-end="url(#ci-arrow)" />
      <path d="M290 300 C 360 320, 430 310, 480 280" class="arrow" marker-end="url(#ci-arrow)" />
      <path d="M410 130 C 450 120, 480 140, 500 160" class="arrow" marker-end="url(#ci-arrow)" />
      <circle v-for="([x, y], i) in FORMATION" :key="i" :cx="x" :cy="y" r="14" :class="i === 0 ? 'keeper' : 'player'" />
    </g>

    <!-- Shot map: attacking half, shots as dots. -->
    <g v-else-if="kind === 'shotmap'">
      <rect x="20" y="20" width="600" height="320" rx="6" class="pitch-board" />
      <line x1="20" y1="20" x2="20" y2="340" class="line" />
      <rect x="440" y="80" width="180" height="200" class="line" />
      <rect x="560" y="140" width="60" height="80" class="line" />
      <path d="M440 140 A 60 60 0 0 0 440 220" class="line" />
      <circle cx="500" cy="180" r="3" class="spot" />
      <circle v-for="([x, y], i) in SHOTS" :key="i" :cx="x" :cy="y" r="9" :class="i < 5 ? 'shot shot--on' : 'shot'" />
      <circle cx="530" cy="150" r="17" class="goal-ring" />
    </g>

    <!-- Hockey rink: power-play setup with passing lanes. -->
    <g v-else-if="kind === 'powerplay' || kind === 'rink'">
      <rect x="20" y="30" width="600" height="300" rx="90" class="ice" />
      <line x1="320" y1="30" x2="320" y2="330" class="rink-red" />
      <line x1="220" y1="30" x2="220" y2="330" class="rink-blue" />
      <line x1="420" y1="30" x2="420" y2="330" class="rink-blue" />
      <line x1="560" y1="44" x2="560" y2="316" class="rink-red rink-red--thin" />
      <circle cx="320" cy="180" r="40" class="line" />
      <circle v-for="y in [110, 250]" :key="y" cx="490" :cy="y" r="34" class="line" />
      <rect x="560" y="164" width="16" height="32" class="net" />
      <template v-if="kind === 'powerplay'">
        <path d="M455 85 L520 120 L490 250 L455 275" class="lane" />
        <path d="M455 85 L540 180" class="lane" />
        <circle v-for="([x, y], i) in [[455, 85], [520, 120], [490, 250], [455, 275], [540, 180]]" :key="i" :cx="x" :cy="y" r="13" class="player" />
        <circle cx="490" cy="250" r="22" class="goal-ring" />
      </template>
      <template v-else>
        <circle v-for="([x, y], i) in [[300, 170], [340, 190], [260, 120], [380, 240]]" :key="i" :cx="x" :cy="y" r="12" :class="i % 2 ? 'player' : 'player player--b'" />
        <circle cx="320" cy="180" r="5" class="puck" />
      </template>
    </g>
  </svg>
</template>

<style scoped>
.community-image { display: block; width: 100%; aspect-ratio: 16 / 9; border-radius: 6px; background: var(--board); }
.bg { fill: var(--board); }
.pitch, .road { fill: var(--surface-2); }
.stripe { fill: var(--board-stripe); }
.stand { fill: var(--board-line); }
.stand--upper { opacity: 0.6; }
.crowd { fill: var(--board-muted); opacity: 0.55; }
.mast { stroke: var(--board-muted); stroke-width: 4; }
.lamp, .moon { fill: var(--accent); }
.moon { opacity: 0.85; }
.beam { fill: var(--accent); opacity: 0.08; }
.line { fill: none; stroke: var(--board-line); stroke-width: 3; }
.dash { stroke: var(--accent); stroke-width: 6; stroke-linecap: round; opacity: 0.7; }
.coach { fill: var(--board-text); }
.coach-band { fill: var(--accent); }
.window { fill: var(--board); opacity: 0.85; }
.wheel { fill: var(--board); stroke: var(--board-muted); stroke-width: 4; }
.hub { fill: var(--board-muted); }
.pitch-board { fill: var(--board); stroke: var(--board-line); stroke-width: 3; }
.player { fill: var(--accent); stroke: var(--board); stroke-width: 3; }
.player--b { fill: var(--board-text); }
.keeper { fill: var(--board-text); stroke: var(--board); stroke-width: 3; }
.arrow { fill: none; stroke: var(--board-text); stroke-width: 3; stroke-dasharray: 8 6; opacity: 0.8; }
.arrow-head { fill: var(--board-text); }
.spot { fill: var(--board-line); }
.shot { fill: none; stroke: var(--board-muted); stroke-width: 3; }
.shot--on { fill: var(--accent); stroke: var(--accent); }
.goal-ring { fill: none; stroke: var(--board-text); stroke-width: 3; }
.ice { fill: var(--surface-2); stroke: var(--board-line); stroke-width: 4; }
.rink-red { stroke: var(--board-rink-red); stroke-width: 8; }
.rink-red--thin { stroke-width: 3; }
.rink-blue { stroke: var(--board-rink-blue); stroke-width: 8; }
.net { fill: none; stroke: var(--board-text); stroke-width: 3; }
.lane { fill: none; stroke: var(--board-text); stroke-width: 2; stroke-dasharray: 6 6; opacity: 0.7; }
.puck { fill: var(--board-text); }
</style>
