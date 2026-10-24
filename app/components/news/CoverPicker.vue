<script setup lang="ts">
// Cover image of a match: shows what readers see now (the newsroom's image, or the match graphic
// drawn from data) and replaces it with an upload (JPEG, PNG, WebP up to 2 MB; stored right away in
// the newsroom image store), with alt text (required) and credit. Only images VOZ has rights to.
import { PhArrowCounterClockwise, PhUploadSimple } from '@phosphor-icons/vue'
import type { Story, StoryCover } from '#shared/types/stories'

defineProps<{ graphic: Pick<Story, 'competitionName' | 'match'> }>()
const cover = defineModel<StoryCover | null>({ required: true })
const { t } = useI18n()
const input = ref<HTMLInputElement>()
const busy = ref(false)
const error = ref('')
const MAX = 2 * 1024 * 1024

async function upload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  if (file.size > MAX) {
    error.value = t('editor.cover.tooLarge')
    return
  }
  busy.value = true
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await $fetch<{ id: string }>('/api/newsroom/images', { method: 'POST', body })
    cover.value = { id: res.id, alt: cover.value?.alt ?? '', credit: cover.value?.credit ?? '' }
  }
  catch (err) {
    error.value = t('editor.cover.uploadError', { reason: (err as { statusMessage?: string }).statusMessage ?? '' })
  }
  finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}
</script>

<template>
  <div class="cover">
    <span class="label">{{ t('editor.cover.title') }}</span>
    <p class="hint">{{ t('editor.cover.hint') }}</p>

    <div class="picked">
      <div class="current">
        <img v-if="cover" :src="`/api/images/${cover.id}`" :alt="cover.alt" class="thumb">
        <NewsMatchVisual v-else :story="graphic" size="md" />
        <p class="caption">{{ cover ? t('editor.cover.custom') : t('editor.cover.graphic') }}</p>
      </div>
      <div class="fields">
        <template v-if="cover">
          <label for="cover-alt">{{ t('editor.cover.alt') }}</label>
          <input id="cover-alt" v-model="cover.alt" type="text" maxlength="200" required aria-describedby="cover-alt-hint">
          <p id="cover-alt-hint" class="hint">{{ t('editor.cover.altHint') }}</p>
          <label for="cover-credit">{{ t('editor.cover.credit') }}</label>
          <input id="cover-credit" v-model="cover.credit" type="text" maxlength="120" :placeholder="t('editor.cover.creditPlaceholder')">
        </template>
        <div class="actions">
          <button type="button" class="btn btn--main" :disabled="busy" @click="input?.click()">
            <PhUploadSimple :size="16" weight="bold" aria-hidden="true" />
            {{ busy ? t('editor.cover.uploading') : t('editor.cover.replace') }}
          </button>
          <button v-if="cover" type="button" class="btn" @click="cover = null">
            <PhArrowCounterClockwise :size="16" weight="bold" aria-hidden="true" /> {{ t('editor.cover.useGraphic') }}
          </button>
        </div>
        <p class="hint">{{ t('editor.cover.formats') }}</p>
      </div>
    </div>
    <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" tabindex="-1" aria-hidden="true" @change="upload">
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.cover { margin-top: 18px; display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 14px; font-weight: 700; color: var(--headline); }
.hint { margin: 0; font-size: 13px; color: var(--meta); }
.picked { display: grid; gap: 16px; margin-top: 6px; }
@media (min-width: 640px) { .picked { grid-template-columns: 320px minmax(0, 1fr); align-items: start; } }
.current { min-width: 0; }
.caption { margin: 6px 0 0; font-size: 12px; color: var(--meta); }
.btn--main { background: var(--headline); border-color: var(--headline); color: var(--bg); }
.btn--main:hover { background: var(--link-hover); border-color: var(--link-hover); }
.thumb { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 4px; background: var(--surface); }
.fields { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.fields label { font-size: 13px; font-weight: 700; color: var(--headline); }
.fields input {
  min-height: 44px; padding: 0 12px; border: 1px solid var(--border-control); border-radius: 4px;
  background: var(--bg); color: var(--headline); font: inherit; font-size: 15px;
}
.fields input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.actions { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 8px; }
.btn {
  min-height: 40px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
  border: 1px solid var(--border-control); background: var(--bg); color: var(--headline); font-size: 14px; font-weight: 600;
}
.btn:hover { background: var(--surface); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn:disabled { opacity: 0.6; cursor: progress; }
.error { margin: 4px 0 0; font-size: 14px; font-weight: 600; color: var(--loss); }
</style>
