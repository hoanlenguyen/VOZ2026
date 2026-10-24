<script setup lang="ts">
// Match page: scoreboard, then a side-by-side comparison counted from the season's results.
// The AI match story is built in Phase 2.
import { PhCaretLeft } from '@phosphor-icons/vue'

definePageMeta({ layout: 'news' })

const route = useRoute()
const { data, error } = await useFetch(`/api/competitions/${route.params.competition}/matches/${route.params.id}`)
const match = computed(() => data.value?.match)
const finished = computed(() => match.value?.status === 'finished')
// Football: "Half-time 1–0"; hockey: "Periods 0–1, 0–1, 0–1".
const periodLine = computed(() => {
  const m = match.value
  if (!m || m.status !== 'finished' || !m.periods.length) return ''
  if (m.sport === 'football') return `Half-time ${m.periods[0]!.home}–${m.periods[0]!.away}`
  return `Periods ${m.periods.map(p => `${p.home}–${p.away}`).join(', ')}`
})
const hasMatchStats = computed(() => data.value?.compare?.groups.some(g => g.id === 'stats') ?? false)

useHead(() => ({
  title: match.value
    ? `${match.value.home.shortName} ${finished.value ? formatScore(match.value) : 'vs'} ${match.value.away.shortName} – VOZ`
    : 'Match – VOZ',
}))
</script>

<template>
  <main id="main" class="wrap">
    <NuxtLink to="/" class="back">
      <PhCaretLeft :size="14" weight="bold" aria-hidden="true" />
      Sports
    </NuxtLink>

    <p v-if="error" class="notice">Could not load the match ({{ error.statusMessage }}). Try again in a minute.</p>

    <template v-else-if="match && data">
      <header class="hero">
        <p class="kicker">
          <span>{{ data.competition.name }}</span>
          <template v-if="match.round">
            <span aria-hidden="true">·</span><span>Matchday {{ match.round }}</span>
          </template>
          <span aria-hidden="true">·</span><span class="num">{{ storyStamp(match.start) }}</span>
        </p>
        <h1 class="title num">
          {{ match.home.shortName }} {{ finished ? formatScore(match) : 'vs' }} {{ match.away.shortName }}
        </h1>
        <p class="meta num">
          <template v-if="periodLine">{{ periodLine }}</template>
          <template v-if="match.venue"><span v-if="periodLine" aria-hidden="true"> · </span>{{ match.venue }}</template>
          <template v-if="match.attendance"> · {{ match.attendance.toLocaleString('en-GB') }} spectators</template>
        </p>
        <NewsMatchVisual :story="{ competitionName: data.competition.name, match }" size="lg" class="visual" />
      </header>

      <section v-if="data.compare" class="block" aria-labelledby="compare-title">
        <NewsSectionTitle id="compare-title">Compare</NewsSectionTitle>
        <NewsStatCompare
          :compare="data.compare"
          :home="{ name: match.home.shortName, logo: match.home.logo }"
          :away="{ name: match.away.shortName, logo: match.away.logo }"
        />
        <p class="source">
          <template v-if="hasMatchStats">Match stats from official {{ data.competition.name }} game data; season numbers counted from official results.</template>
          <template v-else>Counted from official {{ data.competition.name }} results. Shots, possession and cards are not in our data plan yet.</template>
        </p>
      </section>

      <section v-if="match.goals.length" class="block" aria-labelledby="goals-title">
        <NewsSectionTitle id="goals-title">Goals</NewsSectionTitle>
        <ol class="goals">
          <li v-for="g in match.goals" :key="g.id" class="goal num" :class="`goal--${g.side}`">
            <span class="clock">{{ g.clockLabel }}</span>
            <img v-if="match[g.side].logo" :src="match[g.side].logo!" :alt="match[g.side].shortName" width="22" height="22" class="goal-crest">
            <span v-else class="goal-crest goal-crest--text">{{ match[g.side].shortName.slice(0, 3) }}</span>
            <span class="scorer">{{ g.scorer.name }}</span>
            <span class="running">{{ g.homeScore }}–{{ g.awayScore }}</span>
            <span v-if="g.tags.length" class="tags">{{ g.tags.join(', ') }}</span>
          </li>
        </ol>
      </section>
      <p v-else-if="!data.competition.hasScoringEvents && finished" class="source">Goal scorers are not included in this data plan.</p>

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
