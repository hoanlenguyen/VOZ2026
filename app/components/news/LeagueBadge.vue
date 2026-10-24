<script setup lang="ts">
// League emblem, or a monogram on the VOZ scoreboard colours when the provider has no official emblem.
withDefaults(defineProps<{ name: string, emblem: string | null, size?: number }>(), { size: 32 })
const monogram = (name: string) => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
</script>

<template>
  <span class="badge" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">
    <img v-if="emblem" :src="emblem" alt="" :width="size" :height="size">
    <span v-else class="mono" :style="{ fontSize: `${Math.round(size * 0.42)}px` }">{{ monogram(name) }}</span>
  </span>
</template>

<style scoped>
.badge { flex: 0 0 auto; display: grid; place-items: center; }
.badge img { width: 100%; height: 100%; object-fit: contain; }
.mono {
  width: 100%; height: 100%; display: grid; place-items: center; border-radius: 50%;
  background: var(--board); color: var(--accent); font-family: var(--font-display); font-weight: 700; letter-spacing: 0.02em;
}
</style>
