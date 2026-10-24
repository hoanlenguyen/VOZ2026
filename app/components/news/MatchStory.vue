<script setup lang="ts">
// AI match story with reader choices (length, perspective) and its evidence: every sentence links
// to the verified facts it cites, and "How this was made" shows the agent's steps.
import { PhArrowClockwise, PhCheckCircle, PhListChecks, PhSparkle } from '@phosphor-icons/vue'
import type { Fact, StoryLength, StoryResponse, StoryTone } from '#shared/types/story'

// `preview`: the newsroom editor's view of what readers get (standard, neutral): no format
// switches, facts and references open.
const props = defineProps<{ competitionId: string, matchId: string, home: string, away: string, preview?: boolean }>()

// Readers get the story itself (standard, neutral). The format switches and the evidence
// (AI label, facts behind each sentence, "How this was made") are newsroom tools.
const { can } = useAccount()
const { locale } = useI18n()
const editor = computed(() => can.value.newsroom)
const length = ref<StoryLength>('standard')
const tone = ref<StoryTone>('neutral')
const showFacts = ref(props.preview)
const activeSentence = ref<number | null>(null)

const LENGTHS: Array<{ id: StoryLength, label: string }> = [
  { id: 'short', label: 'Short' },
  { id: 'standard', label: 'Standard' },
  { id: 'long', label: 'Long read' },
]
const tones = computed<Array<{ id: StoryTone, label: string }>>(() => [
  { id: 'neutral', label: 'Neutral' },
  { id: 'home-fan', label: `${props.home} fans` },
  { id: 'away-fan', label: `${props.away} fans` },
  { id: 'analyst', label: 'Analyst' },
])

// Loaded in the browser: the first view of a version may take ~10 s while the agent writes it.
const { data, status, error, refresh } = useLazyFetch<StoryResponse>(
  () => `/api/competitions/${props.competitionId}/matches/${props.matchId}/story`,
  { query: { length, tone, lang: locale }, server: false },
)
watch([length, tone], () => (activeSentence.value = null))

const story = computed(() => data.value?.story)
const factIndex = computed(() => new Map((data.value?.facts ?? []).map((f, i) => [f.id, i + 1])))
const cited = computed(() => new Set(story.value?.sentences.flatMap(s => s.facts) ?? []))
const highlighted = computed(() => new Set(activeSentence.value === null ? [] : story.value?.sentences[activeSentence.value]?.facts ?? []))
const paragraphs = computed(() => {
  const groups = new Map<number, Array<{ text: string, facts: string[], index: number }>>()
  story.value?.sentences.forEach((s, index) => groups.set(s.paragraph, [...(groups.get(s.paragraph) ?? []), { ...s, index }]))
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, s]) => s)
})
const citedFacts = computed<Fact[]>(() => (data.value?.facts ?? []).filter(f => cited.value.has(f.id)))
const modelName = computed(() => (story.value?.model ?? '').replace(/^gpt-6-luna$/, 'GPT-6 Luna'))
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`

function toggleSentence(i: number) {
  activeSentence.value = activeSentence.value === i ? null : i
  showFacts.value = true
}
</script>

<template>
  <div class="story-block">
    <div v-if="editor && !preview" class="controls">
      <fieldset class="seg">
        <legend class="seg-label">Length</legend>
        <label v-for="l in LENGTHS" :key="l.id" class="seg-option">
          <input v-model="length" type="radio" name="story-length" :value="l.id">
          <span>{{ l.label }}</span>
        </label>
      </fieldset>
      <fieldset class="seg">
        <legend class="seg-label">Written for</legend>
        <label v-for="t in tones" :key="t.id" class="seg-option">
          <input v-model="tone" type="radio" name="story-tone" :value="t.id">
          <span>{{ t.label }}</span>
        </label>
      </fieldset>
    </div>

    <div class="body" aria-live="polite" :aria-busy="status === 'pending'">
      <div v-if="status === 'pending' || status === 'idle'" class="loading">
        <span class="sk sk--title" /><span class="sk" /><span class="sk" /><span class="sk sk--short" />
        <p class="loading-note"><PhSparkle :size="14" weight="fill" aria-hidden="true" /> Writing this version from the match facts… the first time takes about 10 seconds.</p>
      </div>

      <div v-else-if="error || !story" class="error">
        <p>The story could not be loaded{{ error?.statusMessage ? ` (${error.statusMessage})` : '' }}.</p>
        <button type="button" class="retry" @click="refresh()"><PhArrowClockwise :size="14" weight="bold" aria-hidden="true" /> Try again</button>
      </div>

      <article v-else class="story">
        <h3 class="headline">{{ story.headline }}</h3>
        <p v-for="(para, pi) in paragraphs" :key="pi" class="para">
          <template v-for="s in para" :key="s.index">
            <span
              class="sentence" :class="{ 'sentence--active': activeSentence === s.index, 'sentence--linked': showFacts }"
              @click="toggleSentence(s.index)"
            >{{ s.text }}</span><sup v-if="showFacts" class="refs"><a
              v-for="id in s.facts" :key="id" :href="`#fact-${id}`" class="ref num"
              :aria-label="`Fact ${factIndex.get(id)}`" @click="activeSentence = s.index"
            >{{ factIndex.get(id) }}</a></sup>{{ ' ' }}
          </template>
        </p>

        <template v-if="editor">
        <p class="label" :class="{ 'label--fallback': story.origin === 'template' }">
          <PhCheckCircle v-if="story.origin === 'agent'" :size="15" weight="fill" aria-hidden="true" />
          <template v-if="story.origin === 'agent'">
            AI-written by {{ modelName }} from official match data · checked against {{ story.check.factsUsed }} facts
          </template>
          <template v-else>Written from match data (the AI story was not available, so this is our template)</template>
        </p>

        <div class="tools">
          <button type="button" class="facts-toggle" :aria-pressed="showFacts" @click="showFacts = !showFacts; activeSentence = null">
            <PhListChecks :size="16" weight="bold" aria-hidden="true" />
            {{ showFacts ? 'Hide the facts' : 'Show the facts behind this story' }}
          </button>
        </div>

        <ol v-if="showFacts" class="facts">
          <li
            v-for="f in citedFacts" :id="`fact-${f.id}`" :key="f.id" :value="factIndex.get(f.id)"
            class="fact" :class="{ 'fact--active': highlighted.has(f.id) }"
          >
            <span class="fact-section">{{ f.section }}</span> {{ f.text }}
          </li>
        </ol>

        <details class="how">
          <summary>How this was made</summary>
          <p v-if="story.origin === 'agent'">
            A single AI agent ({{ modelName }}) read {{ data?.facts.length }} verified facts about this match, wrote the story,
            checked every number and name against the facts it cites, and submitted it. Our harness checked it again before
            publishing{{ data?.cached ? '; this copy was served from the cache' : '' }}.
          </p>
          <p v-else>The agent could not produce a story that passed the check ({{ story.fallbackReason }}), so the harness published the facts as a template instead.</p>
          <ol class="steps">
            <li v-for="(s, i) in story.trace" :key="i"><span class="step-tool">{{ s.tool }}</span> {{ s.summary }} <span class="num step-ms">{{ seconds(s.ms) }}</span></li>
          </ol>
          <p class="meta num">{{ story.usage.turns }} turns · {{ seconds(story.usage.ms) }} · {{ story.usage.inputTokens.toLocaleString('en-GB') }} tokens in, {{ story.usage.outputTokens.toLocaleString('en-GB') }} out</p>
        </details>
        </template>
      </article>
    </div>
  </div>
</template>

<style scoped>
.controls { display: flex; flex-wrap: wrap; gap: 12px 24px; margin-bottom: 20px; }
.seg { border: 0; margin: 0; padding: 0; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.seg-label { float: left; margin-right: 8px; padding: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.seg-option { position: relative; }
.seg-option input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
.seg-option span {
  display: inline-flex; align-items: center; min-height: 40px; padding: 0 14px; border-radius: 999px;
  border: 1px solid var(--line-strong); font-size: 14px; font-weight: 600; color: var(--summary);
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.seg-option:hover span { border-color: var(--border-control); color: var(--headline); }
.seg-option input:checked + span { background: var(--headline); border-color: var(--headline); color: var(--bg); }
.seg-option input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }

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
