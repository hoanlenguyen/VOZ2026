<script setup lang="ts">
withDefaults(defineProps<{ tag?: 'h1' | 'h2' | 'h3' }>(), { tag: 'h2' })
</script>

<template>
  <component :is="tag" class="block-title"><span class="bar" aria-hidden="true" /><slot /></component>
</template>

<style scoped>
.block-title {
  position: relative; margin: 0 0 20px; padding: 0 0 10px 20px; border-bottom: 1px solid var(--line-strong);
  font-family: var(--font-body); font-size: 26px; line-height: 1.2; font-weight: 700; color: var(--headline); text-transform: uppercase;
}
.bar { position: absolute; left: 5px; top: 3px; width: 5px; height: 26px; background: var(--section-bar); transform: skewX(-15deg); }
@media (min-width: 768px) {
  .block-title { font-size: 32px; }
  .bar { height: 33px; }
}
</style>
