<script setup lang="ts">
// News front page layout (lead story, side stories, card row, AI podcasts, latest list + sidebar),
// filled with stories generated from live league data. Used by "News" (/) and, with `favourites`,
// by "My favourites" (/favourites): the same layout with only what the account follows (stories of
// followed leagues, teams and players' teams; their fixtures in the ticker; their league tables).
import { PhLockSimple } from '@phosphor-icons/vue'
import type { Story } from '#shared/types/stories'
import type { PreferenceOptions, Preferences } from '#shared/types/preferences'

const props = defineProps<{ favourites?: boolean }>()
const { t, locale } = useI18n()
const { can, account } = useAccount()
const route = useRoute()

const { data, error, status } = await useFetch('/api/landing', { query: { lang: locale } })

// Favourites: the account's preferences (saved, or its followed teams by default).
const { data: prefData } = await useFetch<{ preferences: Preferences | null, options: PreferenceOptions }>('/api/preferences', {
  query: { lang: locale }, immediate: !!props.favourites && !!account.value,
})
const prefs = computed(() => prefData.value?.preferences ?? null)
const followed = computed(() => {
  const p = prefs.value
  const players = (prefData.value?.options.players ?? []).filter(x => p?.players.includes(x.key))
  const teams = new Set([...(p?.teams ?? []), ...players.map(x => x.teamKey)])
  return { teams, leagues: new Set(p?.leagues ?? []) }
})
// Free and signed-out readers: My favourites is a VOZ Plus feature (the page shows the invitation).
const lockedFavourites = computed(() => !!props.favourites && !can.value.premium)
const hasFavourites = computed(() => followed.value.teams.size + followed.value.leagues.size > 0)
const isFavourite = (s: Story) => followed.value.leagues.has(s.competitionId)
  || followed.value.teams.has(s.match.home.key) || followed.value.teams.has(s.match.away.key)
const pool = computed(() => (data.value?.stories ?? []).filter(s => !props.favourites || (!lockedFavourites.value && isFavourite(s))))

type Filter = { id: string, label: string, match: (s: Story) => boolean }
const filters = computed<Filter[]>(() => {
  if (props.favourites) {
    const teams = (prefData.value?.options.teams ?? []).filter(x => followed.value.teams.has(x.key))
    const leagues = (prefData.value?.options.leagues ?? []).filter(x => followed.value.leagues.has(x.id))
    return [
      { id: 'all', label: t('favourites.all'), match: () => true },
      ...teams.map(x => ({ id: x.key, label: x.shortName, match: (s: Story) => s.match.home.key === x.key || s.match.away.key === x.key })),
      ...leagues.map(x => ({ id: x.id, label: x.name, match: (s: Story) => s.competitionId === x.id })),
    ]
  }
  const comps = [...new Map(pool.value.map(s => [s.competitionId, s.competitionName]))]
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
  return pool.value.filter(f.match)
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

// Favourites: fixtures of followed leagues and teams; tables of followed leagues (teams marked).
const teamNames = computed(() => new Set((prefData.value?.options.teams ?? []).filter(x => followed.value.teams.has(x.key)).flatMap(x => [x.shortName, x.name])))
const ticker = computed(() => {
  const all = data.value?.ticker ?? []
  if (!props.favourites) return all
  if (lockedFavourites.value) return []
  return all.map(l => followed.value.leagues.has(l.competitionId)
    ? l
    : { ...l, fixtures: l.fixtures.filter(f => teamNames.value.has(f.home.name) || teamNames.value.has(f.away.name)) })
    .filter(l => l.fixtures.length)
})
const teamLeagues = computed(() => new Set(pool.value.map(s => s.competitionId)))
const tables = computed(() => (data.value?.tables ?? []).filter(x => !props.favourites || (!lockedFavourites.value && (followed.value.leagues.has(x.competitionId) || teamLeagues.value.has(x.competitionId)))))
const loginLink = computed(() => ({ path: '/login', query: { redirect: route.fullPath } }))
</script>

<template>
  <main id="main">
    <NewsFixtureTicker v-if="ticker.length" :leagues="ticker" />

    <div class="wrap">
      <h1 class="page-title">{{ favourites ? t('favourites.title') : t('home.title') }}</h1>
      <template v-if="favourites">
        <p class="fav-lead">
          {{ t('favourites.lead') }}
          <NuxtLink v-if="can.premium && !can.newsroom" to="/my-teams" class="fav-edit">{{ t('favourites.edit') }}</NuxtLink>
        </p>
        <div v-if="can.newsroom" class="notice fav-notice"><p>{{ t('favourites.newsroom') }}</p></div>
        <div v-else-if="lockedFavourites" class="fav-locked">
          <PhLockSimple :size="28" weight="bold" class="fav-locked-icon" aria-hidden="true" />
          <p class="fav-locked-title">{{ t('favourites.lockedTitle') }}</p>
          <p class="fav-locked-text">{{ t(account ? 'favourites.lockedText' : 'favourites.lockedSignedOut') }}</p>
          <NuxtLink v-if="account" to="/account" class="fav-locked-cta">{{ t('discussion.subscribe') }}</NuxtLink>
          <NuxtLink v-else :to="loginLink" class="fav-locked-cta">{{ t('nav.signIn') }}</NuxtLink>
        </div>
        <div v-else-if="prefData && !hasFavourites" class="notice fav-notice">
          <p>{{ t('favourites.none') }}</p>
          <NuxtLink to="/my-teams" class="fav-cta">{{ t('favourites.choose') }}</NuxtLink>
        </div>
      </template>
      <nav v-if="!favourites || (hasFavourites && !lockedFavourites)" class="sections" :aria-label="t('home.sections')">
        <button
          v-for="f in filters" :key="f.id" type="button" class="section-tab"
          :aria-pressed="active === f.id" @click="active = f.id"
        >
          {{ f.label }}
        </button>
      </nav>

      <p v-if="error" class="notice">{{ t('home.loadError', { reason: error.statusMessage }) }}</p>
      <p v-else-if="status === 'success' && !stories.length && (!favourites || (hasFavourites && !lockedFavourites))" class="notice">{{ favourites ? t('favourites.empty') : t('home.empty') }}</p>
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

      <NewsPodcastShelf />

      <div v-if="latest.length || tables.length" class="latest-wrap">
        <section class="latest" aria-labelledby="latest-title">
          <NewsSectionTitle id="latest-title">{{ t('home.latest') }}</NewsSectionTitle>
          <NewsStoryCard v-for="s in latest" :key="s.id" :story="s" variant="row" />
          <p v-if="!latest.length" class="notice notice--soft">{{ t('home.allAbove') }}</p>
        </section>
        <!-- Tables first; on wide screens the advertisers' posts are spread down the rest of the long
             column (one roughly every screen of the Latest list), never inside the stories. -->
        <aside class="sidebar" :aria-label="t('home.sidebar')">
          <div class="tables">
            <NewsTableWidget v-for="x in tables" :key="x.competitionId" :table="x" :highlight="favourites ? [...followed.teams] : []" />
          </div>
          <template v-if="can.ads">
            <NewsAdCard kind="shop" />
            <NewsAdTall />
            <NewsAdCard kind="event" />
            <NewsAdCard kind="league" />
          </template>
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
.fav-locked {
  margin: 8px 0 40px; padding: 32px 20px; border-radius: 4px; text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: 8px; background: var(--offer-bg); color: var(--offer-text);
}
.fav-locked-icon { color: var(--offer-ink); }
.fav-locked-title { margin: 0; font-size: 20px; font-weight: 700; }
.fav-locked-text { margin: 0; max-width: 480px; line-height: 1.5; }
.fav-locked-cta {
  margin-top: 6px; min-height: 44px; padding: 0 22px; display: inline-flex; align-items: center; border-radius: 999px;
  background: var(--offer-ink); color: var(--offer-bg); font-weight: 700; text-decoration: none;
}
.fav-locked-cta:hover { background: var(--offer-ink-hover); color: var(--offer-bg); }
.fav-locked-cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.fav-lead { margin: -8px 0 20px; text-align: center; color: var(--summary); }
.fav-edit { margin-left: 6px; font-weight: 700; color: var(--link-hover); }
.fav-notice { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.fav-notice p { margin: 0; }
.fav-cta {
  min-height: 44px; padding: 0 20px; display: inline-flex; align-items: center; border-radius: 999px;
  background: var(--accent); color: var(--on-accent); font-weight: 700; text-decoration: none;
}
.fav-cta:focus-visible, .fav-edit:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
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
/* The sidebar (tables, ads) stays beside the list down to tablet width, also when zoomed in. */
@media (min-width: 768px) { .latest-wrap { grid-template-columns: minmax(0, 1fr) clamp(230px, 30vw, 300px); } }
.sidebar { display: flex; flex-direction: column; gap: 24px; }
.tables { display: flex; flex-direction: column; gap: 24px; }
@media (min-width: 768px) {
  .sidebar { align-self: stretch; justify-content: space-between; }
}
</style>
