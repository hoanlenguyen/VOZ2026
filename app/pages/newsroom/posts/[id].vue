<script setup lang="ts">
// Newsroom review of one AI match post (newsroom agent, SportWorld match). Per language: the AI
// story with the facts each sentence cites, or the newsroom's edit (plain paragraphs, live fact
// check as in the match story editor). Approve publishes it to the front page and /posts/:id;
// Reject keeps it from readers; Reopen takes an approved or rejected post back to review.
import { PhArrowLeft, PhArrowSquareOut, PhCheckCircle, PhPencilSimple, PhWarning } from '@phosphor-icons/vue'
import type { AiPost, AiPostAction } from '#shared/types/ai-post'
import type { Lang } from '#shared/utils/format'
import { storyParagraphs } from '#shared/utils/newsroom-agent'
import { checkEdit, sentencesOf } from '#shared/utils/story-check'

definePageMeta({ layout: 'news', middleware: 'newsroom' })
const { t } = useI18n()
const { stamp } = useFormat()
const route = useRoute()
const id = computed(() => String(route.params.id))
const { data: post, error } = await useFetch<AiPost>(() => `/api/newsroom/posts/${encodeURIComponent(id.value)}`)
useHead({ title: () => t('review.pageTitle') })

const langs = computed(() => Object.keys(post.value?.stories ?? {}) as Lang[])
const lang = ref<Lang>('en')
watch(langs, l => { if (l.length && !l.includes(lang.value)) lang.value = l[0]! }, { immediate: true })
const story = computed(() => post.value?.stories[lang.value] ?? null)
const edit = computed(() => post.value?.edits?.[lang.value] ?? null)
const factById = computed(() => new Map((post.value?.facts ?? []).map(f => [f.id, f])))
// Sentences grouped by paragraph, keeping their fact ids.
const aiParagraphs = computed(() => {
  const out: Array<Array<{ text: string, facts: string[] }>> = []
  for (const s of story.value?.sentences ?? []) (out[Math.max(0, s.paragraph - 1)] ??= []).push({ text: s.text, facts: s.facts })
  return out.filter(Boolean)
})
const pending = computed(() => post.value?.status === 'pending')

// Editing (pending posts only).
const editing = ref(false)
const form = reactive({ headline: '', text: '' })
function startEdit() {
  form.headline = edit.value?.headline ?? story.value?.headline ?? ''
  form.text = (edit.value?.paragraphs ?? (story.value ? storyParagraphs(story.value) : [])).join('\n\n')
  editing.value = true
}
watch(lang, () => { editing.value = false })
const editSentences = computed(() => [form.headline, ...form.text.split(/\n\s*\n/).flatMap(p => sentencesOf(p.replace(/\s+/g, ' ')))])
const editCheck = computed(() => checkEdit(editSentences.value[0] ?? '', editSentences.value.slice(1), { facts: post.value?.facts ?? [], names: post.value?.names ?? [] }))
const where = (i: number) => (i === 0 ? t('editor.check.headline') : t('editor.check.sentence', { n: i }))
const clip = (s: string) => (s.length > 70 ? `${s.slice(0, 68)}…` : s)

const busy = ref<string | null>(null)
const note = ref('')
const rejecting = ref(false)
const reason = ref('')
async function act(body: AiPostAction, done: string) {
  busy.value = body.action
  note.value = ''
  try {
    post.value = await $fetch<AiPost>(`/api/newsroom/posts/${encodeURIComponent(id.value)}`, { method: 'POST', body })
    note.value = done
    editing.value = false
    rejecting.value = false
  }
  catch (err) {
    note.value = t('review.failed', { reason: (err as { statusMessage?: string }).statusMessage ?? String(err) })
  }
  finally {
    busy.value = null
  }
}
const approve = () => act({ action: 'approve' }, t('review.approved'))
const reject = () => act({ action: 'reject', reason: reason.value }, t('review.rejected'))
const reopen = () => act({ action: 'reopen' }, t('review.reopened'))
const saveEdit = () => act({ action: 'edit', lang: lang.value, headline: form.headline, text: form.text }, t('review.editSaved'))
const revert = () => act({ action: 'revert', lang: lang.value }, t('review.reverted'))
const about = (p: AiPost['press'][number]) => (p.about === 'match' ? t('post.aboutMatch') : t('post.aboutTeam', { team: p.team ?? '' }))
</script>

<template>
  <main id="main" class="wrap">
    <NuxtLink to="/newsroom" class="back"><PhArrowLeft :size="16" weight="bold" aria-hidden="true" />{{ t('review.back') }}</NuxtLink>
    <p v-if="error" class="notice" role="alert">{{ t('review.failed', { reason: error.statusMessage }) }}</p>

    <template v-else-if="post">
      <p class="tags">
        <span class="tag tag--status" :class="`tag--${post.status}`">{{ t(`agent.status.${post.status}`) }}</span>
        <span class="tag tag--ai">{{ t('story.aiTag') }}</span>
        <span v-if="post.simulated" class="tag tag--ai">{{ t('agent.simulated') }}</span>
        <span v-if="story?.origin === 'template'" class="tag">{{ t('agent.template') }}</span>
      </p>
      <h1 class="title">
        {{ post.match.home }} <span class="num">{{ post.match.score.home }}–{{ post.match.score.away }}</span> {{ post.match.away }}
      </h1>
      <p class="meta">
        {{ post.competitionName }} · {{ stamp(post.match.start) }} · {{ t('review.written', { time: stamp(post.createdAt), model: story?.model ?? '–' }) }}
      </p>

      <!-- Decision -->
      <div class="decision" :class="`decision--${post.status}`">
        <p v-if="post.review" class="meta">
          {{ t(`review.last.${post.review.action}`, { by: post.review.by, time: stamp(post.review.at) }) }}<template v-if="post.review.reason">: “{{ post.review.reason }}”</template>
        </p>
        <p v-else class="meta">{{ t('review.lead') }}</p>
        <div class="actions">
          <template v-if="pending">
            <button type="button" class="btn btn--primary" :disabled="!!busy || editing" @click="approve">
              <PhCheckCircle :size="16" weight="bold" aria-hidden="true" />{{ t('review.approve') }}
            </button>
            <button v-if="!rejecting" type="button" class="btn btn--danger" :disabled="!!busy" @click="rejecting = true">{{ t('review.reject') }}</button>
          </template>
          <template v-else-if="post.status === 'approved'">
            <NuxtLink :to="`/posts/${post.id}`" class="btn">{{ t('review.viewAsReader') }}<PhArrowSquareOut :size="16" weight="bold" aria-hidden="true" /></NuxtLink>
            <button type="button" class="btn" :disabled="!!busy" @click="reopen">{{ t('review.unpublish') }}</button>
          </template>
          <button v-else-if="post.status === 'rejected'" type="button" class="btn" :disabled="!!busy" @click="reopen">{{ t('review.reopen') }}</button>
        </div>
        <div v-if="rejecting" class="reject">
          <label class="field">
            <span class="field-label">{{ t('review.reason') }}</span>
            <input v-model="reason" class="input" maxlength="500" :placeholder="t('review.reasonHint')">
          </label>
          <button type="button" class="btn btn--danger" :disabled="!!busy" @click="reject">{{ t('review.confirmReject') }}</button>
          <button type="button" class="btn" @click="rejecting = false">{{ t('review.cancel') }}</button>
        </div>
        <p class="note" role="status" aria-live="polite">{{ note }}</p>
      </div>

      <!-- Story per language -->
      <div v-if="langs.length > 1" class="tabs" role="tablist" :aria-label="t('agent.langs')">
        <button
          v-for="l in langs" :key="l" type="button" role="tab" class="tab" :aria-selected="lang === l"
          @click="lang = l"
        >
          {{ t(`podcast.langs.${l}`) }}<span v-if="post.edits?.[l]" class="dot" :title="t('review.edited')" />
        </button>
      </div>

      <section v-if="story" class="story" role="tabpanel" :lang="lang">
        <div class="story-head">
          <p v-if="edit && !editing" class="meta">{{ t('review.editedBy', { by: edit.by, time: stamp(edit.at) }) }}</p>
          <p v-else-if="!editing" class="meta" :class="story.origin === 'agent' ? 'ok' : 'warn'">
            {{ story.origin === 'agent' ? t('review.checked', { n: story.check.factsUsed }) : t('review.fallback', { reason: story.fallbackReason ?? '' }) }}
          </p>
          <div v-if="pending && !editing" class="actions">
            <button type="button" class="btn" :disabled="!!busy" @click="startEdit"><PhPencilSimple :size="16" weight="bold" aria-hidden="true" />{{ t('review.edit') }}</button>
            <button v-if="edit" type="button" class="btn" :disabled="!!busy" @click="revert">{{ t('review.revert') }}</button>
          </div>
        </div>

        <template v-if="editing">
          <label class="field">
            <span class="field-label">{{ t('review.headline') }}</span>
            <input v-model="form.headline" class="input input--headline" maxlength="200">
          </label>
          <label class="field">
            <span class="field-label">{{ t('review.text') }}</span>
            <textarea v-model="form.text" class="input textarea" rows="14" />
            <span class="hint">{{ t('review.textHint') }}</span>
          </label>
          <div class="check" :class="editCheck.issues.length ? 'check--warn' : 'check--ok'" aria-live="polite">
            <p class="check-title">
              <component :is="editCheck.issues.length ? PhWarning : PhCheckCircle" :size="16" weight="fill" aria-hidden="true" />
              {{ editCheck.issues.length ? t('editor.check.issues', { n: editCheck.issues.length }, editCheck.issues.length) : t('editor.check.ok') }}
            </p>
            <ul v-if="editCheck.issues.length" class="issues">
              <li v-for="(issue, i) in editCheck.issues" :key="i">
                <strong>{{ where(issue.sentence) }}:</strong> {{ t(`editor.check.${issue.kind}`, { value: issue.value ?? '' }) }}
                <span class="issue-text">“{{ clip(editSentences[issue.sentence] ?? '') }}”</span>
              </li>
            </ul>
          </div>
          <div class="actions">
            <button type="button" class="btn btn--primary" :disabled="!!busy || !form.headline.trim() || !form.text.trim()" @click="saveEdit">{{ t('review.saveEdit') }}</button>
            <button type="button" class="btn" @click="editing = false">{{ t('review.cancel') }}</button>
          </div>
        </template>

        <template v-else-if="edit">
          <h2 class="story-headline">{{ edit.headline }}</h2>
          <p v-for="(para, i) in edit.paragraphs" :key="i" class="para">{{ para }}</p>
        </template>

        <template v-else>
          <h2 class="story-headline">{{ story.headline }}</h2>
          <p v-for="(para, i) in aiParagraphs" :key="i" class="para">
            <template v-for="(s, j) in para" :key="j">
              {{ s.text }}<sup class="refs"><span
                v-for="f in s.facts" :key="f" class="ref" :title="factById.get(f)?.text"
              >{{ f }}</span></sup>{{ ' ' }}
            </template>
          </p>
        </template>
      </section>

      <details class="more">
        <summary>{{ t('review.facts', { n: post.facts.length }) }}</summary>
        <ol class="facts">
          <li v-for="f in post.facts" :key="f.id"><span class="ref">{{ f.id }}</span> {{ f.text }}</li>
        </ol>
      </details>

      <section class="block" aria-labelledby="press-title">
        <h2 id="press-title" class="sub">{{ t('post.pressTitle') }}</h2>
        <p class="meta">{{ t('review.pressNote') }}<template v-if="post.pressNote"> {{ post.pressNote }}</template></p>
        <ul v-if="post.press.length" class="press">
          <li v-for="p in post.press" :key="p.link">
            <a :href="p.link" target="_blank" rel="noopener noreferrer">{{ p.title }}</a>
            <span class="meta">{{ p.source }} · {{ about(p) }} · {{ stamp(p.publishedAt) }}</span>
          </li>
        </ul>
      </section>

      <details v-if="story?.trace.length" class="more">
        <summary>{{ t('review.howMade', { turns: story.usage.turns, s: Math.round(story.usage.ms / 1000) }) }}</summary>
        <ol class="facts">
          <li v-for="(step, i) in story.trace" :key="i"><code>{{ step.tool }}</code> {{ step.summary }}</li>
        </ol>
      </details>
    </template>
  </main>
</template>

<style scoped>
.wrap { max-width: calc(820px + 2 * 16px); margin: 0 auto; padding: 24px 16px 0; }
@media (min-width: 768px) { .wrap { padding: 24px 30px 0; max-width: calc(820px + 2 * 30px); } }
.back { min-height: 44px; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--summary); text-decoration: none; }
.back:hover { color: var(--link-hover); }
.back:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.notice { margin: 24px 0; padding: 14px 16px; border-radius: 4px; background: var(--surface); color: var(--text-2); }
.tags { margin: 8px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }
.tag {
  padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line-strong); font-size: 11px; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase; color: var(--summary); white-space: nowrap;
}
.tag--status { border-color: transparent; color: var(--board-text); background: var(--meta); }
.tag--pending { background: var(--link-hover); }
.tag--approved { background: var(--win); }
.tag--rejected, .tag--failed { background: var(--loss); }
.tag--ai { border-color: var(--link-hover); color: var(--link-hover); }
.title { margin: 10px 0 0; font-size: 28px; line-height: 1.25; font-weight: 700; color: var(--headline); }
.meta { margin: 6px 0 0; font-size: 13px; color: var(--meta); }
.ok { color: var(--win); }
.warn { color: var(--loss); }
.decision { margin-top: 20px; padding: 14px 16px; border: 1px solid var(--line-strong); border-left-width: 4px; border-radius: 4px; }
.decision--pending { border-left-color: var(--link-hover); }
.decision--approved { border-left-color: var(--win); }
.decision--rejected, .decision--failed { border-left-color: var(--loss); }
.decision .meta { margin: 0; }
.actions { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.btn {
  min-height: 44px; padding: 0 16px; display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--border-control); border-radius: 999px; background: var(--bg); color: var(--headline);
  font-size: 14px; font-weight: 700; text-decoration: none; cursor: pointer;
}
.btn:hover:not(:disabled) { background: var(--surface); }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn--primary { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
.btn--primary:hover:not(:disabled) { background: var(--accent); opacity: 0.85; }
.btn--danger { border-color: var(--loss); color: var(--loss); }
.btn:focus-visible, .tab:focus-visible { outline: 2px solid var(--link-hover); outline-offset: 2px; }
.reject { margin-top: 12px; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; }
.reject .field { flex: 1 1 260px; }
.note { min-height: 18px; margin: 8px 0 0; font-size: 13px; color: var(--summary); }
.field { display: flex; flex-direction: column; gap: 4px; margin-top: 12px; }
.field-label { font-size: 13px; font-weight: 600; color: var(--headline); }
.input {
  min-height: 44px; width: 100%; padding: 8px 10px; border: 1px solid var(--border-control); border-radius: 4px;
  background: var(--bg); color: var(--headline); font: inherit; font-size: 16px;
}
.input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.input--headline { font-weight: 700; }
.textarea { line-height: 1.55; resize: vertical; }
.hint { font-size: 12px; color: var(--meta); }
.tabs { margin-top: 28px; display: flex; gap: 4px; border-bottom: 1px solid var(--line-strong); }
.tab {
  min-height: 44px; padding: 0 16px; display: inline-flex; align-items: center; gap: 6px; border: 0; border-bottom: 3px solid transparent;
  background: transparent; color: var(--summary); font-size: 14px; font-weight: 700; cursor: pointer;
}
.tab[aria-selected="true"] { border-bottom-color: var(--accent); color: var(--headline); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--link-hover); }
.story { margin-top: 16px; }
.story-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.story-head .actions { margin-top: 0; }
.story-headline { margin: 16px 0 0; font-size: 24px; line-height: 1.25; font-weight: 700; color: var(--headline); }
.para { margin: 14px 0 0; font-size: 17px; line-height: 1.65; color: var(--headline); }
.refs { margin-left: 2px; }
.ref {
  display: inline-block; margin-left: 2px; padding: 0 4px; border-radius: 3px; background: var(--surface);
  font-size: 10px; font-weight: 700; line-height: 14px; color: var(--link-hover); cursor: help;
}
.check { margin-top: 12px; padding: 10px 14px; border-radius: 4px; background: var(--surface); font-size: 13px; color: var(--headline); }
.check-title { margin: 0; display: flex; align-items: center; gap: 6px; font-weight: 700; }
.check--ok .check-title { color: var(--win); }
.check--warn .check-title { color: var(--loss); }
.issues { margin: 8px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.issue-text { display: block; color: var(--meta); }
.more { margin-top: 24px; border-top: 1px solid var(--line); padding-top: 12px; }
.more summary { min-height: 32px; cursor: pointer; font-size: 14px; font-weight: 700; color: var(--headline); }
.facts { margin: 8px 0 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--summary); }
.block { margin-top: 24px; }
.sub { margin: 0; font-size: 18px; font-weight: 700; color: var(--headline); }
.press { list-style: none; margin: 8px 0 0; padding: 0; }
.press li { padding: 8px 0; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; }
.press a { font-weight: 700; color: var(--headline); }
.press a:hover { color: var(--link-hover); }
</style>
