<script setup lang="ts">
// The VOZ mark (also public/favicon.svg): a gold arm (your team) crossing a blue arm (the opponent)
// into one point, with the ball between them. Drawn with the colour tokens; decorative.
withDefaults(defineProps<{ size?: number }>(), { size: 36 })
</script>

<template>
  <svg class="mark" :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect width="64" height="64" rx="14" class="bg" />
    <path d="M43 14h11L37.5 52h-11z" class="away" />
    <path d="M10 14h11l16.5 38h-11z" class="home" />
    <circle cx="32" cy="19.5" r="4.6" class="ball" />
  </svg>
</template>

<style scoped>
.mark { display: block; flex: 0 0 auto; }
.bg { fill: var(--board); }
.away { fill: var(--away); }
.home { fill: var(--accent); }
.ball { fill: var(--board-text); }
</style>
