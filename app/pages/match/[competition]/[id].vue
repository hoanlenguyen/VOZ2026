<script setup lang="ts">
// Match page: scoreboard, then a side-by-side comparison counted from the season's results.
// The AI match story is built in Phase 2.
import { PhCaretLeft, PhPencilSimple } from '@phosphor-icons/vue'

definePageMeta({ layout: 'news' })

const { t, locale } = useI18n()
const fmt = useFormat()
const route = useRoute()
// Newsroom preview (/newsroom/stories/:id): ?draft=<id>&as=subscriber|free shows the page with the
// editor's unsaved settings, as that reader would see it (the server checks the newsroom session).
const preview = computed(() => (typeof route.query.draft === 'string'
  ? { draft: route.query.draft, as: route.query.as === 'free' ? 'free' : 'subscriber' }
  : null))
const { data, error } = await useFetch(`/api/competitions/${route.params.competition}/matches/${route.params.id}`, {
  query: computed(() => ({ lang: locale.value, ...preview.value })),
})
const match = computed(() => data.value?.match)
const finished = computed(() => match.value?.status === 'finished')
// Football: "Half-time 1–0"; hockey: "Periods 0–1, 0–1, 0–1".
const periodLine = computed(() => {
  const m = match.value
  if (!m || m.status !== 'finished' || !m.periods.length) return ''
  if (m.sport === 'football') return t('match.halfTime', { score: `${m.periods[0]!.home}–${m.periods[0]!.away}` })
  return t('match.periods', { list: m.periods.map(p => `${p.home}–${p.away}`).join(', ') })
})
const { can } = useAccount()
// The newsroom editor for this match's coverage (front-page story id: result or preview).
const editLink = computed(() => match.value && `/newsroom/stories/${encodeURIComponent(`${finished.value ? 'r' : 'p'}-${match.value.key}`)}`)
const hasMatchStats = computed(() => data.value?.compare?.groups.some(g => g.id === 'stats') ?? false)

useHead(() => ({
  title: match.value
    ? `${match.value.home.shortName} ${finished.value ? fmt.score(match.value) : t('visual.vs')} ${match.value.away.shortName} – VOZ`
    : t('match.pageTitle'),
}))
</script>

<template>
  <main id="main" class="wrap">
    <p v-if="preview" class="preview-banner" role="status">{{ t('match.previewBanner', { as: t(`editor.preview.${preview.as}`) }) }}</p>
    <NuxtLink to="/" class="back">
      <PhCaretLeft :size="14" weight="bold" aria-hidden="true" />
      {{ t('match.back') }}
    </NuxtLink>

    <p v-if="error" class="notice">{{ t('match.loadError', { reason: error.statusMessage }) }}</p>

    <template v-else-if="match && data">
      <header class="hero">
        <p class="kicker">
          <span>{{ data.competition.name }}</span>
          <template v-if="match.round">
            <span aria-hidden="true">·</span><span>{{ t('match.matchday', { n: match.round }) }}</span>
          </template>
          <span aria-hidden="true">·</span><span class="num">{{ fmt.stamp(match.start) }}</span>
        </p>
        <h1 class="title num">
          {{ match.home.shortName }} {{ finished ? fmt.score(match) : t('visual.vs') }} {{ match.away.shortName }}
        </h1>
        <p class="meta num">
          <template v-if="periodLine">{{ periodLine }}</template>
          <template v-if="match.venue"><span v-if="periodLine" aria-hidden="true"> · </span>{{ match.venue }}</template>
          <template v-if="match.attendance"> · {{ t('match.spectators', { n: fmt.number(match.attendance) }) }}</template>
        </p>
        <!-- The newsroom's cover image replaces the match graphic when one is set. -->
        <figure v-if="data.cover" class="visual cover">
          <img :src="data.cover.src" :alt="data.cover.alt">
          <figcaption v-if="data.cover.credit">{{ t('match.coverCredit', { credit: data.cover.credit }) }}</figcaption>
        </figure>
        <NewsMatchVisual v-else :story="{ competitionName: data.competition.name, match }" size="lg" class="visual" />
      </header>

      <aside v-if="can.newsroom && editLink && !preview" class="desk" :aria-label="t('match.deskLabel')">
        <span>
          <strong>{{ t('match.deskLabel') }}</strong>
          {{ t('match.deskState', {
            story: data.story ? t(`editor.modes.${data.story.mode}.label`) + (data.story.mode === 'hidden' ? '' : ` · ${t(`editor.audiences.${data.story.audience}.label`)}`) : t('match.deskNone'),
          }) }}
        </span>
        <NuxtLink :to="editLink" class="desk-edit"><PhPencilSimple :size="16" weight="bold" aria-hidden="true" /> {{ t('match.deskEdit') }}</NuxtLink>
      </aside>

      <NewsPaywall v-if="data.locked?.length" :teaser="data.teaser" />

      <!-- Match story as the newsroom set it: the published AI version or the newsroom's edited version,
           or (newsroom accounts only) a note that it is hidden from readers. -->
      <section v-if="data.story" class="block" aria-labelledby="story-title">
        <NewsSectionTitle id="story-title">{{ t('match.story') }}</NewsSectionTitle>
        <p v-if="data.story.mode === 'hidden'" class="notice">{{ t('match.storyHidden') }}</p>
        <template v-else>
          <article v-if="data.story.edited">
            <p class="article-kicker">
              <span v-if="data.story.audience === 'subscribers'" class="plus">{{ t('match.storyPlus') }} · </span>
              {{ t('match.storyEdited', { name: data.story.edited.by, time: fmt.stamp(data.story.edited.at) }) }}
            </p>
            <h3 class="article-headline">{{ data.story.edited.headline }}</h3>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="article-body" v-html="data.story.edited.body" />
          </article>
          <NewsMatchStory v-else :competition-id="data.competition.id" :match-id="match.id" :length="data.story.length" :tone="data.story.tone"
            :reader="!!preview" :extra-query="preview ?? undefined"
          />
        </template>
      </section>

      <section v-if="data.extras?.timeline.length" class="block" aria-labelledby="timeline-title">
        <NewsSectionTitle id="timeline-title">{{ t('match.timeline') }}</NewsSectionTitle>
        <NewsMatchTimeline
          :events="data.extras.timeline"
          :home="{ name: match.home.shortName, logo: match.home.logo }"
          :away="{ name: match.away.shortName, logo: match.away.logo }"
        />
      </section>

      <section v-if="data.compare" class="block" aria-labelledby="compare-title">
        <NewsSectionTitle id="compare-title">{{ t('match.compare') }}</NewsSectionTitle>
        <NewsStatCompare
          :compare="data.compare"
          :home="{ name: match.home.shortName, logo: match.home.logo }"
          :away="{ name: match.away.shortName, logo: match.away.logo }"
        />
        <p class="source">
          <template v-if="data.extras">{{ t('match.sourceExtras', { source: data.extras.source.name, league: data.competition.name }) }}</template>
          <template v-else-if="hasMatchStats">{{ t('match.sourceOfficial', { league: data.competition.name }) }}</template>
          <template v-else>{{ t('match.sourceResults', { league: data.competition.name }) }}</template>
        </p>
      </section>

      <section v-if="data.extras?.lineups" class="block" aria-labelledby="lineups-title">
        <NewsSectionTitle id="lineups-title">{{ t('match.lineups') }}</NewsSectionTitle>
        <NewsLineups
          :lineups="data.extras.lineups"
          :teams="{ home: { name: match.home.shortName, logo: match.home.logo }, away: { name: match.away.shortName, logo: match.away.logo } }"
          :timeline="data.extras.timeline"
        />
      </section>

      <p v-if="data.extras" class="source">
        <template v-if="data.extras.referee">{{ t('match.referee', { name: data.extras.referee }) }} · </template>
        {{ t('match.matchData', { source: data.extras.source.name }) }}
      </p>

      <section v-if="match.goals.length && !data.extras?.timeline.length" class="block" aria-labelledby="goals-title">
        <NewsSectionTitle id="goals-title">{{ t('match.goals') }}</NewsSectionTitle>
        <ol class="goals">
          <li v-for="g in match.goals" :key="g.id" class="goal num" :class="`goal--${g.side}`">
            <span class="clock">{{ g.clockLabel }}</span>
            <img v-if="match[g.side].logo" :src="match[g.side].logo!" :alt="match[g.side].shortName" width="22" height="22" class="goal-crest">
            <span v-else class="goal-crest goal-crest--text">{{ match[g.side].shortName.slice(0, 3) }}</span>
            <span class="scorer">{{ g.scorer.name }}</span>
            <span class="running">{{ g.homeScore }}–{{ g.awayScore }}</span>
            <span v-if="g.tags.length" class="tags">{{ g.tags.map(tag => t(`match.tags.${tag}`)).join(', ') }}</span>
          </li>
        </ol>
      </section>
      <p v-else-if="!data.competition.hasScoringEvents && finished" class="source">{{ t('match.noScorers') }}</p>

      <NewsPressCard :competition-id="data.competition.id" :match-id="match.id" />
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

.hero { text-align: center; padding: 16px 0 0; }
.kicker {
  margin: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; font-size: 11px; line-height: 16px;
  font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta);
}
.title { margin: 10px 0 0; font-size: clamp(26px, 4vw, 36px); line-height: 1.22; font-weight: 700; color: var(--headline); }
.meta { margin: 10px 0 0; font-size: 14px; color: var(--summary); }
.visual { margin-top: 20px; }
@media (min-width: 640px) { .visual { aspect-ratio: 21 / 9; } }

.block { margin-top: 50px; }
.source { margin: 16px 0 0; text-align: center; font-size: 13px; color: var(--meta); }

.preview-banner {
  margin: 12px 0 0; padding: 10px 14px; border-radius: 4px; background: var(--accent); color: var(--on-accent);
  font-size: 14px; font-weight: 700; text-align: center;
}
.desk {
  margin-top: 24px; padding: 10px 10px 10px 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px;
  border-radius: 4px; background: var(--surface); font-size: 14px; color: var(--summary);
}
.desk strong { margin-right: 6px; color: var(--headline); }
.desk-edit {
  min-height: 44px; padding: 0 16px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
  background: var(--headline); color: var(--bg); font-weight: 700; text-decoration: none;
}
.desk-edit:hover { background: var(--link-hover); }
.desk-edit:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cover { margin-bottom: 0; }
.cover img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 4px; background: var(--surface); }
@media (min-width: 640px) { .cover { aspect-ratio: auto; } .cover img { aspect-ratio: 21 / 9; } }
.cover figcaption { margin-top: 6px; font-size: 12px; text-align: left; color: var(--meta); }
.article-kicker { margin: 0; font-size: 13px; color: var(--meta); }
.plus { font-weight: 700; color: var(--accent-ink); }
.article-headline { margin: 6px 0 0; font-size: clamp(22px, 3vw, 28px); line-height: 1.29; font-weight: 700; color: var(--headline); }
.article-body { margin-top: 14px; font-size: 17px; line-height: 1.65; color: var(--text-2); }
.article-body :deep(p), .article-body :deep(ul), .article-body :deep(ol) { margin: 0 0 16px; }
.article-body :deep(h2) { margin: 28px 0 10px; font-size: 22px; line-height: 1.3; color: var(--headline); }
.article-body :deep(h3) { margin: 24px 0 8px; font-size: 18px; line-height: 1.35; color: var(--headline); }
.article-body :deep(blockquote) { margin: 0 0 16px; padding: 4px 0 4px 18px; border-left: 3px solid var(--accent); color: var(--headline); font-style: italic; }
.article-body :deep(a) { color: var(--link-hover); }
.article-body :deep(li) { margin-bottom: 6px; }

.goals { list-style: none; margin: 0; padding: 0; }
.goal {
  display: grid; grid-template-columns: 56px 22px 1fr auto; gap: 4px 12px; align-items: baseline;
  padding: 12px 0; border-bottom: 1px solid var(--line); color: var(--headline);
}
.goal:last-child { border-bottom: 0; }
.clock { color: var(--meta); font-size: 14px; }
.scorer { font-weight: 600; }
.running { font-weight: 700; }
.goal-crest { object-fit: contain; align-self: center; }
.goal-crest--text { font-size: 11px; font-weight: 700; color: var(--meta); text-transform: uppercase; }
.tags { grid-column: 3 / -1; font-size: 12px; color: var(--meta); }
</style>
