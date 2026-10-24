<script setup lang="ts">
// One AI podcast episode: play/pause, seek bar and time, the transcript; for the newsroom also the
// "AI content" tag and the facts it cites. Only one episode plays at a time on a page. Audio loads on first play (preload="none").
// Podcasts are for subscribers: a locked episode (free / signed out) shows its title and length,
// and its lock button opens the VOZ Plus invitation instead of playing.
import { PhCaretRight, PhLockSimple, PhPause, PhPlay } from '@phosphor-icons/vue'
import type { PodcastEpisode } from '#shared/types/podcast'

const props = withDefaults(defineProps<{ episode: PodcastEpisode, showLink?: boolean }>(), { showLink: true })
const { t } = useI18n()
const { stamp } = useFormat()
const { can, account } = useAccount()
const route = useRoute()
const showInvite = ref(false)
const inviteLink = computed(() => (account.value ? '/account' : { path: '/login', query: { redirect: route.fullPath } }))

const audio = ref<HTMLAudioElement | null>(null)
const playing = ref(false)
const current = ref(0)
const duration = ref(props.episode.audio?.seconds ?? 0)
const showFacts = ref(false)
const uid = useId()
const nowPlaying = useState<string | null>('podcast-now-playing', () => null)
watch(nowPlaying, (id) => {
  if (id !== uid && playing.value) audio.value?.pause()
})

function toggle() {
  const a = audio.value
  if (!a) return
  if (a.paused) {
    nowPlaying.value = uid
    a.play().catch(() => { playing.value = false })
  }
  else a.pause()
}
function seek(e: Event) {
  if (audio.value) audio.value.currentTime = Number((e.target as HTMLInputElement).value)
}
const clock = (s: number) => {
  const v = Math.max(0, Math.round(s))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}

const kicker = computed(() => {
  const e = props.episode
  const kind = t(`podcast.kinds.${e.subject.kind}`)
  return e.subject.kind === 'league' ? [kind, e.competitionName] : [kind, e.label, e.competitionName]
})
const transcript = computed(() => [props.episode.intro, ...props.episode.sentences.map(s => s.text), props.episode.outro].join(' '))
</script>

<template>
  <article v-if="episode.audio" class="pod" :lang="episode.lang">
    <div class="pod-main">
      <button
        v-if="episode.locked" type="button" class="play play--locked" :aria-expanded="showInvite"
        :aria-label="t('podcast.lockedPlay', { title: episode.title })" @click="showInvite = !showInvite"
      >
        <PhLockSimple :size="22" weight="bold" aria-hidden="true" />
      </button>
      <button
        v-else type="button" class="play" :aria-label="t(playing ? 'podcast.pause' : 'podcast.play', { title: episode.title })"
        @click="toggle"
      >
        <PhPause v-if="playing" :size="22" weight="fill" aria-hidden="true" />
        <PhPlay v-else :size="22" weight="fill" aria-hidden="true" />
      </button>
      <div class="pod-body">
        <p class="kicker">
          <template v-for="(k, i) in kicker" :key="i">
            <span v-if="i" aria-hidden="true">·</span><span>{{ k }}</span>
          </template>
          <span aria-hidden="true">·</span>
          <time class="num" :datetime="episode.generatedAt">{{ stamp(episode.generatedAt) }}</time>
          <span v-if="can.newsroom" class="ai-tag">{{ t('story.aiTag') }}</span>
        </p>
        <h3 class="title">{{ episode.title }}</h3>
        <div class="bar">
          <input
            type="range" class="seek" min="0" :max="duration || 1" step="0.1" :value="current" :disabled="episode.locked"
            :aria-label="t('podcast.seek', { title: episode.title })" :aria-valuetext="`${clock(current)} / ${clock(duration)}`"
            @input="seek"
          >
          <span class="time num">{{ clock(current) }} / {{ clock(duration) }}</span>
        </div>
      </div>
    </div>
    <!-- Locked: the VOZ Plus invitation, opened from the lock button. -->
    <div v-if="episode.locked && showInvite" class="invite">
      <p class="invite-title">{{ t('podcast.lockedTitle') }}</p>
      <p class="invite-text">{{ t(account ? 'podcast.lockedFree' : 'podcast.lockedSignedOut') }}</p>
      <NuxtLink :to="inviteLink" class="invite-cta">{{ account ? t('discussion.subscribe') : t('nav.signIn') }}</NuxtLink>
    </div>
    <p v-else-if="episode.locked" class="locked-note"><PhLockSimple :size="13" weight="bold" aria-hidden="true" /> {{ t('podcast.lockedNote') }}</p>
    <audio
      v-if="!episode.locked"
      ref="audio" :src="episode.audio.url" preload="none"
      @play="playing = true" @pause="playing = false" @ended="playing = false; current = 0"
      @timeupdate="current = ($event.target as HTMLAudioElement).currentTime"
      @loadedmetadata="duration = ($event.target as HTMLAudioElement).duration || duration"
    />
    <details v-if="!episode.locked" class="transcript">
      <summary><PhCaretRight :size="14" weight="bold" class="caret" aria-hidden="true" />{{ t('podcast.transcript') }}</summary>
      <p class="script">{{ transcript }}</p>
      <button v-if="can.newsroom" type="button" class="facts-toggle" :aria-pressed="showFacts" @click="showFacts = !showFacts">
        {{ showFacts ? t('podcast.hideFacts') : t('podcast.showFacts') }}
      </button>
      <ol v-if="can.newsroom && showFacts" class="facts">
        <li v-for="f in episode.evidence" :key="f.id">{{ f.text }}</li>
      </ol>
    </details>
    <NuxtLink v-if="showLink && episode.subject.kind === 'match'" :to="episode.href" class="open">{{ t('podcast.open') }}</NuxtLink>
  </article>
</template>

<style scoped>
.pod { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--line-strong); border-radius: 4px; background: var(--bg); }
.pod-main { display: flex; gap: 14px; align-items: flex-start; }
.play {
  flex: 0 0 auto; width: 48px; height: 48px; display: grid; place-items: center; border: 0; border-radius: 50%;
  background: var(--accent); color: var(--on-accent); cursor: pointer;
  transition: opacity var(--dur-fast) var(--ease-out);
}
.play:hover { opacity: 0.85; }
.play--locked { background: var(--offer-bg); color: var(--offer-ink); border: 2px solid var(--offer-ink); }
.seek:disabled { cursor: not-allowed; opacity: 0.5; }
.locked-note { margin: 0; display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: var(--offer-ink); }
.invite { padding: 14px 16px; border-radius: 4px; background: var(--offer-bg); color: var(--offer-text); display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.invite-title { margin: 0; font-size: 15px; font-weight: 700; }
.invite-text { margin: 0; font-size: 14px; line-height: 1.45; }
.invite-cta {
  margin-top: 4px; min-height: 40px; padding: 0 18px; display: inline-flex; align-items: center; border-radius: 999px;
  background: var(--offer-ink); color: var(--offer-bg); font-size: 14px; font-weight: 700; text-decoration: none;
}
.invite-cta:hover { background: var(--offer-ink-hover); color: var(--offer-bg); }
.invite-cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.play:focus-visible { outline: 2px solid var(--link-hover); outline-offset: 3px; }
.pod-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.kicker { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-size: 11px; line-height: 16px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta); }
.ai-tag {
  padding: 0 4px; border: 1px solid currentColor; border-radius: 3px;
  font-size: 9px; line-height: 13px; font-weight: 700; letter-spacing: 0.06em; color: var(--link-hover);
}
.title { margin: 0; font-size: 17px; line-height: 1.3; font-weight: 700; color: var(--headline); }
.bar { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.seek { flex: 1 1 auto; min-width: 0; height: 24px; margin: 0; accent-color: var(--stat-lead); cursor: pointer; }
.seek:focus-visible { outline: 2px solid var(--link-hover); outline-offset: 2px; }
.time { flex: 0 0 auto; font-size: 12px; color: var(--meta); font-variant-numeric: tabular-nums; }
.transcript summary {
  min-height: 32px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; list-style: none;
  font-size: 13px; font-weight: 700; color: var(--headline);
}
.transcript summary::-webkit-details-marker { display: none; }
.transcript summary:hover { color: var(--link-hover); }
.caret { transition: transform var(--dur-fast) var(--ease-out); }
.transcript[open] .caret { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .caret { transition: none; } }
.transcript summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.script { margin: 4px 0 8px; font-size: 14px; line-height: 1.55; color: var(--summary); }
.facts-toggle {
  min-height: 36px; padding: 0 12px; border: 1px solid var(--border-control); border-radius: 999px;
  background: var(--bg); color: var(--headline); font-size: 12px; font-weight: 700; cursor: pointer;
}
.facts-toggle:hover { background: var(--surface); }
.facts-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.facts { margin: 10px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--summary); }
.open { align-self: flex-start; font-size: 13px; font-weight: 700; color: var(--headline); text-decoration: none; }
.open:hover { color: var(--link-hover); text-decoration: underline; }
.open:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
