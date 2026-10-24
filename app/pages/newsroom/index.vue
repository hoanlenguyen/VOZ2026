<script setup lang="ts">
// Newsroom dashboard (newsroom accounts): today's front-page stories with their status (live,
// preview = ready for review, draft, hidden), who can read them and who wrote them; hide / show,
// data-source health, the AI caches and the daily AI podcasts. Hiding a story removes it from the
// front page and its match page for every reader; "Edit" opens the match story editor
// (/newsroom/stories/:id).
import { PhArrowSquareOut, PhEye, PhEyeSlash, PhPencilSimple } from '@phosphor-icons/vue'

definePageMeta({ layout: 'news', middleware: 'newsroom' })
const { t, locale } = useI18n()
const { stamp } = useFormat()
useHead({ title: () => t('newsroom.pageTitle') })

const { data, error } = await useFetch('/api/newsroom/overview', { query: { lang: locale } })
const busy = ref<string | null>(null)
const hiddenCount = computed(() => data.value?.stories.filter(s => s.hidden).length ?? 0)

type Status = 'live' | 'preview' | 'draft' | 'hidden'
const STATUSES: Status[] = ['live', 'preview', 'draft', 'hidden']
const filter = ref<'all' | Status>('all')
const counts = computed(() => Object.fromEntries(STATUSES.map(st => [st, data.value?.stories.filter(s => s.status === st).length ?? 0])))
const shown = computed(() => (data.value?.stories ?? []).filter(s => filter.value === 'all' || s.status === filter.value))

async function toggle(id: string, hidden: boolean) {
  busy.value = id
  try {
    await $fetch(`/api/newsroom/stories/${encodeURIComponent(id)}`, { method: 'POST', body: { hidden } })
    const story = data.value?.stories.find(s => s.id === id)
    if (story) {
      story.hidden = hidden
      story.status = hidden ? 'hidden' : story.pending ? (story.status === 'preview' ? 'preview' : 'draft') : 'live'
    }
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <main id="main" class="wrap">
    <h1 class="title">{{ t('newsroom.title') }}</h1>
    <p v-if="data?.editor" class="lead">
      {{ t('newsroom.editor', { name: data.editor.name, role: data.editor.newsroom?.role ?? '' }) }}
    </p>
    <p v-if="error" class="notice" role="alert">{{ t('newsroom.loadError', { reason: error.statusMessage }) }}</p>

    <template v-else-if="data">
      <ul class="tiles">
        <li><span class="tile-n num">{{ data.stories.length }}</span><span class="tile-l">{{ t('newsroom.stats.stories') }}</span></li>
        <li><span class="tile-n num">{{ hiddenCount }}</span><span class="tile-l">{{ t('newsroom.stats.hidden') }}</span></li>
        <li><span class="tile-n num">{{ data.ai.translationsCached }}</span><span class="tile-l">{{ t('newsroom.stats.translations') }}</span></li>
        <li><span class="tile-n num">{{ data.ai.aiStoriesBundled }}</span><span class="tile-l">{{ t('newsroom.stats.aiStories') }}</span></li>
      </ul>

      <section class="block" aria-labelledby="sources-title">
        <NewsSectionTitle id="sources-title">{{ t('newsroom.sources') }}</NewsSectionTitle>
        <p class="meta">{{ t('newsroom.mode', { mode: data.health.mode }) }}</p>
        <ul class="sources">
          <li v-for="(p, name) in data.health.providers" :key="name" class="source">
            <span class="dot" :class="p.ok ? 'dot--ok' : 'dot--down'" aria-hidden="true" />
            <strong>{{ name }}</strong>
            <span class="meta">{{ p.ok ? `${t('newsroom.ok')} · ${p.source}` : `${t('newsroom.down')} · ${p.error}` }}</span>
          </li>
        </ul>
        <p v-if="data.missing.length" class="meta">{{ t('newsroom.missing', { list: data.missing.join(', ') }) }}</p>
      </section>

      <NuxtLink to="/sportworld" class="tool-link">
        <span><strong>{{ t('sportworld.link') }}</strong><span class="meta">{{ t('sportworld.linkLead') }}</span></span>
        <PhArrowSquareOut :size="18" weight="bold" aria-hidden="true" />
      </NuxtLink>

      <NewsPodcastDesk />

      <section class="block" aria-labelledby="stories-title">
        <NewsSectionTitle id="stories-title">{{ t('newsroom.storiesTitle') }}</NewsSectionTitle>
        <p class="meta">{{ t('newsroom.storiesLead') }}</p>
        <fieldset class="filters">
          <legend class="sr-only">{{ t('newsroom.filter') }}</legend>
          <label class="filter">
            <input v-model="filter" type="radio" name="status-filter" value="all">
            <span>{{ t('newsroom.all') }} <span class="count num">{{ data.stories.length }}</span></span>
          </label>
          <label v-for="st in STATUSES" :key="st" class="filter">
            <input v-model="filter" type="radio" name="status-filter" :value="st">
            <span><span class="dot-s" :class="`dot-s--${st}`" aria-hidden="true" />{{ t(`newsroom.status.${st}`) }} <span class="count num">{{ counts[st] }}</span></span>
          </label>
        </fieldset>
        <p v-if="!shown.length" class="meta">{{ t('newsroom.noneWithStatus') }}</p>
        <ol class="stories">
          <li v-for="s in shown" :key="s.id" class="story" :class="{ 'story--hidden': s.hidden }">
            <div class="story-body">
              <p class="kicker">
                <span>{{ s.competitionName }}</span><span aria-hidden="true">·</span>
                <span>{{ t(`story.${s.kind}`) }}</span><span aria-hidden="true">·</span>
                <span class="num">{{ stamp(s.time) }}</span>
              </p>
              <p class="headline">{{ s.headline }}</p>
              <!-- Status, who can read it, who wrote it. -->
              <p class="tags">
                <span class="tag tag--status" :class="`tag--${s.status}`">{{ t(`newsroom.status.${s.status}`) }}</span>
                <span class="tag">{{ t(`editor.audiences.${s.storyControl?.audience ?? 'subscribers'}.label`) }}</span>
                <span v-if="s.storyControl?.by" class="tag">{{ t('newsroom.author', { name: s.storyControl.by }) }}</span>
                <span v-else-if="s.storyControl?.mode === 'hidden'" class="tag">{{ t('newsroom.noStory') }}</span>
                <span v-else class="tag tag--ai">{{ t('story.aiTag') }}</span>
                <span v-if="s.pending" class="pending">{{ t('newsroom.pendingBy', { name: s.pending.by, time: stamp(s.pending.at) }) }}</span>
              </p>
            </div>
            <div class="actions">
              <NuxtLink :to="`/newsroom/stories/${encodeURIComponent(s.id)}`" class="edit">
                <PhPencilSimple :size="16" weight="bold" aria-hidden="true" />
                {{ t('newsroom.edit') }}<span class="sr-only">: {{ s.headline }}</span>
              </NuxtLink>
              <NuxtLink :to="s.href" class="icon-btn" :aria-label="`${t('newsroom.open')}: ${s.headline}`"><PhArrowSquareOut :size="18" weight="bold" aria-hidden="true" /></NuxtLink>
              <button
                type="button" class="toggle" :disabled="busy === s.id" :aria-pressed="s.hidden"
                @click="toggle(s.id, !s.hidden)"
              >
                <component :is="s.hidden ? PhEye : PhEyeSlash" :size="16" weight="bold" aria-hidden="true" />
                {{ s.hidden ? t('newsroom.show') : t('newsroom.hide') }}
              </button>
            </div>
          </li>
        </ol>
      </section>
    </template>
  </main>
</template>

<style scoped>
.wrap { max-width: calc(var(--page-max) + 2 * 16px); margin: 0 auto; padding: 32px 16px 0; }
@media (min-width: 768px) { .wrap { padding: 32px 30px 0; max-width: calc(var(--page-max) + 2 * 30px); } }
.title { margin: 0; font-size: 32px; line-height: 1.2; font-weight: 700; color: var(--headline); }
.lead { margin: 8px 0 0; color: var(--summary); }
.notice { margin: 24px 0; padding: 14px 16px; border-radius: 4px; background: var(--surface); color: var(--text-2); }
.tiles { list-style: none; margin: 24px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
@media (min-width: 768px) { .tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.tiles li { padding: 16px; border: 1px solid var(--line-strong); border-radius: 4px; display: flex; flex-direction: column; gap: 4px; }
.tile-n { font-family: var(--font-display); font-size: 36px; line-height: 1; font-weight: 700; color: var(--headline); }
.tile-l { font-size: 13px; color: var(--summary); }
.block { margin-top: 40px; }
.meta { margin: 0 0 12px; font-size: 13px; color: var(--meta); }
.sources { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.source { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; color: var(--headline); }
.source .meta { margin: 0; }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.dot--ok { background: var(--win); }
.dot--down { background: var(--loss); }
.tool-link {
  margin-top: 24px; min-height: 56px; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  border: 1px solid var(--line-strong); border-radius: 4px; color: var(--headline); text-decoration: none;
}
.tool-link > span { display: flex; flex-direction: column; gap: 2px; }
.tool-link .meta { margin: 0; }
.tool-link:hover { border-color: var(--link-hover); color: var(--link-hover); }
.tool-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.stories { list-style: none; margin: 0; padding: 0; }
.story { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.story-body { flex: 1 1 auto; min-width: 0; }
.story--hidden .headline { color: var(--meta); text-decoration: line-through; }
.kicker { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta); }
.headline { margin: 4px 0 0; font-size: 16px; font-weight: 700; line-height: 1.35; color: var(--headline); }
.edit {
  min-height: 44px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
  font-size: 13px; font-weight: 700; color: var(--headline); text-decoration: none;
}
.edit:hover { background: var(--surface); color: var(--link-hover); }
.edit:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.filters { margin: 0 0 12px; padding: 0; border: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.filter { position: relative; }
.filter input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.filter > span {
  min-height: 40px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
  border: 1px solid var(--line-strong); font-size: 13px; font-weight: 700; color: var(--summary);
}
.filter input:checked + span { background: var(--headline); border-color: var(--headline); color: var(--bg); }
.filter input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.count { font-weight: 600; opacity: 0.7; }
.dot-s { width: 8px; height: 8px; border-radius: 50%; }
.dot-s--live, .tag--live { background: var(--win); }
.dot-s--preview, .tag--preview { background: var(--link-hover); }
.dot-s--draft, .tag--draft { background: var(--draw); }
.dot-s--hidden, .tag--hidden { background: var(--loss); }
.tags { margin: 6px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.tag {
  padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line-strong); font-size: 11px; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase; color: var(--summary);
}
.tag--status { border-color: transparent; color: var(--board-text); }
.tag--ai { border-color: var(--link-hover); color: var(--link-hover); }
.pending { font-size: 12px; color: var(--meta); }
.actions { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; }
.icon-btn { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 4px; color: var(--summary); }
.icon-btn:hover { background: var(--surface); color: var(--link-hover); }
.toggle {
  min-height: 44px; min-width: 104px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: 1px solid var(--border-control); border-radius: 999px; background: var(--bg); color: var(--headline);
  font-size: 13px; font-weight: 700;
}
.toggle:hover { background: var(--surface); }
.toggle[aria-pressed="true"] { background: var(--headline); color: var(--bg); border-color: var(--headline); }
.toggle:disabled { opacity: 0.55; }
.icon-btn:focus-visible, .toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 559px) {
  .story { flex-direction: column; align-items: stretch; gap: 8px; }
  .filters { margin: 0 0 12px; padding: 0; border: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.filter { position: relative; }
.filter input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.filter > span {
  min-height: 40px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
  border: 1px solid var(--line-strong); font-size: 13px; font-weight: 700; color: var(--summary);
}
.filter input:checked + span { background: var(--headline); border-color: var(--headline); color: var(--bg); }
.filter input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.count { font-weight: 600; opacity: 0.7; }
.dot-s { width: 8px; height: 8px; border-radius: 50%; }
.dot-s--live, .tag--live { background: var(--win); }
.dot-s--preview, .tag--preview { background: var(--link-hover); }
.dot-s--draft, .tag--draft { background: var(--draw); }
.dot-s--hidden, .tag--hidden { background: var(--loss); }
.tags { margin: 6px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.tag {
  padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line-strong); font-size: 11px; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase; color: var(--summary);
}
.tag--status { border-color: transparent; color: var(--board-text); }
.tag--ai { border-color: var(--link-hover); color: var(--link-hover); }
.pending { font-size: 12px; color: var(--meta); }
.actions { justify-content: flex-end; }
}
</style>
