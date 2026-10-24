<script setup lang="ts">
// Newsroom story editor: rewrite a front-page story's headline and summary, write the article for
// the match page in TinyMCE, and choose who may read it. One version per language (the one the
// editor is browsing in); "Revert to automatic" brings back the generated story.
import { PhArrowSquareOut, PhCaretLeft, PhGlobeHemisphereWest, PhLockSimple } from '@phosphor-icons/vue'
import type { ArticleAudience, StoryEdit } from '#shared/types/stories'

definePageMeta({ layout: 'news', middleware: 'newsroom' })
const { t, locale } = useI18n()
const { stamp } = useFormat()
const route = useRoute()
const id = computed(() => String(route.params.id))
useHead({ title: () => t('editor.pageTitle') })

const { data, error, refresh } = await useFetch(() => `/api/newsroom/stories/${encodeURIComponent(id.value)}`, { query: { lang: locale } })

const form = reactive({ headline: '', summary: '', body: '', audience: 'everyone' as ArticleAudience })
const status = ref<'idle' | 'saving' | 'saved' | 'reverted' | 'error'>('idle')
const message = ref('')

function load() {
  const d = data.value
  if (!d) return
  form.headline = d.edit?.headline ?? d.story.headline
  form.summary = d.edit?.summary ?? d.story.summary
  form.body = d.edit?.body ?? ''
  form.audience = d.edit?.audience ?? 'everyone'
}
watch(data, load, { immediate: true })

const AUDIENCES = [
  { value: 'everyone', icon: PhGlobeHemisphereWest },
  { value: 'subscribers', icon: PhLockSimple },
] as const

async function publish() {
  status.value = 'saving'
  try {
    const res = await $fetch<{ edit: StoryEdit }>(`/api/newsroom/stories/${encodeURIComponent(id.value)}`, {
      method: 'PUT', query: { lang: locale.value }, body: { ...form },
    })
    if (data.value) data.value.edit = res.edit
    status.value = 'saved'
  }
  catch (err) {
    status.value = 'error'
    message.value = (err as { statusMessage?: string }).statusMessage ?? ''
  }
}

async function revert() {
  status.value = 'saving'
  try {
    await $fetch(`/api/newsroom/stories/${encodeURIComponent(id.value)}`, { method: 'DELETE', query: { lang: locale.value } })
    await refresh()
    load()
    status.value = 'reverted'
  }
  catch (err) {
    status.value = 'error'
    message.value = (err as { statusMessage?: string }).statusMessage ?? ''
  }
}
</script>

<template>
  <main id="main" class="wrap">
    <NuxtLink to="/newsroom" class="back">
      <PhCaretLeft :size="14" weight="bold" aria-hidden="true" />
      {{ t('editor.back') }}
    </NuxtLink>

    <p v-if="error" class="notice" role="alert">{{ t('editor.loadError', { reason: error.statusMessage }) }}</p>

    <template v-else-if="data">
      <p class="kicker">
        <span>{{ data.story.competitionName }}</span><span aria-hidden="true">·</span>
        <span>{{ t(`story.${data.story.kind}`) }}</span><span aria-hidden="true">·</span>
        <span class="num">{{ stamp(data.story.time) }}</span>
      </p>
      <h1 class="title">{{ t('editor.title') }}</h1>
      <p class="lead">
        {{ t('editor.language', { lang: t(`editor.langName.${locale}`) }) }}
        <template v-if="data.edit"> {{ t('editor.lastSaved', { name: data.edit.by, time: stamp(data.edit.at) }) }}</template>
        <template v-else> {{ t('editor.automatic') }}</template>
      </p>

      <form class="form" @submit.prevent="publish">
        <label for="ed-headline">{{ t('editor.headline') }}</label>
        <input id="ed-headline" v-model="form.headline" type="text" maxlength="160" required>

        <label for="ed-summary">{{ t('editor.summary') }}</label>
        <p id="ed-summary-hint" class="hint">{{ t('editor.summaryHint') }}</p>
        <textarea id="ed-summary" v-model="form.summary" rows="4" maxlength="600" aria-describedby="ed-summary-hint" />

        <span class="label">{{ t('editor.body') }}</span>
        <p class="hint">{{ t('editor.bodyHint') }}</p>
        <NewsRichEditor v-model="form.body" :label="t('editor.body')" :lang="locale" />

        <fieldset class="audience">
          <legend class="label">{{ t('editor.audience') }}</legend>
          <label v-for="a in AUDIENCES" :key="a.value" class="option" :class="{ 'option--on': form.audience === a.value }">
            <input v-model="form.audience" type="radio" name="audience" :value="a.value" class="sr-only">
            <component :is="a.icon" :size="22" weight="bold" aria-hidden="true" class="option-icon" />
            <span class="option-text">
              <strong>{{ t(`editor.audiences.${a.value}.label`) }}</strong>
              <span>{{ t(`editor.audiences.${a.value}.text`) }}</span>
            </span>
          </label>
        </fieldset>

        <div class="bar">
          <button type="submit" class="primary" :disabled="status === 'saving' || !form.headline.trim()">{{ t('editor.publish') }}</button>
          <button v-if="data.edit" type="button" class="secondary" :disabled="status === 'saving'" @click="revert">{{ t('editor.revert') }}</button>
          <NuxtLink :to="data.story.href" class="view" target="_blank">
            {{ t('editor.view') }} <PhArrowSquareOut :size="16" weight="bold" aria-hidden="true" />
          </NuxtLink>
        </div>
        <p class="status" role="status" :class="{ 'status--error': status === 'error' }">
          <template v-if="status === 'saved'">{{ t(`editor.saved.${form.audience}`) }}</template>
          <template v-else-if="status === 'reverted'">{{ t('editor.reverted') }}</template>
          <template v-else-if="status === 'error'">{{ t('editor.saveError', { reason: message }) }}</template>
        </p>
      </form>
    </template>
  </main>
</template>

<style scoped>
.wrap { max-width: calc(760px + 2 * 16px); margin: 0 auto; padding: 0 16px; }
@media (min-width: 768px) { .wrap { max-width: calc(760px + 2 * 30px); padding: 0 30px; } }
.back {
  display: inline-flex; align-items: center; gap: 6px; min-height: 44px; margin-top: 8px;
  font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--meta); text-decoration: none;
}
.back:hover { color: var(--link-hover); }
.notice { margin: 24px 0; padding: 14px 16px; border-radius: 4px; background: var(--surface); color: var(--text-2); }
.kicker {
  margin: 16px 0 0; display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px; line-height: 16px;
  font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta);
}
.title { margin: 6px 0 0; font-size: 32px; line-height: 1.2; font-weight: 700; color: var(--headline); }
.lead { margin: 8px 0 0; color: var(--summary); }

.form { margin-top: 24px; display: flex; flex-direction: column; gap: 6px; }
.form > label, .label { margin-top: 18px; font-size: 14px; font-weight: 700; color: var(--headline); }
.hint { margin: 0 0 4px; font-size: 13px; color: var(--meta); }
.form input[type="text"], .form textarea {
  padding: 12px 14px; border: 1px solid var(--border-control); border-radius: 4px;
  background: var(--bg); color: var(--headline); font: inherit;
}
.form input[type="text"] { min-height: 48px; font-size: 18px; font-weight: 700; }
.form textarea { resize: vertical; line-height: 1.5; }
.form input:focus-visible, .form textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

.audience { margin: 0; padding: 0; border: 0; display: grid; gap: 10px; }
@media (min-width: 640px) { .audience { grid-template-columns: 1fr 1fr; } }
.audience legend { margin-bottom: 10px; padding: 0; }
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

.bar { margin-top: 24px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.primary, .secondary {
  min-height: 48px; padding: 0 22px; border-radius: 999px; font-weight: 700; font-size: 15px;
}
.primary { border: 0; background: var(--accent); color: var(--on-accent); }
.secondary { border: 1px solid var(--border-control); background: var(--bg); color: var(--headline); }
.secondary:hover { background: var(--surface); }
.primary:disabled, .secondary:disabled { opacity: 0.55; cursor: not-allowed; }
.view {
  margin-left: auto; min-height: 44px; display: inline-flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 700; color: var(--summary); text-decoration: none;
}
.view:hover { color: var(--link-hover); }
.primary:focus-visible, .secondary:focus-visible, .view:focus-visible { outline: 2px solid var(--headline); outline-offset: 2px; }
.status { min-height: 22px; margin: 10px 0 0; font-size: 14px; font-weight: 600; color: var(--win); }
.status--error { color: var(--loss); }
</style>
