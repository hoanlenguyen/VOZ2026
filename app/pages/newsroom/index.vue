<script setup lang="ts">
// Newsroom dashboard (newsroom accounts): today's front-page stories with hide / show, data-source
// health and the AI caches. Hiding a story removes it from the front page for every reader;
// "Edit" opens the story editor (/newsroom/stories/:id).
import { PhArrowSquareOut, PhEye, PhEyeSlash, PhPencilSimple } from '@phosphor-icons/vue'

definePageMeta({ layout: 'news', middleware: 'newsroom' })
const { t, locale } = useI18n()
const { stamp } = useFormat()
useHead({ title: () => t('newsroom.pageTitle') })

const { data, error } = await useFetch('/api/newsroom/overview', { query: { lang: locale } })
const busy = ref<string | null>(null)
const hiddenCount = computed(() => data.value?.stories.filter(s => s.hidden).length ?? 0)

async function toggle(id: string, hidden: boolean) {
  busy.value = id
  try {
    await $fetch(`/api/newsroom/stories/${encodeURIComponent(id)}`, { method: 'POST', body: { hidden } })
    const story = data.value?.stories.find(s => s.id === id)
    if (story) story.hidden = hidden
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

      <section class="block" aria-labelledby="stories-title">
        <NewsSectionTitle id="stories-title">{{ t('newsroom.storiesTitle') }}</NewsSectionTitle>
        <p class="meta">{{ t('newsroom.storiesLead') }}</p>
        <ol class="stories">
          <li v-for="s in data.stories" :key="s.id" class="story" :class="{ 'story--hidden': s.hidden }">
            <div class="story-body">
              <p class="kicker">
                <span>{{ s.competitionName }}</span><span aria-hidden="true">·</span>
                <span>{{ t(`story.${s.kind}`) }}</span><span aria-hidden="true">·</span>
                <span class="num">{{ stamp(s.time) }}</span>
                <span class="badge-s" :class="s.hidden ? 'badge-s--hidden' : 'badge-s--live'">{{ s.hidden ? t('newsroom.hiddenBadge') : t('newsroom.liveBadge') }}</span>
                <span v-if="s.edited" class="badge-s badge-s--edited">{{ t('newsroom.editedBadge') }}</span>
                <span v-if="s.edited?.audience === 'subscribers'" class="badge-s badge-s--plus">{{ t('newsroom.plusBadge') }}</span>
              </p>
              <p class="headline">{{ s.headline }}</p>
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
.stories { list-style: none; margin: 0; padding: 0; }
.story { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.story-body { flex: 1 1 auto; min-width: 0; }
.story--hidden .headline { color: var(--meta); text-decoration: line-through; }
.kicker { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta); }
.headline { margin: 4px 0 0; font-size: 16px; font-weight: 700; line-height: 1.35; color: var(--headline); }
.badge-s { margin-left: 4px; padding: 1px 8px; border-radius: 999px; font-size: 10px; }
.badge-s--live { background: var(--win); color: var(--board-text); }
.badge-s--hidden { background: var(--loss); color: var(--board-text); }
.badge-s--edited { margin-left: 0; background: var(--surface-2); color: var(--headline); }
.badge-s--plus { margin-left: 0; background: var(--accent); color: var(--on-accent); }
.edit {
  min-height: 44px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
  font-size: 13px; font-weight: 700; color: var(--headline); text-decoration: none;
}
.edit:hover { background: var(--surface); color: var(--link-hover); }
.edit:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
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
  .actions { justify-content: flex-end; }
}
</style>
