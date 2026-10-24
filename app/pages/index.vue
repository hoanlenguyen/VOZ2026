<script setup lang="ts">
// Front page: editorial layout (lead story, side stories, card row, latest list + sidebar),
// filled with stories generated from live league data.
import type { Story } from '#shared/types/stories'

definePageMeta({ layout: 'news' })
const { t, locale } = useI18n()
const { can } = useAccount()
useHead({ title: () => t('home.pageTitle') })

const { data, error, status } = await useFetch('/api/landing', { query: { lang: locale } })

type Filter = { id: string, label: string, match: (s: Story) => boolean }
const filters = computed<Filter[]>(() => {
  const comps = [...new Map((data.value?.stories ?? []).map(s => [s.competitionId, s.competitionName]))]
  return [
    { id: 'all', label: t('sport.all'), match: () => true },
    { id: 'hockey', label: t('sport.hockey'), match: s => s.sport === 'hockey' },
    { id: 'football', label: t('sport.football'), match: s => s.sport === 'football' },
    ...comps.map(([id, label]) => ({ id, label, match: (s: Story) => s.competitionId === id })),
  ]
})
const active = ref('all')
const stories = computed(() => {
  const f = filters.value.find(x => x.id === active.value) ?? filters.value[0]!
  return (data.value?.stories ?? []).filter(f.match)
})
const lead = computed(() => stories.value[0])
const side = computed(() => stories.value.slice(1, 3))
const cards = computed(() => stories.value.slice(3, 7))
// Latest: results newest first, then previews soonest first.
const latest = computed(() => {
  const rest = stories.value.slice(7)
  return [
    ...rest.filter(s => s.kind === 'result').sort((a, b) => b.time.localeCompare(a.time)),
    ...rest.filter(s => s.kind === 'preview').sort((a, b) => a.time.localeCompare(b.time)),
  ]
})
</script>

<template>
  <main id="main">
    <NewsFixtureTicker v-if="data?.ticker.length" :leagues="data.ticker" />

    <div class="wrap">
      <h1 class="page-title">{{ t('home.title') }}</h1>
      <nav class="sections" :aria-label="t('home.sections')">
        <button
          v-for="f in filters" :key="f.id" type="button" class="section-tab"
          :aria-pressed="active === f.id" @click="active = f.id"
        >
          {{ f.label }}
        </button>
      </nav>

      <p v-if="error" class="notice">{{ t('home.loadError', { reason: error.statusMessage }) }}</p>
      <p v-else-if="status === 'success' && !stories.length" class="notice">{{ t('home.empty') }}</p>
      <p v-if="data?.missing.length" class="notice notice--soft">
        {{ t('home.missing', { list: data.missing.join(', ') }) }}
      </p>

      <section v-if="lead" class="top" :aria-label="t('home.topStories')">
        <NewsStoryCard :story="lead" variant="lead" class="lead" />
        <div v-if="side.length" class="side">
          <NewsStoryCard v-for="s in side" :key="s.id" :story="s" variant="side" />
        </div>
      </section>

      <section v-if="cards.length" class="cards" :aria-label="t('home.moreStories')">
        <NewsStoryCard v-for="s in cards" :key="s.id" :story="s" />
      </section>

      <div v-if="latest.length || data?.tables.length" class="latest-wrap">
        <section class="latest" aria-labelledby="latest-title">
          <NewsSectionTitle id="latest-title">{{ t('home.latest') }}</NewsSectionTitle>
          <NewsStoryCard v-for="s in latest" :key="s.id" :story="s" variant="row" />
          <p v-if="!latest.length" class="notice notice--soft">{{ t('home.allAbove') }}</p>
        </section>
        <aside class="sidebar" :aria-label="t('home.sidebar')">
          <NewsTableWidget v-for="t in data?.tables" :key="t.competitionId" :table="t" />
          <aside v-if="can.ads" class="sponsor" :aria-label="t('home.sponsored')">
            <p class="sponsor-label">{{ t('home.adLabel') }}</p>
            <p class="sponsor-text">{{ t('home.adText') }}</p>
          </aside>
        </aside>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Metrics: 1100 px content, 2/3 + 1/3 featured block, 4-up row, 300 px sidebar, 50 px between sections */
.wrap { max-width: calc(var(--page-max) + 2 * 50px); margin: 0 auto; padding: 0 16px; }
@media (min-width: 768px) { .wrap { padding: 0 30px; } }
@media (min-width: 1280px) { .wrap { padding: 0 50px; } }
.page-title {
  margin: 32px 0 16px; text-align: center; font-family: var(--font-display); font-weight: 700;
  font-size: clamp(44px, 8vw, 72px); line-height: 1; letter-spacing: 0.02em; text-transform: uppercase;
}
/* Phones: one swipeable row, no scrollbar; the faded right edge hints at more tabs.
   Wider screens: tabs wrap and centre, so there is never a horizontal scroll. */
.sections {
  display: flex; gap: 4px; border-top: 1px solid var(--line-strong); border-bottom: 1px solid var(--line-strong);
  margin-bottom: 30px; padding-right: 32px; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain;
  mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
}
.sections::-webkit-scrollbar { display: none; }
@media (min-width: 768px) {
  .sections { flex-wrap: wrap; justify-content: center; padding-right: 0; overflow: visible; mask-image: none; }
}.section-tab {
  flex: 0 0 auto; min-height: 44px; padding: 0 14px; border: 0; background: transparent; color: var(--meta);
  font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap;
  box-shadow: inset 0 0 0 transparent; transition: box-shadow var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}
.section-tab:hover { color: var(--link-hover); }
.section-tab[aria-pressed="true"] { color: var(--headline); box-shadow: inset 0 -3px 0 var(--accent); }
/* Tighter tabs on mid widths so all fit on one row from ~1000 px. */
@media (min-width: 768px) and (max-width: 1199px) { .section-tab { padding: 0 8px; } }

.notice { margin: 0 0 24px; padding: 14px 16px; border-radius: 4px; background: var(--surface); color: var(--text-2); }
.notice--soft { background: transparent; border: 1px dashed var(--border); color: var(--meta); font-size: 14px; }

.top { display: grid; gap: 20px; }
.side { display: grid; }
.side > * { padding: 20px 0; border-bottom: 1px solid var(--line); }
.side > :first-child { padding-top: 0; }
.side > :last-child { border-bottom: 0; }
@media (min-width: 640px) and (max-width: 1023px) {
  .side { grid-template-columns: 1fr 1fr; gap: 20px; }
  .side > * { padding: 0; border: 0; }
}
@media (min-width: 1024px) {
  .top { grid-template-columns: minmax(0, 66fr) minmax(0, 34fr); gap: 0; }
  .lead { padding-right: 3%; padding-bottom: 20px; }
  .side { border-left: 1px solid var(--line); padding-left: 3%; align-content: start; }
}

.cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 16px; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--line); }
@media (min-width: 1024px) { .cards { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2.6%; } }
@media (max-width: 379px) { .cards { grid-template-columns: 1fr; } }

.latest-wrap { display: grid; gap: 30px; margin-top: 50px; }
@media (min-width: 1024px) { .latest-wrap { grid-template-columns: minmax(0, 1fr) 300px; } }
.sidebar { display: flex; flex-direction: column; gap: 24px; }
@media (min-width: 1024px) { .sidebar { align-self: start; } }
.sponsor { border: 1px dashed var(--border-control); border-radius: 4px; padding: 24px; }
.sponsor-label { margin: 0 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.sponsor-text { margin: 0; font-weight: 600; color: var(--headline); }
</style>
