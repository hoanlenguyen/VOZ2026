<script setup lang="ts">
// AI match preview ("paper") on an upcoming match (server/utils/paper-agent.ts): breaking-news
// headline, standfirst, then team news and injuries, each side's strengths and weaknesses, press
// talking points and insights; every report attributed to its outlet with a numbered link.
// Subscribers read it all (a first run takes about a minute); free and signed-out readers get the
// headline and standfirst, fading into the VOZ Plus offer. The newsroom also sees how it was made.
import { PhLockSimple, PhNewspaper } from '@phosphor-icons/vue'
import type { PaperResponse, PaperSectionKind, PaperSentence } from '#shared/types/match-paper'

const props = defineProps<{ competitionId: string, matchId: string, home: string, away: string }>()
const { t, locale } = useI18n()
const { stamp } = useFormat()
const { can, account } = useAccount()
const route = useRoute()

const { data, status } = useLazyFetch<PaperResponse>(
  () => `/api/competitions/${props.competitionId}/matches/${props.matchId}/paper`,
  { query: { lang: locale }, server: false, timeout: 240_000 },
)
const paper = computed(() => data.value?.paper ?? null)
const articles = computed(() => (paper.value?.sources ?? []).filter(s => s.kind === 'article'))
// Articles are numbered in the order the paper lists them.
const number = computed(() => new Map(articles.value.map((s, i) => [s.id, i + 1])))
const outlets = computed(() => new Set(articles.value.map(s => s.outlet)).size)
const refs = (s: PaperSentence) => s.sources.map(id => ({ id, n: number.value.get(id), src: articles.value.find(a => a.id === id) })).filter(r => r.n)
const ORDER: PaperSectionKind[] = ['team-news', 'home', 'away', 'press', 'insight']
const sections = computed(() => [...(paper.value?.sections ?? [])].filter(s => s.sentences.length).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)))
const title = (kind: PaperSectionKind) => kind === 'home' || kind === 'away'
  ? t('paper.sections.team', { team: kind === 'home' ? props.home : props.away })
  : t(`paper.sections.${kind}`)
const inviteLink = computed(() => (account.value ? '/account' : { path: '/login', query: { redirect: route.fullPath } }))
const visible = computed(() => status.value === 'pending' ? can.value.premium : !!paper.value)
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`
</script>

<template>
  <section v-if="visible" class="block paper" aria-labelledby="paper-title">
    <p class="kicker">
      <span class="breaking">{{ t('paper.breaking') }}</span>
      <span v-if="can.newsroom" class="ai-tag">{{ t('story.aiTag') }}</span>
    </p>

    <div v-if="status === 'pending'" class="loading" aria-live="polite">
      <span class="sk sk--title" /><span class="sk" /><span class="sk" /><span class="sk sk--short" />
      <p class="note"><PhNewspaper :size="14" weight="bold" aria-hidden="true" /> {{ t('paper.writing') }}</p>
    </div>

    <article v-else-if="paper" :lang="paper.lang">
      <h2 id="paper-title" class="headline">{{ paper.headline }}</h2>
      <p class="meta num">{{ t('paper.meta', { n: outlets, time: stamp(paper.generatedAt) }, outlets) }}</p>
      <p class="standfirst" :class="{ 'standfirst--locked': data?.locked }">
        {{ paper.standfirst.text }}<sup v-if="refs(paper.standfirst).length && !data?.locked" class="refs"><a
          v-for="r in refs(paper.standfirst)" :key="r.id" :href="r.src!.url!" target="_blank" rel="noopener noreferrer nofollow"
          class="ref num" :aria-label="t('paper.sourceLink', { n: r.n, outlet: r.src!.outlet })"
        >{{ r.n }}</a></sup>
      </p>

      <div v-if="data?.locked" class="invite">
        <PhLockSimple :size="26" weight="bold" class="invite-icon" aria-hidden="true" />
        <p class="invite-title">{{ t('paper.lockedTitle') }}</p>
        <p class="invite-text">{{ t(account ? 'paper.lockedFree' : 'paper.lockedSignedOut') }}</p>
        <NuxtLink :to="inviteLink" class="invite-cta">{{ account ? t('discussion.subscribe') : t('nav.signIn') }}</NuxtLink>
      </div>

      <template v-else>
        <section v-for="sec in sections" :key="sec.kind" class="part" :class="`part--${sec.kind}`">
          <h3 class="part-title">{{ title(sec.kind) }}</h3>
          <p class="para">
            <template v-for="(s, i) in sec.sentences" :key="i">
              {{ s.text }}<sup v-if="refs(s).length" class="refs"><a
                v-for="r in refs(s)" :key="r.id" :href="r.src!.url!" target="_blank" rel="noopener noreferrer nofollow"
                class="ref num" :aria-label="t('paper.sourceLink', { n: r.n, outlet: r.src!.outlet })"
              >{{ r.n }}</a></sup>{{ ' ' }}
            </template>
          </p>
        </section>
        <p class="note">{{ t('paper.disclaimer') }} <a href="#press-title" class="press-link">{{ t('paper.seePress', { section: t('press.title') }) }}</a></p>
        <details v-if="can.newsroom" class="how">
          <summary>{{ t('paper.how') }}</summary>
          <p>{{ t('paper.howText', { read: paper.articlesRead, model: modelLabel(paper.model) }) }}</p>
          <ol class="steps">
            <li v-for="(s, i) in paper.trace" :key="i"><span class="step-tool">{{ s.tool }}</span> {{ s.summary }} <span class="num step-ms">{{ seconds(s.ms) }}</span></li>
          </ol>
        </details>
      </template>
    </article>
  </section>
</template>

<style scoped>
.block { margin-top: 40px; }
.kicker { margin: 0 0 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.breaking { padding: 2px 8px; border-radius: 3px; background: var(--loss); color: var(--board-text); }
.ai-tag { padding: 1px 6px; border: 1px solid var(--link-hover); border-radius: 3px; color: var(--link-hover); }
.headline { margin: 0; font-size: clamp(24px, 3.4vw, 32px); line-height: 1.22; font-weight: 700; color: var(--headline); }
.meta { margin: 8px 0 0; font-size: 13px; color: var(--meta); }
.standfirst { margin: 14px 0 0; font-size: 19px; line-height: 1.55; font-weight: 500; color: var(--headline); }
.standfirst--locked { -webkit-mask-image: linear-gradient(to bottom, black 45%, transparent 100%); mask-image: linear-gradient(to bottom, black 45%, transparent 100%); }
.part { margin-top: 22px; }
.part-title { margin: 0 0 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta); }
.part--insight { padding: 14px 16px; border-left: 3px solid var(--accent); border-radius: 0 4px 4px 0; background: var(--surface); }
.part--insight .part-title { color: var(--headline); }
.para { margin: 0; font-size: 17px; line-height: 1.65; color: var(--text-2); }
.refs { margin-left: 1px; font-size: 11px; }
.ref { margin-right: 2px; padding: 0 3px; border-radius: 3px; background: var(--surface); color: var(--link-hover); font-weight: 700; text-decoration: none; }
.part--insight .ref { background: var(--bg); }
.ref:hover { text-decoration: underline; }
.ref:focus-visible, .press-link:focus-visible, .invite-cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.press-link { color: var(--link-hover); font-weight: 600; }
.note { margin: 16px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-size: 13px; color: var(--meta); }
.how { margin-top: 12px; border-top: 1px solid var(--line); padding-top: 8px; font-size: 14px; color: var(--summary); }
.how summary { min-height: 40px; display: flex; align-items: center; cursor: pointer; font-weight: 600; color: var(--headline); }
.steps { margin: 6px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.step-tool { font-family: ui-monospace, monospace; font-size: 12px; color: var(--headline); }
.step-ms { color: var(--meta); }
.loading { display: flex; flex-direction: column; gap: 10px; }
.sk { display: block; height: 14px; border-radius: 4px; background: var(--surface); }
.sk--title { width: 75%; height: 26px; margin-bottom: 6px; }
.sk--short { width: 50%; }
@media (prefers-reduced-motion: no-preference) {
  .sk { animation: pulse 1.2s ease-in-out infinite alternate; }
  @keyframes pulse { from { opacity: 1; } to { opacity: 0.5; } }
}
.invite {
  margin-top: 4px; padding: 22px 16px; border-radius: 4px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: var(--offer-bg); color: var(--offer-text);
}
.invite-icon { color: var(--offer-ink); }
.invite-title { margin: 0; font-size: 18px; font-weight: 700; }
.invite-text { margin: 0; max-width: 440px; font-size: 14px; line-height: 1.5; }
.invite-cta {
  margin-top: 6px; min-height: 44px; padding: 0 20px; display: inline-flex; align-items: center; border-radius: 999px;
  background: var(--offer-ink); color: var(--offer-bg); font-weight: 700; text-decoration: none;
}
.invite-cta:hover { background: var(--offer-ink-hover); color: var(--offer-bg); }
</style>
