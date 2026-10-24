<script setup lang="ts">
// Newsroom story editor, per language (the one the editor is browsing in):
// 1. Front page and article: the story's headline and summary, and the "From the newsroom" article
//    for the match page (TinyMCE), for everyone or subscribers only.
// 2. Match story (matches with full data): readers get the AI story, the newsroom's edited version
//    (TinyMCE, can start from the AI text) or nothing, for everyone or subscribers only.
// "Revert to automatic" drops both: the generated story and the AI story for subscribers come back.
import { PhArrowSquareOut, PhCaretLeft, PhEyeSlash, PhGlobeHemisphereWest, PhLockSimple, PhPencilSimpleLine, PhSparkle } from '@phosphor-icons/vue'
import type { StoryResponse } from '#shared/types/story'
import type { ArticleAudience, StoryMode } from '#shared/types/stories'

definePageMeta({ layout: 'news', middleware: 'newsroom' })
const { t, locale } = useI18n()
const { stamp } = useFormat()
const route = useRoute()
const id = computed(() => String(route.params.id))
const url = computed(() => `/api/newsroom/stories/${encodeURIComponent(id.value)}`)
useHead({ title: () => t('editor.pageTitle') })

const { data, error, refresh } = await useFetch(() => `/api/newsroom/stories/${encodeURIComponent(id.value)}`, { query: { lang: locale } })

const form = reactive({ headline: '', summary: '', body: '', audience: 'everyone' as ArticleAudience })
const storyForm = reactive({ mode: 'ai' as StoryMode, audience: 'subscribers' as ArticleAudience, headline: '', body: '' })
const status = ref<'idle' | 'saving' | 'saved' | 'reverted' | 'error'>('idle')
const message = ref('')

function load() {
  const d = data.value
  if (!d) return
  Object.assign(form, {
    headline: d.edit?.headline ?? d.story.headline,
    summary: d.edit?.summary ?? d.story.summary,
    body: d.edit?.body ?? '',
    audience: d.edit?.audience ?? 'everyone',
  })
  const c = d.matchStory.control
  Object.assign(storyForm, { mode: c?.mode ?? 'ai', audience: c?.audience ?? 'subscribers', headline: c?.headline ?? '', body: c?.body ?? '' })
}
watch(data, load, { immediate: true })

// The AI story readers would get (standard, neutral): previewed here, and the starting point for an edit.
const matchPath = computed(() => data.value?.story.href.replace('/match/', '/api/competitions/').replace(/\/(\d+)$/, '/matches/$1'))
const ai = ref<StoryResponse | null>(null)
const aiStatus = ref<'idle' | 'pending' | 'error'>('idle')
async function loadAiStory() {
  aiStatus.value = 'pending'
  ai.value = await $fetch<StoryResponse>(`${matchPath.value}/story`, { query: { lang: locale.value } }).catch(() => null)
  aiStatus.value = ai.value ? 'idle' : 'error'
}
onMounted(() => { if (data.value?.matchStory.available) void loadAiStory() })
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const aiHtml = computed(() => {
  const story = ai.value?.story
  if (!story) return ''
  const paras = new Map<number, string[]>()
  for (const s of story.sentences) paras.set(s.paragraph, [...(paras.get(s.paragraph) ?? []), escape(s.text)])
  return [...paras.entries()].sort(([a], [b]) => a - b).map(([, p]) => `<p>${p.join(' ')}</p>`).join('')
})
function startFromAi() {
  if (!ai.value) return
  storyForm.headline = ai.value.story.headline
  storyForm.body = aiHtml.value
}
watch(() => storyForm.mode, (mode) => {
  if (mode === 'edited' && !storyForm.body && ai.value) startFromAi()
})

const audiences = computed(() => (['everyone', 'subscribers'] as const).map(value => ({
  value, icon: value === 'everyone' ? PhGlobeHemisphereWest : PhLockSimple,
  label: t(`editor.audiences.${value}.label`), text: t(`editor.audiences.${value}.text`),
})))
const modes = computed(() => ([['ai', PhSparkle], ['edited', PhPencilSimpleLine], ['hidden', PhEyeSlash]] as const).map(([value, icon]) => ({
  value, icon, label: t(`editor.modes.${value}.label`), text: t(`editor.modes.${value}.text`),
})))

async function publish() {
  const d = data.value
  if (!d) return
  status.value = 'saving'
  // Unchanged parts are sent as null, so they stay automatic (no "Edited" label).
  const frontChanged = form.headline.trim() !== d.story.headline || form.summary.trim() !== d.story.summary || !!form.body.trim()
  const storyChanged = d.matchStory.available
    && (storyForm.mode !== 'ai' || storyForm.audience !== 'subscribers' || !!d.matchStory.control)
  try {
    await $fetch(url.value, {
      method: 'PUT', query: { lang: locale.value },
      body: { front: frontChanged ? { ...form } : null, story: storyChanged ? { ...storyForm } : null },
    })
    await refresh()
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
    await $fetch(url.value, { method: 'DELETE', query: { lang: locale.value } })
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
        <section class="part" aria-labelledby="part-front">
          <h2 id="part-front" class="part-title">{{ t('editor.partFront') }}</h2>
          <label for="ed-headline">{{ t('editor.headline') }}</label>
          <input id="ed-headline" v-model="form.headline" type="text" maxlength="160" required>

          <label for="ed-summary">{{ t('editor.summary') }}</label>
          <p id="ed-summary-hint" class="hint">{{ t('editor.summaryHint') }}</p>
          <textarea id="ed-summary" v-model="form.summary" rows="4" maxlength="600" aria-describedby="ed-summary-hint" />

          <span class="label">{{ t('editor.body') }}</span>
          <p class="hint">{{ t('editor.bodyHint') }}</p>
          <NewsRichEditor v-model="form.body" :label="t('editor.body')" :lang="locale" />

          <NewsChoiceCards v-model="form.audience" :legend="t('editor.audience')" name="audience" :options="audiences" />
        </section>

        <section v-if="data.matchStory.available" class="part" aria-labelledby="part-story">
          <h2 id="part-story" class="part-title">{{ t('editor.partStory') }}</h2>
          <p class="hint">{{ t('editor.storyLead') }}</p>
          <NewsChoiceCards v-model="storyForm.mode" :legend="t('editor.storyMode')" name="story-mode" :options="modes" />

          <div v-if="storyForm.mode === 'ai'" class="preview" aria-live="polite">
            <p class="preview-label">{{ t('editor.aiPreview') }}</p>
            <p v-if="aiStatus === 'pending'" class="hint">{{ t('editor.aiLoading') }}</p>
            <p v-else-if="aiStatus === 'error'" class="hint">{{ t('editor.aiError') }}</p>
            <template v-else-if="ai">
              <p class="preview-headline">{{ ai.story.headline }}</p>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div class="preview-body" v-html="aiHtml" />
            </template>
          </div>

          <template v-if="storyForm.mode === 'edited'">
            <div class="row">
              <label for="ed-story-headline">{{ t('editor.storyHeadline') }}</label>
              <button v-if="ai" type="button" class="link-btn" @click="startFromAi">{{ t('editor.startFromAi') }}</button>
            </div>
            <input id="ed-story-headline" v-model="storyForm.headline" type="text" maxlength="160">
            <span class="label">{{ t('editor.storyBody') }}</span>
            <p class="hint">{{ t('editor.storyBodyHint') }}</p>
            <NewsRichEditor v-model="storyForm.body" :label="t('editor.storyBody')" :lang="locale" />
          </template>

          <NewsChoiceCards
            v-if="storyForm.mode !== 'hidden'" v-model="storyForm.audience"
            :legend="t('editor.storyAudience')" name="story-audience" :options="audiences"
          />
        </section>

        <div class="bar">
          <button type="submit" class="primary" :disabled="status === 'saving' || !form.headline.trim()">{{ t('editor.publish') }}</button>
          <button v-if="data.edit || data.matchStory.control" type="button" class="secondary" :disabled="status === 'saving'" @click="revert">{{ t('editor.revert') }}</button>
          <NuxtLink :to="data.story.href" class="view" target="_blank">
            {{ t('editor.view') }} <PhArrowSquareOut :size="16" weight="bold" aria-hidden="true" />
          </NuxtLink>
        </div>
        <p class="status" role="status" :class="{ 'status--error': status === 'error' }">
          <template v-if="status === 'saved'">{{ t('editor.saved') }}</template>
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


.part { display: flex; flex-direction: column; gap: 6px; padding-bottom: 32px; border-bottom: 1px solid var(--line-strong); }
.part + .part { padding-top: 28px; }
.part-title { margin: 0 0 4px; font-size: 20px; line-height: 1.3; font-weight: 700; color: var(--headline); }
.row { margin-top: 18px; display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.row label { font-size: 14px; font-weight: 700; color: var(--headline); }
.link-btn { min-height: 44px; padding: 0 4px; border: 0; background: none; font-size: 14px; font-weight: 700; color: var(--link-hover); }
.link-btn:hover { text-decoration: underline; }
.link-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.preview { margin-top: 16px; padding: 16px 18px; border-radius: 4px; background: var(--surface); }
.preview-label { margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.preview-headline { margin: 0 0 8px; font-size: 18px; font-weight: 700; line-height: 1.3; color: var(--headline); }
.preview-body { font-size: 15px; line-height: 1.6; color: var(--text-2); }
.preview-body :deep(p) { margin: 0 0 10px; }
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
