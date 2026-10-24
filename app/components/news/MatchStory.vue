<script setup lang="ts">
// AI match story and its evidence: every sentence links to the verified facts it cites, and "How
// this was made" shows the agent's steps. The version (length, perspective) is chosen in the
// newsroom editor; readers always get the published one (the server enforces it).
import { PhArrowClockwise, PhCheckCircle, PhListChecks, PhSparkle } from '@phosphor-icons/vue'
import type { Fact, StoryLength, StoryResponse, StoryTone } from '#shared/types/story'

// `preview`: the editor's view with facts and references open. `reader`: exactly what readers see,
// without the newsroom's evidence tools (the editor's reader preview).
const props = withDefaults(defineProps<{
  competitionId: string
  matchId: string
  length?: StoryLength
  tone?: StoryTone
  preview?: boolean
  reader?: boolean
  /** Extra query for the story request (the newsroom's draft preview: draft, as). */
  extraQuery?: Record<string, string>
  /** The page shows the headline as its title (match page). */
  hideHeadline?: boolean
}>(), { length: 'standard', tone: 'neutral' })
const emit = defineEmits<{ loaded: [story: { headline: string, generatedAt: string }] }>()
const { t, locale } = useI18n()
const { number } = useFormat()

// The evidence (AI label, facts behind each sentence, "How this was made") is a newsroom tool.
const { can } = useAccount()
const editor = computed(() => can.value.newsroom && !props.reader)
const showFacts = ref(props.preview)
const activeSentence = ref<number | null>(null)

// Loaded in the browser: the first view of a version may take ~10 s while the agent writes it.
const { data, status, error, refresh } = useLazyFetch<StoryResponse>(
  () => `/api/competitions/${props.competitionId}/matches/${props.matchId}/story`,
  { query: computed(() => ({ length: props.length, tone: props.tone, lang: locale.value, ...props.extraQuery })), server: false },
)
watch(() => [props.length, props.tone], () => (activeSentence.value = null))

const story = computed(() => data.value?.story)
watch(story, (s) => { if (s) emit('loaded', { headline: s.headline, generatedAt: s.generatedAt }) }, { immediate: true })
const factIndex = computed(() => new Map((data.value?.facts ?? []).map((f, i) => [f.id, i + 1])))
const cited = computed(() => new Set(story.value?.sentences.flatMap(s => s.facts) ?? []))
const highlighted = computed(() => new Set(activeSentence.value === null ? [] : story.value?.sentences[activeSentence.value]?.facts ?? []))
const paragraphs = computed(() => {
  const groups = new Map<number, Array<{ text: string, facts: string[], index: number }>>()
  story.value?.sentences.forEach((s, index) => groups.set(s.paragraph, [...(groups.get(s.paragraph) ?? []), { ...s, index }]))
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, s]) => s)
})
const citedFacts = computed<Fact[]>(() => (data.value?.facts ?? []).filter(f => cited.value.has(f.id)))
const modelName = computed(() => (story.value?.model ? modelLabel(story.value.model) : ''))
const seconds = (ms: number) => `${number(Math.round(ms / 100) / 10)} s`

function toggleSentence(i: number) {
  activeSentence.value = activeSentence.value === i ? null : i
  showFacts.value = true
}
</script>

<template>
  <div class="story-block">
    <div class="body" aria-live="polite" :aria-busy="status === 'pending'">
      <div v-if="status === 'pending' || status === 'idle'" class="loading">
        <span class="sk sk--title" /><span class="sk" /><span class="sk" /><span class="sk sk--short" />
        <p class="loading-note"><PhSparkle :size="14" weight="fill" aria-hidden="true" /> {{ t('matchStory.writing') }}</p>
      </div>

      <div v-else-if="error || !story" class="error">
        <p>{{ error?.statusMessage ? t('matchStory.loadErrorReason', { reason: error.statusMessage }) : t('matchStory.loadError') }}</p>
        <button type="button" class="retry" @click="refresh()"><PhArrowClockwise :size="14" weight="bold" aria-hidden="true" /> {{ t('matchStory.retry') }}</button>
      </div>

      <article v-else class="story">
        <h3 v-if="!hideHeadline" class="headline">{{ story.headline }}</h3>
        <p v-for="(para, pi) in paragraphs" :key="pi" class="para">
          <template v-for="s in para" :key="s.index">
            <span
              class="sentence" :class="{ 'sentence--active': activeSentence === s.index, 'sentence--linked': showFacts }"
              @click="toggleSentence(s.index)"
            >{{ s.text }}</span><sup v-if="showFacts" class="refs"><a
              v-for="id in s.facts" :key="id" :href="`#fact-${id}`" class="ref num"
              :aria-label="t('matchStory.factN', { n: factIndex.get(id) })" @click="activeSentence = s.index"
            >{{ factIndex.get(id) }}</a></sup>{{ ' ' }}
          </template>
        </p>

        <template v-if="editor">
        <p class="label" :class="{ 'label--fallback': story.origin === 'template' }">
          <PhCheckCircle v-if="story.origin === 'agent'" :size="15" weight="fill" aria-hidden="true" />
          <template v-if="story.origin === 'agent'">
            {{ t('matchStory.byAgent', { model: modelName, n: story.check.factsUsed }) }}
          </template>
          <template v-else>{{ t('matchStory.byTemplate') }}</template>
        </p>

        <div class="tools">
          <button type="button" class="facts-toggle" :aria-pressed="showFacts" @click="showFacts = !showFacts; activeSentence = null">
            <PhListChecks :size="16" weight="bold" aria-hidden="true" />
            {{ showFacts ? t('matchStory.hideFacts') : t('matchStory.showFacts') }}
          </button>
        </div>

        <ol v-if="showFacts" class="facts">
          <li
            v-for="f in citedFacts" :id="`fact-${f.id}`" :key="f.id" :value="factIndex.get(f.id)"
            class="fact" :class="{ 'fact--active': highlighted.has(f.id) }"
          >
            <span class="fact-section">{{ t(`matchStory.section.${f.section}`) }}</span> {{ f.text }}
          </li>
        </ol>

        <details class="how">
          <summary>{{ t('matchStory.how') }}</summary>
          <p v-if="story.origin === 'agent'">
            {{ t('matchStory.howAgent', { model: modelName, n: data?.facts.length ?? 0 }) }}{{ data?.cached ? ` ${t('matchStory.fromCache')}` : '' }}
          </p>
          <p v-else>{{ t('matchStory.howTemplate', { reason: story.fallbackReason ?? '' }) }}</p>
          <ol class="steps">
            <li v-for="(s, i) in story.trace" :key="i"><span class="step-tool">{{ s.tool }}</span> {{ s.summary }} <span class="num step-ms">{{ seconds(s.ms) }}</span></li>
          </ol>
          <p class="meta num">{{ t('matchStory.usage', { turns: story.usage.turns, time: seconds(story.usage.ms), tokensIn: number(story.usage.inputTokens), tokensOut: number(story.usage.outputTokens) }) }}</p>
        </details>
        </template>
      </article>
    </div>
  </div>
</template>

<style scoped>
.body { min-height: 180px; }
.loading { display: flex; flex-direction: column; gap: 10px; }
.sk { display: block; height: 14px; border-radius: 4px; background: var(--surface); }
.sk--title { width: 70%; height: 22px; margin-bottom: 6px; }
.sk--short { width: 55%; }
@media (prefers-reduced-motion: no-preference) {
  .sk { animation: pulse 1.2s ease-in-out infinite alternate; }
  @keyframes pulse { from { opacity: 1; } to { opacity: 0.5; } }
}
.loading-note { margin: 6px 0 0; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--meta); }
.error { padding: 14px 16px; border-radius: 4px; background: var(--surface); color: var(--summary); }
.error p { margin: 0 0 8px; }
.retry, .facts-toggle {
  min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--border-control);
  background: var(--bg); color: var(--headline); font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;
}
.retry:hover, .facts-toggle:hover { background: var(--surface); }
.facts-toggle[aria-pressed="true"] { background: var(--headline); color: var(--bg); border-color: var(--headline); }

.headline { margin: 0 0 12px; font-size: clamp(22px, 3vw, 26px); line-height: 1.25; font-weight: 700; color: var(--headline); }
.para { margin: 0 0 14px; font-size: 17px; line-height: 1.65; color: var(--headline); }
.sentence { border-radius: 3px; transition: background-color var(--dur-fast) var(--ease-out); }
.sentence--linked { cursor: pointer; }
.sentence--linked:hover { background: var(--surface); }
.sentence--active { background: rgb(245 197 24 / 0.28); }
.refs { margin-left: 2px; font-size: 11px; }
.ref { margin-right: 2px; padding: 0 3px; border-radius: 3px; background: var(--surface); color: var(--link-hover); text-decoration: none; font-weight: 700; }
.ref:hover { text-decoration: underline; }

.label { margin: 4px 0 14px; display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--meta); }
.label :deep(svg) { color: var(--accent-ink); flex: 0 0 auto; }
.label--fallback { font-style: italic; }
.tools { margin-bottom: 12px; }

.facts { margin: 0 0 16px; padding: 12px 16px 12px 40px; border-radius: 6px; background: var(--surface); font-size: 14px; line-height: 1.5; color: var(--summary); }
.fact { padding: 4px 6px; border-radius: 4px; scroll-margin-top: 80px; transition: background-color var(--dur-fast) var(--ease-out); }
.fact--active { background: rgb(245 197 24 / 0.28); color: var(--headline); }
.fact-section { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); margin-right: 4px; }

.how { border-top: 1px solid var(--line); padding-top: 10px; font-size: 14px; color: var(--summary); }
.how summary { min-height: 40px; display: flex; align-items: center; cursor: pointer; font-weight: 600; color: var(--headline); }
.how p { margin: 6px 0; }
.steps { margin: 6px 0; padding-left: 22px; }
.steps li { margin: 3px 0; }
.step-tool { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; padding: 1px 6px; border-radius: 4px; background: var(--surface); color: var(--headline); }
.step-ms { color: var(--meta); font-size: 12px; }
.meta { font-size: 12px; color: var(--meta); }
</style>
