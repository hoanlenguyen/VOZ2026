<script setup lang="ts">
// Which AI version readers get: length and perspective (the newsroom editor publishes one).
import type { StoryLength, StoryTone } from '#shared/types/story'

const props = defineProps<{ home: string, away: string }>()
const length = defineModel<StoryLength>('length', { required: true })
const tone = defineModel<StoryTone>('tone', { required: true })
const { t } = useI18n()
const LENGTHS: StoryLength[] = ['short', 'standard', 'long']
const tones = computed<Array<{ id: StoryTone, label: string }>>(() => [
  { id: 'neutral', label: t('editor.format.tones.neutral') },
  { id: 'home-fan', label: t('editor.format.tones.fans', { team: props.home }) },
  { id: 'away-fan', label: t('editor.format.tones.fans', { team: props.away }) },
  { id: 'analyst', label: t('editor.format.tones.analyst') },
])
</script>

<template>
  <div class="format">
    <fieldset class="seg">
      <legend class="seg-label">{{ t('editor.format.length') }}</legend>
      <label v-for="l in LENGTHS" :key="l" class="seg-option">
        <input v-model="length" type="radio" name="story-length" :value="l">
        <span>{{ t(`editor.format.lengths.${l}`) }}</span>
      </label>
    </fieldset>
    <fieldset class="seg">
      <legend class="seg-label">{{ t('editor.format.tone') }}</legend>
      <label v-for="o in tones" :key="o.id" class="seg-option">
        <input v-model="tone" type="radio" name="story-tone" :value="o.id">
        <span>{{ o.label }}</span>
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.format { display: flex; flex-direction: column; gap: 12px; }
.seg { border: 0; margin: 0; padding: 0; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.seg-label { float: left; min-width: 96px; margin-right: 8px; padding: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.seg-option { position: relative; }
.seg-option input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.seg-option span {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 14px; border-radius: 999px;
  border: 1px solid var(--line-strong); background: var(--bg); font-size: 14px; font-weight: 600; color: var(--summary);
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.seg-option:hover span { border-color: var(--border-control); color: var(--headline); }
.seg-option input:checked + span { background: var(--headline); border-color: var(--headline); color: var(--bg); }
.seg-option input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
