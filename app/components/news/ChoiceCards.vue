<script setup lang="ts" generic="T extends string">
// Radio group drawn as cards (icon, label, one line of help), for the newsroom editor's choices.
import type { Component } from 'vue'

defineProps<{ legend: string, name: string, options: ReadonlyArray<{ value: T, icon: Component, label: string, text: string }> }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <fieldset class="choices" :style="{ '--cols': options.length }">
    <legend class="legend">{{ legend }}</legend>
    <label v-for="o in options" :key="o.value" class="option" :class="{ 'option--on': model === o.value }">
      <input v-model="model" type="radio" :name="name" :value="o.value" class="sr-only">
      <component :is="o.icon" :size="22" weight="bold" aria-hidden="true" class="option-icon" />
      <span class="option-text">
        <strong>{{ o.label }}</strong>
        <span>{{ o.text }}</span>
      </span>
    </label>
  </fieldset>
</template>

<style scoped>
.choices { margin: 0; padding: 0; border: 0; min-width: 0; display: grid; gap: 10px; }
@media (min-width: 640px) { .choices { grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); } }
.legend { margin: 18px 0 10px; padding: 0; font-size: 14px; font-weight: 700; color: var(--headline); }
.option {
  display: flex; gap: 12px; align-items: flex-start; padding: 14px; cursor: pointer;
  border: 1px solid var(--line-strong); border-radius: 4px; background: var(--bg);
  transition: border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}
.option:hover { border-color: var(--border-control); }
.option--on { border: 2px solid var(--headline); padding: 13px; background: var(--surface); }
.option:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.option-icon { flex: 0 0 auto; color: var(--headline); margin-top: 1px; }
.option-text { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--summary); }
.option-text strong { font-size: 15px; color: var(--headline); }
</style>
