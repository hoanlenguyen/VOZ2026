<script setup lang="ts">
// My teams: the reader's favourite teams, leagues and players (server/utils/preferences.ts). Choices
// are mock data for the demo (Ipswich and Nott'm Forest, their line-up players, every competition
// we cover). Signed out: asked to sign in. Free: may choose, and "Save" asks them to subscribe.
// Subscribers: saved as they choose. Newsroom accounts: no favourites (not a reader account).
import { PhCaretDown, PhCheck, PhLockSimple, PhMagnifyingGlass, PhStar, PhX } from '@phosphor-icons/vue'
import type { Preferences } from '#shared/types/preferences'

definePageMeta({ layout: 'news' })
const { t, locale } = useI18n()
const { account, can } = useAccount()
const reader = computed(() => !!account.value && !can.value.newsroom)
const route = useRoute()
useHead({ title: () => t('prefs.pageTitle') })

const { data, error } = await useFetch('/api/preferences', { query: { lang: locale } })
const prefs = reactive<Preferences>({ teams: [], leagues: [], players: [] })
watch(() => data.value?.preferences, (p) => { if (p) Object.assign(prefs, structuredClone(toRaw(p))) }, { immediate: true })

// Subscribers: saved as they choose (one request per burst of clicks). Free accounts: changes stay
// on the page until "Save", which asks them to subscribe (the server refuses their save too).
const status = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const unsaved = ref(false)
const offer = ref<HTMLDialogElement>()
let timer: ReturnType<typeof setTimeout> | undefined
function toggle(list: keyof Preferences, key: string) {
  const i = prefs[list].indexOf(key)
  if (i >= 0) prefs[list].splice(i, 1)
  else prefs[list].push(key)
  if (!can.value.premium) {
    unsaved.value = true
    return
  }
  status.value = 'saving'
  clearTimeout(timer)
  timer = setTimeout(save, 400)
}
async function save() {
  try {
    await $fetch('/api/preferences', { method: 'PUT', query: { lang: locale.value }, body: { ...prefs } })
    status.value = 'saved'
  }
  catch {
    status.value = 'error'
  }
}
const has = (list: keyof Preferences, key: string) => prefs[list].includes(key)

const options = computed(() => data.value?.options)
const teamByKey = computed(() => new Map((options.value?.teams ?? []).map(team => [team.key, team])))
const leaguesBySport = computed(() => {
  const groups = new Map<string, NonNullable<typeof options.value>['leagues']>()
  for (const l of options.value?.leagues ?? []) groups.set(l.sport, [...(groups.get(l.sport) ?? []), l])
  return [...groups.entries()]
})

// Players: search by name and filter by team.
const query = ref('')
const teamFilter = ref<'all' | string>('all')
const players = computed(() => {
  const q = query.value.trim().toLowerCase()
  return (options.value?.players ?? []).filter(p =>
    (teamFilter.value === 'all' || p.teamKey === teamFilter.value) && (!q || p.name.toLowerCase().includes(q)))
})
const POSITIONS = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']
const position = (p: string | null) => (p && POSITIONS.includes(p) ? t(`prefs.positions.${p.toLowerCase()}`) : p ?? '')
const loginLink = computed(() => ({ path: '/login', query: { redirect: route.fullPath } }))
</script>

<template>
  <main id="main" class="wrap">
    <h1 class="title">{{ t('prefs.title') }}</h1>
    <p class="lead">{{ t('prefs.lead') }}</p>

    <p v-if="error" class="notice" role="alert">{{ t('prefs.loadError', { reason: error.statusMessage }) }}</p>

    <div v-else-if="!account" class="signin">
      <p>{{ t('prefs.signIn') }}</p>
      <NuxtLink :to="loginLink" class="btn-primary">{{ t('nav.signIn') }}</NuxtLink>
    </div>

    <div v-else-if="!reader" class="signin">
      <p>{{ t('prefs.newsroom') }}</p>
      <NuxtLink to="/newsroom" class="btn-primary">{{ t('nav.newsroom') }}</NuxtLink>
    </div>

    <template v-else-if="options">
      <!-- What the reader follows, as stat cards; the save state sits under them. -->
      <ul class="stats" :aria-label="t('prefs.statsLabel')">
        <li v-for="k in (['teams', 'leagues', 'players'] as const)" :key="k" class="stat">
          <span class="stat-n num">{{ prefs[k].length }}</span>
          <span class="stat-l">{{ t(`prefs.count.${k}Label`, prefs[k].length) }}</span>
        </li>
      </ul>
      <p class="summary" role="status" aria-live="polite">
        <span v-if="status === 'saving'" class="state">{{ t('prefs.saving') }}</span>
        <span v-else-if="status === 'saved'" class="state state--ok"><PhCheck :size="14" weight="bold" aria-hidden="true" /> {{ t('prefs.saved') }}</span>
        <span v-else-if="status === 'error'" class="state state--error">{{ t('prefs.saveError') }}</span>
      </p>

      <section class="block" aria-labelledby="teams-title">
        <NewsSectionTitle id="teams-title">{{ t('prefs.teams') }}</NewsSectionTitle>
        <ul class="teams">
          <li v-for="team in options.teams" :key="team.key">
            <button
              type="button" class="team" :class="{ 'team--on': has('teams', team.key) }" :aria-pressed="has('teams', team.key)"
              @click="toggle('teams', team.key)"
            >
              <img v-if="team.logo" :src="team.logo" alt="" width="48" height="48">
              <span class="team-text">
                <strong>{{ team.name }}</strong>
                <span>{{ team.competitionName }}</span>
              </span>
              <span class="follow">
                <PhCheck v-if="has('teams', team.key)" :size="14" weight="bold" aria-hidden="true" />
                {{ has('teams', team.key) ? t('prefs.following') : t('prefs.follow') }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section class="block" aria-labelledby="leagues-title">
        <NewsSectionTitle id="leagues-title">{{ t('prefs.leagues') }}</NewsSectionTitle>
        <div v-for="[sport, leagues] in leaguesBySport" :key="sport" class="sport">
          <h3 class="sport-title">{{ t(`sport.${sport}`) }}</h3>
          <ul class="chips">
            <li v-for="l in leagues" :key="l.id">
              <button
                type="button" class="pill" :class="{ 'pill--on': has('leagues', l.id) }" :aria-pressed="has('leagues', l.id)"
                :disabled="!l.available" @click="toggle('leagues', l.id)"
              >
                <PhCheck v-if="has('leagues', l.id)" :size="14" weight="bold" aria-hidden="true" />
                {{ l.name }}<span class="pill-country"> · {{ l.country }}</span>
                <span v-if="!l.available" class="pill-note">{{ t('prefs.unavailable') }}</span>
              </button>
            </li>
          </ul>
        </div>
      </section>

      <section class="block" aria-labelledby="players-title">
        <NewsSectionTitle id="players-title">{{ t('prefs.players') }}</NewsSectionTitle>
        <div class="filters">
          <label class="search">
            <PhMagnifyingGlass :size="18" aria-hidden="true" />
            <span class="sr-only">{{ t('prefs.searchPlayers') }}</span>
            <input v-model="query" type="search" :placeholder="t('prefs.searchPlayers')">
          </label>
          <label class="team-filter">
            <span class="sr-only">{{ t('prefs.filterTeam') }}</span>
            <select v-model="teamFilter">
              <option value="all">{{ t('prefs.allTeams') }}</option>
              <option v-for="team in options.teams" :key="team.key" :value="team.key">{{ team.shortName }}</option>
            </select>
            <PhCaretDown :size="16" aria-hidden="true" />
          </label>
        </div>
        <ul class="players">
          <li v-for="p in players" :key="p.key" class="player">
            <span class="shirt num">{{ p.number ?? '–' }}</span>
            <img v-if="teamByKey.get(p.teamKey)?.logo" :src="teamByKey.get(p.teamKey)!.logo!" alt="" width="22" height="22" class="crest">
            <span class="player-text">
              <strong>{{ p.name }}</strong>
              <span>{{ position(p.position) }} · {{ teamByKey.get(p.teamKey)?.shortName }}</span>
            </span>
            <button
              type="button" class="star" :class="{ 'star--on': has('players', p.key) }" :aria-pressed="has('players', p.key)"
              :aria-label="t('prefs.favouritePlayer', { name: p.name })" @click="toggle('players', p.key)"
            >
              <PhStar :size="20" :weight="has('players', p.key) ? 'fill' : 'regular'" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <p v-if="!players.length" class="hint">{{ t('prefs.noPlayers') }}</p>
      </section>
      <p class="hint demo">{{ t('prefs.demoNote') }}</p>

      <!-- Free accounts: choices stay on the page; saving asks them to subscribe. -->
      <div v-if="!can.premium" class="save-bar">
        <span>{{ unsaved ? t('prefs.unsaved') : t('prefs.freeNote') }}</span>
        <button type="button" class="btn-primary" :disabled="!unsaved" @click="offer?.showModal()">{{ t('prefs.save') }}</button>
      </div>
      <dialog ref="offer" class="offer" aria-labelledby="offer-title">
        <button type="button" class="close" :aria-label="t('prefs.close')" @click="offer?.close()">
          <PhX :size="20" weight="bold" aria-hidden="true" />
        </button>
        <PhLockSimple :size="32" weight="bold" class="offer-icon" aria-hidden="true" />
        <h2 id="offer-title" class="offer-title">{{ t('prefs.offerTitle') }}</h2>
        <p class="offer-text">{{ t('prefs.offerText') }}</p>
        <div class="offer-actions">
          <NuxtLink to="/account" class="btn-primary">{{ t('prefs.subscribe') }}</NuxtLink>
          <button type="button" class="btn-secondary" @click="offer?.close()">{{ t('prefs.notNow') }}</button>
        </div>
      </dialog>
    </template>
  </main>
</template>

<style scoped>
.wrap { max-width: calc(760px + 2 * 16px); margin: 0 auto; padding: 32px 16px 0; }
@media (min-width: 768px) { .wrap { max-width: calc(760px + 2 * 30px); padding: 32px 30px 0; } }
.title { margin: 0; font-size: 32px; line-height: 1.2; font-weight: 700; color: var(--headline); }
.lead { margin: 8px 0 0; color: var(--summary); }
.notice { margin: 24px 0; padding: 14px 16px; border-radius: 4px; background: var(--surface); color: var(--text-2); }
.signin { margin-top: 24px; padding: 20px; border-radius: 4px; background: var(--surface); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; color: var(--text-2); }
.signin p { margin: 0; }
.btn-primary {
  min-height: 44px; padding: 0 20px; display: inline-flex; align-items: center; border-radius: 999px;
  background: var(--accent); color: var(--on-accent); font-weight: 700; text-decoration: none;
}
.stats { list-style: none; margin: 24px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.stat { padding: 16px; border: 1px solid var(--line-strong); border-radius: 4px; display: flex; flex-direction: column; gap: 4px; }
.stat-n { font-family: var(--font-display); font-size: 36px; line-height: 1; font-weight: 700; color: var(--headline); }
.stat-l { font-size: 13px; color: var(--summary); }
.summary { min-height: 20px; margin: 10px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; font-size: 14px; color: var(--summary); }
.state { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: var(--meta); }
.state--ok { color: var(--win); }
.state--error { color: var(--loss); }
.block { margin-top: 40px; }
.hint { margin: 12px 0 0; font-size: 13px; color: var(--meta); }
.demo { margin-top: 32px; }

.teams { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
@media (min-width: 640px) { .teams { grid-template-columns: 1fr 1fr; } }
.team {
  width: 100%; min-height: 80px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; text-align: left;
  border: 1px solid var(--line-strong); border-radius: 4px; background: var(--bg); color: var(--headline);
  transition: border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}
.team:hover { border-color: var(--border-control); }
.team--on { border: 2px solid var(--headline); padding: 13px 15px; background: var(--surface); }
.team img { object-fit: contain; flex: 0 0 auto; }
.team-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--meta); }
.team-text strong { font-size: 17px; color: var(--headline); }
.follow {
  flex: 0 0 auto; min-height: 36px; padding: 0 14px; display: inline-flex; align-items: center; gap: 4px; border-radius: 999px;
  border: 1px solid var(--border-control); font-size: 13px; font-weight: 700;
}
.team--on .follow { background: var(--headline); border-color: var(--headline); color: var(--bg); }

.sport + .sport { margin-top: 18px; }
.sport-title { margin: 0 0 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.pill {
  min-height: 40px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
  border: 1px solid var(--line-strong); background: var(--bg); color: var(--headline); font-size: 14px; font-weight: 600;
}
.pill:hover:not(:disabled) { border-color: var(--border-control); }
.pill--on { background: var(--headline); border-color: var(--headline); color: var(--bg); }
.pill-country { font-weight: 400; opacity: 0.75; }
.pill-note { font-size: 12px; font-weight: 400; }
.pill:disabled { opacity: 0.5; cursor: not-allowed; }

.filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 12px; }
.search {
  flex: 1 1 220px; min-height: 44px; padding: 0 12px; display: flex; align-items: center; gap: 8px;
  border: 1px solid var(--border-control); border-radius: 4px; background: var(--bg); color: var(--meta);
}
.search input { flex: 1 1 auto; min-width: 0; border: 0; background: none; font: inherit; color: var(--headline); outline: none; }
.search:focus-within { outline: 2px solid var(--accent); outline-offset: 1px; }
.team-filter { position: relative; flex: 0 1 220px; min-width: 160px; display: flex; align-items: center; color: var(--meta); }
.team-filter select {
  width: 100%; min-height: 44px; padding: 0 36px 0 12px; appearance: none; cursor: pointer;
  border: 1px solid var(--border-control); border-radius: 4px; background: var(--bg);
  font: inherit; font-size: 15px; color: var(--headline);
}
.team-filter select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.team-filter svg { position: absolute; right: 12px; pointer-events: none; }

.players { list-style: none; margin: 0; padding: 0; }
.player { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.shirt { width: 28px; text-align: center; font-weight: 700; color: var(--meta); }
.crest { object-fit: contain; flex: 0 0 auto; }
.player-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; font-size: 13px; color: var(--meta); }
.player-text strong { font-size: 15px; color: var(--headline); }
.star { width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 999px; background: none; color: var(--meta); }
.star:hover { background: var(--surface); color: var(--headline); }
.star--on { color: var(--accent-ink); }
.save-bar {
  position: sticky; bottom: 16px; z-index: 5; margin-top: 24px; padding: 12px 12px 12px 18px;
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
  border-radius: 8px; background: var(--headline); color: var(--bg); font-size: 14px; font-weight: 600;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { border: 0; font-size: 15px; }
.btn-secondary {
  min-height: 44px; padding: 0 20px; border-radius: 999px; border: 1px solid var(--border-control);
  background: var(--bg); color: var(--headline); font-size: 15px; font-weight: 700;
}
.offer {
  width: min(440px, calc(100vw - 32px)); padding: 28px 24px 24px; border: 0; border-radius: 8px; text-align: center;
  background: var(--offer-bg); color: var(--offer-text); box-shadow: 0 24px 64px rgb(0 0 0 / 0.3);
}
.offer::backdrop { background: rgb(0 0 0 / 0.55); }
.offer .close { position: absolute; top: 8px; right: 8px; width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 999px; background: none; color: var(--offer-text); }
.offer-icon { color: var(--offer-ink); }
.offer-title { margin: 10px 0 0; font-size: 22px; line-height: 1.3; }
.offer-text { margin: 8px 0 0; font-size: 15px; line-height: 1.5; }
.offer-actions { margin-top: 20px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.offer .btn-primary { background: var(--offer-ink); color: var(--offer-bg); }
.offer .btn-primary:hover { background: var(--offer-ink-hover); }
.team:focus-visible, .pill:focus-visible, .star:focus-visible, .btn-primary:focus-visible, .btn-secondary:focus-visible, .offer .close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
