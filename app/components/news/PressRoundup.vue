<script setup lang="ts">
// AI press roundup on an upcoming match (server/utils/roundup-agent.ts): a breaking-news headline and
// a short piece from other outlets' headlines (each claim attributed and linked) and VOZ facts.
// Subscribers read it in full (a first view may take ~10 s while it is written); free and signed-out
// readers get the headline and opening, fading into the VOZ Plus offer.
import { PhArrowUpRight, PhLockSimple, PhNewspaper } from '@phosphor-icons/vue'
import type { RoundupResponse } from '#shared/types/roundup'

const props = defineProps<{ competitionId: string, matchId: string }>()
const { t, locale } = useI18n()
const { stamp } = useFormat()
const { can, account } = useAccount()
const route = useRoute()

const { data, status } = useLazyFetch<RoundupResponse>(
  () => `/api/competitions/${props.competitionId}/matches/${props.matchId}/roundup`,
  { query: { lang: locale }, server: false },
)
const roundup = computed(() => data.value?.roundup ?? null)
// Press sources are numbered in the order the roundup first cites them.
const pressNumber = computed(() => new Map((roundup.value?.sources ?? []).filter(s => s.kind === 'press').map((s, i) => [s.id, i + 1])))
const press = computed(() => (roundup.value?.sources ?? []).filter(s => s.kind === 'press'))
const outlets = computed(() => new Set(press.value.map(s => s.outlet)).size)
const paragraphs = computed(() => {
  const groups = new Map<number, NonNullable<typeof roundup.value>['sentences']>()
  for (const s of roundup.value?.sentences ?? []) groups.set(s.paragraph, [...(groups.get(s.paragraph) ?? []), s])
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, x]) => x)
})
const refsOf = (ids: string[]) => ids.map(id => ({ id, n: pressNumber.value.get(id), src: press.value.find(s => s.id === id) })).filter(r => r.n)
const inviteLink = computed(() => (account.value ? '/account' : { path: '/login', query: { redirect: route.fullPath } }))
// The section shows while a subscriber's roundup is being written, and whenever there is one.
const visible = computed(() => status.value === 'pending' ? can.value.premium : !!roundup.value)
</script>

<template>
  <section v-if="visible" class="block roundup" aria-labelledby="roundup-title">
    <p class="kicker">
      <span class="breaking">{{ t('roundup.breaking') }}</span>
      <span>{{ t('roundup.label') }}</span>
      <span v-if="can.newsroom" class="ai-tag">{{ t('story.aiTag') }}</span>
    </p>

    <div v-if="status === 'pending'" class="loading" aria-live="polite">
      <span class="sk sk--title" /><span class="sk" /><span class="sk" /><span class="sk sk--short" />
      <p class="note"><PhNewspaper :size="14" weight="bold" aria-hidden="true" /> {{ t('roundup.writing') }}</p>
    </div>

    <template v-else-if="roundup">
      <h2 id="roundup-title" class="headline">{{ roundup.headline }}</h2>
      <p class="meta num">{{ t('roundup.meta', { n: outlets, time: stamp(roundup.generatedAt) }, outlets) }}</p>

      <div class="body" :class="{ 'body--locked': data?.locked }">
        <p v-for="(para, pi) in paragraphs" :key="pi" class="para">
          <template v-for="(s, si) in para" :key="si">
            {{ s.text }}<sup v-if="refsOf(s.sources).length" class="refs"><a
              v-for="r in refsOf(s.sources)" :key="r.id" :href="r.src!.url!" target="_blank" rel="noopener noreferrer nofollow"
              class="ref num" :aria-label="t('roundup.sourceLink', { n: r.n, outlet: r.src!.outlet })"
            >{{ r.n }}</a></sup>{{ ' ' }}
          </template>
        </p>
      </div>

      <div v-if="data?.locked" class="invite">
        <PhLockSimple :size="26" weight="bold" class="invite-icon" aria-hidden="true" />
        <p class="invite-title">{{ t('roundup.lockedTitle') }}</p>
        <p class="invite-text">{{ t(account ? 'roundup.lockedFree' : 'roundup.lockedSignedOut') }}</p>
        <NuxtLink :to="inviteLink" class="invite-cta">{{ account ? t('discussion.subscribe') : t('nav.signIn') }}</NuxtLink>
      </div>

      <template v-else>
        <h3 class="sources-title">{{ t('roundup.sources') }}</h3>
        <ol class="sources">
          <li v-for="s in press" :key="s.id" :value="pressNumber.get(s.id)">
            <a :href="s.url!" target="_blank" rel="noopener noreferrer nofollow" class="source-link">
              <strong>{{ s.outlet }}</strong> · {{ s.text }} <PhArrowUpRight :size="13" weight="bold" aria-hidden="true" />
            </a>
          </li>
        </ol>
        <p class="note">{{ t('roundup.disclaimer') }}</p>
      </template>
    </template>
  </section>
</template>

<style scoped>
.block { margin-top: 40px; }
.kicker { margin: 0 0 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.breaking { padding: 2px 8px; border-radius: 3px; background: var(--loss); color: var(--board-text); }
.ai-tag { padding: 1px 6px; border: 1px solid var(--link-hover); border-radius: 3px; color: var(--link-hover); }
.headline { margin: 0; font-size: clamp(24px, 3.4vw, 32px); line-height: 1.22; font-weight: 700; color: var(--headline); }
.meta { margin: 8px 0 0; font-size: 13px; color: var(--meta); }
.body { margin-top: 16px; }
.body--locked { -webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 100%); mask-image: linear-gradient(to bottom, black 40%, transparent 100%); }
.para { margin: 0 0 14px; font-size: 17px; line-height: 1.65; color: var(--text-2); }
.refs { margin-left: 1px; font-size: 11px; }
.ref { margin-right: 2px; padding: 0 3px; border-radius: 3px; background: var(--surface); color: var(--link-hover); font-weight: 700; text-decoration: none; }
.ref:hover { text-decoration: underline; }
.ref:focus-visible, .source-link:focus-visible, .invite-cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.sources-title { margin: 20px 0 8px; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta); }
.sources { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 1.45; color: var(--summary); }
.source-link { color: var(--summary); text-decoration: none; }
.source-link:hover { color: var(--link-hover); }
.source-link strong { color: var(--headline); }
.note { margin: 12px 0 0; display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--meta); }
.loading { display: flex; flex-direction: column; gap: 10px; }
.sk { display: block; height: 14px; border-radius: 4px; background: var(--surface); }
.sk--title { width: 75%; height: 26px; margin-bottom: 6px; }
.sk--short { width: 50%; }
@media (prefers-reduced-motion: no-preference) {
  .sk { animation: pulse 1.2s ease-in-out infinite alternate; }
  @keyframes pulse { from { opacity: 1; } to { opacity: 0.5; } }
}
.invite {
  margin-top: -8px; padding: 22px 16px; border-radius: 4px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;
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
