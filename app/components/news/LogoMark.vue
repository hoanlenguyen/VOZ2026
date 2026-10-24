<script setup lang="ts">
// The VOZ mark (also public/favicon.svg): "voz" is voice, so a gold speech bubble with the V cut
// out, on the dark scoreboard square. Drawn with the colour tokens; decorative.
withDefaults(defineProps<{ size?: number }>(), { size: 36 })
</script>

<template>
  <svg class="mark" :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect width="64" height="64" rx="14" class="bg" />
    <path d="M15 8h34a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H28l-11 8.5V48h-2a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8z" class="bubble" />
    <path d="M18.5 15.5h9.2L32 30l4.3-14.5h9.2L36.6 40h-9.2z" class="bg" />
  </svg>
</template>

<style scoped>
.mark { display: block; flex: 0 0 auto; }
.bg { fill: var(--board); }
.bubble { fill: var(--accent); }
</style>
