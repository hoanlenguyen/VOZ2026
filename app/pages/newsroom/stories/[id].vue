<script setup lang="ts">
// Newsroom match story editor, per language (the one the editor is browsing in), for matches with
// full data: readers get the AI story, the newsroom's edited version (TinyMCE, written next to the
// match facts and a live check) or nothing, for everyone or subscribers only; which AI version
// (length, perspective); and the match's cover image (in place of the match graphic). "Preview"
// shows the unsaved settings as subscribers or free readers would see them. "Revert to automatic"
// brings back the standard AI story for subscribers and the match graphic.
import { PhArrowSquareOut, PhCaretLeft, PhCheckCircle, PhEye, PhEyeSlash, PhGlobeHemisphereWest, PhLockSimple, PhPencilSimpleLine, PhSparkle, PhWarning, PhX } from '@phosphor-icons/vue'
import { checkEdit, sentencesOf } from '#shared/utils/story-check'
import type { StoryLength, StoryResponse, StoryTone } from '#shared/types/story'
import type { ArticleAudience, StoryCover, StoryMode } from '#shared/types/stories'

definePageMeta({ layout: 'news', middleware: 'newsroom' })
const { t, locale } = useI18n()
const { stamp } = useFormat()
const route = useRoute()
const { account } = useAccount()
const id = computed(() => String(route.params.id))
const url = computed(() => `/api/newsroom/stories/${encodeURIComponent(id.value)}`)
useHead({ title: () => t('editor.pageTitle') })

const { data, error, refresh } = await useFetch(() => `/api/newsroom/stories/${encodeURIComponent(id.value)}`, { query: { lang: locale } })

const storyForm = reactive({
  mode: 'ai' as StoryMode, audience: 'subscribers' as ArticleAudience, length: 'standard' as StoryLength, tone: 'neutral' as StoryTone,
  headline: '', body: '', cover: null as StoryCover | null,
})
const status = ref<'idle' | 'saving' | 'saved' | 'reverted' | 'error'>('idle')
const message = ref('')

function load() {
  const d = data.value
  if (!d) return
  const c = d.matchStory.control
  Object.assign(storyForm, {
    mode: c?.mode ?? 'ai', audience: c?.audience ?? 'subscribers', length: c?.length ?? 'standard', tone: c?.tone ?? 'neutral',
    headline: c?.headline ?? '', body: c?.body ?? '',
    cover: c?.cover ? { ...c.cover } : null,
  })
}
watch(data, load, { immediate: true })

// The chosen AI version: previewed, checked against, and the starting point for an edit.
const matchPath = computed(() => data.value?.story.href.replace('/match/', '/api/competitions/').replace(/\/(\d+)$/, '/matches/$1'))
const matchId = computed(() => data.value?.story.href.split('/').pop() ?? '')
const ai = ref<StoryResponse | null>(null)
// Same request as the preview below, so it comes from the story cache.
async function loadAiStory() {
  ai.value = await $fetch<StoryResponse>(`${matchPath.value}/story`, {
    query: { lang: locale.value, length: storyForm.length, tone: storyForm.tone },
  }).catch(() => null)
}
onMounted(() => { if (data.value?.matchStory.available) void loadAiStory() })
watch(() => [storyForm.length, storyForm.tone], () => void loadAiStory())

// Preview before publishing: the unsaved settings as a subscriber or a free reader would see them.
const previewDialog = ref<HTMLDialogElement>()
const previewAs = ref<'subscriber' | 'free'>('subscriber')
const previewLocked = computed(() => previewAs.value === 'free' && storyForm.audience === 'subscribers')
const previewTeaser = computed(() => {
  if (storyForm.mode === 'edited') {
    const text = editText.value.slice(1, 3).join(' ')
    return { headline: storyForm.headline, text, translated: false, source: 'newsroom' as const }
  }
  const story = ai.value?.story
  return story
    ? { headline: story.headline, text: story.sentences.slice(0, 2).map(x => x.text).join(' '), translated: false, source: 'ai' as const }
    : null
})
function openPreview() {
  previewAs.value = 'subscriber'
  previewDialog.value?.showModal()
}
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

// Live check of the edited version against the match facts (shared/utils/story-check.ts checkEdit):
// index 0 is the headline, then the body's sentences, block by block.
const editText = computed(() => {
  const blocks = storyForm.body
    .replace(/<\/(p|h2|h3|li|blockquote)>|<br\s*\/?>/g, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .split('\n')
  return [storyForm.headline, ...blocks.flatMap(b => sentencesOf(b))]
})
const editCheck = computed(() => ai.value
  ? checkEdit(editText.value[0] ?? '', editText.value.slice(1), { facts: ai.value.facts, names: ai.value.names })
  : { issues: [], factIds: [] })
const usedFacts = computed(() => new Set(editCheck.value.factIds))
const factQuery = ref('')
const shownFacts = computed(() => {
  const q = factQuery.value.trim().toLowerCase()
  return (ai.value?.facts ?? []).filter(f => !q || f.text.toLowerCase().includes(q))
})
const where = (i: number) => (i === 0 ? t('editor.check.headline') : t('editor.check.sentence', { n: i }))
const clip = (s: string) => (s.length > 70 ? `${s.slice(0, 68)}…` : s)

const audiences = computed(() => (['everyone', 'subscribers'] as const).map(value => ({
  value, icon: value === 'everyone' ? PhGlobeHemisphereWest : PhLockSimple,
  label: t(`editor.audiences.${value}.label`), text: t(`editor.audiences.${value}.text`),
})))
const modes = computed(() => ([['ai', PhSparkle], ['edited', PhPencilSimpleLine], ['hidden', PhEyeSlash]] as const).map(([value, icon]) => ({
  value, icon, label: t(`editor.modes.${value}.label`), text: t(`editor.modes.${value}.text`),
})))

async function publish() {
  status.value = 'saving'
  try {
    await $fetch(url.value, { method: 'PUT', query: { lang: locale.value }, body: { ...storyForm } })
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
        <span class="match-name">{{ data.story.match.home.shortName }} – {{ data.story.match.away.shortName }}.</span>
        {{ t('editor.language', { lang: t(`editor.langName.${locale}`) }) }}
        <template v-if="data.matchStory.control"> {{ t('editor.lastSaved', { name: data.matchStory.control.by, time: stamp(data.matchStory.control.at) }) }}</template>
        <template v-else> {{ t('editor.automatic') }}</template>
      </p>

      <p v-if="!data.matchStory.available" class="notice">{{ t('editor.noStory') }}</p>

      <form v-if="data.matchStory.available" class="form" @submit.prevent="publish">
        <section v-if="data.matchStory.available" class="part" aria-labelledby="part-story">
          <h2 id="part-story" class="sr-only">{{ t('editor.partStory') }}</h2>
          <p class="hint">{{ t('editor.storyLead') }}</p>
          <NewsChoiceCards v-model="storyForm.mode" :legend="t('editor.storyMode')" name="story-mode" :options="modes" />

          <template v-if="storyForm.mode !== 'hidden'">
            <span class="label">{{ storyForm.mode === 'ai' ? t('editor.format.title') : t('editor.format.titleEdited') }}</span>
            <NewsStoryFormat
              v-model:length="storyForm.length" v-model:tone="storyForm.tone"
              :home="data.story.match.home.shortName" :away="data.story.match.away.shortName"
            />
          </template>

          <div v-if="storyForm.mode === 'ai'" class="preview" aria-live="polite">
            <p class="preview-label">{{ t('editor.aiPreview') }}</p>
            <NewsMatchStory
              :competition-id="data.story.competitionId" :match-id="matchId"
              :length="storyForm.length" :tone="storyForm.tone" preview
            />
          </div>

          <!-- Edited version: the editor writes next to the match facts and a live check of the text. -->
          <div v-if="storyForm.mode === 'edited'" class="workbench">
            <div class="workbench-main">
              <div class="row">
                <label for="ed-story-headline">{{ t('editor.storyHeadline') }}</label>
                <button v-if="ai" type="button" class="link-btn" @click="startFromAi">{{ t('editor.startFromAi') }}</button>
              </div>
              <input id="ed-story-headline" v-model="storyForm.headline" type="text" maxlength="160">
              <span class="label">{{ t('editor.storyBody') }}</span>
              <p class="hint">{{ t('editor.storyBodyHint') }}</p>
              <NewsRichEditor v-model="storyForm.body" :label="t('editor.storyBody')" :lang="locale" />
            </div>

            <aside v-if="ai" class="factsheet" aria-labelledby="facts-title">
              <h3 id="facts-title" class="factsheet-title">{{ t('editor.factsTitle') }}</h3>
              <div class="check" :class="editCheck.issues.length ? 'check--warn' : 'check--ok'" aria-live="polite">
                <p class="check-head">
                  <component :is="editCheck.issues.length ? PhWarning : PhCheckCircle" :size="16" weight="fill" aria-hidden="true" />
                  {{ editCheck.issues.length ? t('editor.check.issues', { n: editCheck.issues.length }, editCheck.issues.length) : t('editor.check.ok') }}
                </p>
                <ul v-if="editCheck.issues.length" class="issues">
                  <li v-for="(issue, i) in editCheck.issues" :key="i">
                    <strong>{{ where(issue.sentence) }}:</strong> {{ t(`editor.check.${issue.kind}`, { value: issue.value ?? '' }) }}
                    <span class="issue-text">“{{ clip(editText[issue.sentence] ?? '') }}”</span>
                  </li>
                </ul>
              </div>
              <label class="sr-only" for="facts-search">{{ t('editor.factsSearch') }}</label>
              <input id="facts-search" v-model="factQuery" type="search" class="facts-search" :placeholder="t('editor.factsSearch')">
              <ol class="fact-list">
                <li v-for="f in shownFacts" :key="f.id" class="fact" :class="{ 'fact--used': usedFacts.has(f.id) }">
                  <span class="fact-section">{{ t(`editor.sections.${f.section}`) }}</span>
                  {{ f.text }}
                </li>
              </ol>
              <p class="hint">{{ t('editor.factsUsed', { n: usedFacts.size, total: ai.facts.length }) }}</p>
            </aside>
          </div>

          <NewsChoiceCards
            v-if="storyForm.mode !== 'hidden'" v-model="storyForm.audience"
            :legend="t('editor.storyAudience')" name="story-audience" :options="audiences"
          />
          <NewsCoverPicker v-model="storyForm.cover" :graphic="data.story" />
        </section>

        <div class="bar">
          <button type="submit" class="primary" :disabled="status === 'saving' || !!(storyForm.cover && !storyForm.cover.alt.trim())">{{ t('editor.publish') }}</button>
          <button type="button" class="secondary" @click="openPreview">
            <PhEye :size="16" weight="bold" aria-hidden="true" /> {{ t('editor.preview.open') }}
          </button>
          <button v-if="data.matchStory.control" type="button" class="secondary" :disabled="status === 'saving'" @click="revert">{{ t('editor.revert') }}</button>
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

      <!-- Preview: the match page's cover and story section as readers would get them, unsaved. -->
      <dialog ref="previewDialog" class="dialog" aria-labelledby="preview-title">
        <header class="dialog-head">
          <h2 id="preview-title" class="dialog-title">{{ t('editor.preview.title') }}</h2>
          <fieldset class="view-as">
            <legend class="sr-only">{{ t('editor.preview.as') }}</legend>
            <label v-for="v in (['subscriber', 'free'] as const)" :key="v" class="view-as-option">
              <input v-model="previewAs" type="radio" name="preview-as" :value="v">
              <span>{{ t(`editor.preview.${v}`) }}</span>
            </label>
          </fieldset>
          <button type="button" class="close" :aria-label="t('editor.preview.close')" @click="previewDialog?.close()">
            <PhX :size="20" weight="bold" aria-hidden="true" />
          </button>
        </header>
        <div class="dialog-body">
          <p class="preview-note">{{ t('editor.preview.note') }}</p>
          <figure v-if="storyForm.cover" class="preview-cover">
            <img :src="`/api/images/${storyForm.cover.id}`" :alt="storyForm.cover.alt">
            <figcaption v-if="storyForm.cover.credit">{{ t('match.coverCredit', { credit: storyForm.cover.credit }) }}</figcaption>
          </figure>
          <NewsMatchVisual v-else :story="data.story" size="lg" />

          <section class="preview-story" aria-labelledby="preview-story-title">
            <NewsSectionTitle id="preview-story-title">{{ t('match.story') }}</NewsSectionTitle>
            <p v-if="storyForm.mode === 'hidden'" class="notice">{{ t('editor.preview.hidden') }}</p>
            <NewsPaywall v-else-if="previewLocked" :teaser="previewTeaser" />
            <article v-else-if="storyForm.mode === 'edited'">
              <p class="article-kicker">{{ t('match.storyEdited', { name: account?.name ?? '', time: stamp(new Date().toISOString()) }) }}</p>
              <h3 class="article-headline">{{ storyForm.headline }}</h3>
              <!-- The editor's own unsaved text (TinyMCE keeps only the allowed tags); the server sanitises it on publish. -->
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div class="article-body" v-html="storyForm.body" />
            </article>
            <NewsMatchStory
              v-else :competition-id="data.story.competitionId" :match-id="matchId"
              :length="storyForm.length" :tone="storyForm.tone" reader
            />
          </section>
        </div>
        <footer class="dialog-foot">
          <button type="button" class="secondary" @click="previewDialog?.close()">{{ t('editor.preview.back') }}</button>
          <button type="button" class="primary" :disabled="status === 'saving' || !!(storyForm.cover && !storyForm.cover.alt.trim())" @click="previewDialog?.close(); publish()">
            {{ t('editor.publish') }}
          </button>
        </footer>
      </dialog>
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
.match-name { font-weight: 700; color: var(--headline); }

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
.preview :deep(.headline) { font-size: 20px; }
.workbench { display: grid; gap: 20px; }
@media (min-width: 1200px) {
  /* Breaks out of the 760px column: editor and facts side by side. */
  .workbench {
    width: min(1180px, calc(100vw - 60px)); position: relative; left: 50%; transform: translateX(-50%);
    grid-template-columns: minmax(0, 1fr) 360px; align-items: start;
  }
}
.workbench-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.workbench-main input[type="text"] {
  min-height: 48px; padding: 12px 14px; border: 1px solid var(--border-control); border-radius: 4px;
  background: var(--bg); color: var(--headline); font: inherit; font-size: 18px; font-weight: 700;
}
.factsheet {
  margin-top: 18px; padding: 16px; border-radius: 4px; background: var(--surface);
  display: flex; flex-direction: column; gap: 10px; min-width: 0;
}
@media (min-width: 1200px) { .factsheet { position: sticky; top: 80px; max-height: calc(100vh - 100px); overflow: auto; } }
.factsheet-title { margin: 0; font-size: 16px; font-weight: 700; color: var(--headline); }
.check { padding: 10px 12px; border-radius: 4px; background: var(--bg); font-size: 13px; color: var(--summary); border-left: 3px solid var(--win); }
.check--warn { border-left-color: var(--loss); }
.check-head { margin: 0; display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--headline); }
.check--ok .check-head :deep(svg) { color: var(--win); }
.check--warn .check-head :deep(svg) { color: var(--loss); }
.issues { margin: 8px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.issue-text { display: block; color: var(--meta); }
.facts-search {
  min-height: 40px; padding: 0 12px; border: 1px solid var(--border-control); border-radius: 4px;
  background: var(--bg); color: var(--headline); font: inherit; font-size: 14px;
}
.facts-search:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.fact-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.45; color: var(--summary); }
.fact { padding: 6px 8px; border-radius: 4px; }
.fact--used { background: rgb(245 197 24 / 0.28); color: var(--headline); }
.fact-section { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.primary, .secondary { display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.dialog {
  width: min(860px, calc(100vw - 32px)); max-height: calc(100vh - 32px); padding: 0; border: 0; border-radius: 8px;
  background: var(--bg); color: var(--headline); box-shadow: 0 24px 64px rgb(0 0 0 / 0.3);
}
.dialog::backdrop { background: rgb(0 0 0 / 0.55); }
.dialog[open] { display: flex; flex-direction: column; }
.dialog-head {
  position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
  padding: 12px 12px 12px 20px; border-bottom: 1px solid var(--line-strong); background: var(--bg);
}
.dialog-title { margin: 0; margin-right: auto; font-size: 18px; font-weight: 700; }
.view-as { margin: 0; padding: 3px; border: 1px solid var(--line-strong); border-radius: 999px; display: flex; gap: 2px; }
.view-as-option { position: relative; }
.view-as-option input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.view-as-option span { display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 700; color: var(--summary); }
.view-as-option input:checked + span { background: var(--headline); color: var(--bg); }
.view-as-option input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.close { width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 999px; background: none; color: var(--headline); }
.close:hover { background: var(--surface); }
.dialog-body { overflow: auto; padding: 20px; }
.dialog-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 20px; border-top: 1px solid var(--line-strong); }
.preview-note { margin: 0 0 14px; font-size: 13px; color: var(--meta); }
.preview-cover { margin: 0; }
.preview-cover img { display: block; width: 100%; aspect-ratio: 21 / 9; object-fit: cover; border-radius: 4px; }
.preview-cover figcaption { margin-top: 6px; font-size: 12px; color: var(--meta); }
.preview-story { margin-top: 32px; }
.article-kicker { margin: 0; font-size: 13px; color: var(--meta); }
.article-headline { margin: 6px 0 0; font-size: clamp(22px, 3vw, 28px); line-height: 1.29; font-weight: 700; color: var(--headline); }
.article-body { margin-top: 14px; font-size: 17px; line-height: 1.65; color: var(--text-2); }
.article-body :deep(p), .article-body :deep(ul), .article-body :deep(ol) { margin: 0 0 16px; }
.article-body :deep(h2) { margin: 28px 0 10px; font-size: 22px; line-height: 1.3; }
.article-body :deep(h3) { margin: 24px 0 8px; font-size: 18px; line-height: 1.35; }
.article-body :deep(blockquote) { margin: 0 0 16px; padding: 4px 0 4px 18px; border-left: 3px solid var(--accent); font-style: italic; }
.article-body :deep(a) { color: var(--link-hover); }
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
