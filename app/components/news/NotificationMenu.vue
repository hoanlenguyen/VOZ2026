<script setup lang="ts">
// Header notifications (mock, demo only): a bell with an unread count that opens a panel of sample
// notifications about the demo team (Ipswich). The texts state real demo data (the 1–1 result, the
// published match story, the podcast, the next fixture); nothing is sent or stored on the server.
// Read state is per browser (localStorage). Free and signed-out readers also get the VOZ Plus invitation,
// as notifications are planned as a subscriber feature (CLAUDE.md "Planned").
import { PhArticle, PhBell, PhCalendar, PhMicrophone, PhSoccerBall } from '@phosphor-icons/vue'

const { t } = useI18n()
const { stamp } = useFormat()
const { account, can } = useAccount()
const route = useRoute()

const ICONS = { result: PhSoccerBall, story: PhArticle, podcast: PhMicrophone, fixture: PhCalendar }
type Kind = keyof typeof ICONS
const MATCH = '/match/premier-league/2645271'
const items: Array<{ id: string, kind: Kind, at: string, to: string }> = [
  { id: 'fixture-hull', kind: 'fixture', at: '2026-10-24T08:00:00Z', to: '/my-teams' },
  { id: 'podcast-ipswich', kind: 'podcast', at: '2026-10-24T05:00:00Z', to: '/#podcasts-title' },
  { id: 'story-ipswich', kind: 'story', at: '2026-10-23T22:30:00Z', to: MATCH },
  { id: 'result-ipswich', kind: 'result', at: '2026-10-23T20:55:00Z', to: MATCH },
]

const STORE = 'voz_notifications_read'
const read = ref<Set<string>>(new Set())
onMounted(() => {
  try {
    read.value = new Set(JSON.parse(localStorage.getItem(STORE) ?? '[]') as string[])
  }
  catch { /* storage blocked: everything stays unread */ }
})
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify([...read.value]))
  }
  catch { /* storage blocked */ }
}
const unread = computed(() => items.filter(i => !read.value.has(i.id)).length)
function markRead(id: string) {
  read.value = new Set([...read.value, id])
  save()
}
function markAll() {
  read.value = new Set(items.map(i => i.id))
  save()
}

const open = ref(false)
const root = ref<HTMLElement>()
watch(() => route.fullPath, () => (open.value = false))
function onOutside(e: PointerEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = false
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onOutside)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="notify">
    <button
      type="button" class="bell" :aria-expanded="open" aria-controls="notify-panel"
      :aria-label="unread ? t('notify.labelUnread', { n: unread }) : t('notify.label')" @click="open = !open"
    >
      <PhBell :size="22" weight="bold" aria-hidden="true" />
      <span v-if="unread" class="count num" aria-hidden="true">{{ unread }}</span>
    </button>
    <div v-show="open" id="notify-panel" class="panel" role="region" :aria-label="t('notify.title')">
      <div class="head">
        <strong>{{ t('notify.title') }}</strong>
        <button v-if="unread" type="button" class="mark-all" @click="markAll">{{ t('notify.markAll') }}</button>
      </div>
      <ul class="list">
        <li v-for="n in items" :key="n.id">
          <NuxtLink :to="n.to" class="item" :class="{ 'item--unread': !read.has(n.id) }" @click="markRead(n.id)">
            <span class="icon" aria-hidden="true"><component :is="ICONS[n.kind]" :size="18" weight="bold" /></span>
            <span class="body">
              <span class="text">{{ t(`notify.items.${n.id}`) }}</span>
              <span class="meta">{{ t(`notify.kinds.${n.kind}`) }} · <time class="num" :datetime="n.at">{{ stamp(n.at) }}</time></span>
            </span>
            <span v-if="!read.has(n.id)" class="dot" aria-hidden="true" />
            <span v-if="!read.has(n.id)" class="sr-only">{{ t('notify.unread') }}</span>
          </NuxtLink>
        </li>
      </ul>
      <p v-if="!can.premium" class="invite">
        {{ t('notify.invite') }}
        <NuxtLink :to="account ? '/account' : '/login'" class="invite-link">{{ t('notify.inviteCta') }}</NuxtLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.notify { position: relative; }
.bell {
  position: relative; width: 44px; height: 44px; display: grid; place-items: center;
  border: 0; border-radius: 999px; background: transparent; color: var(--headline); cursor: pointer;
}
.bell:hover { background: var(--surface); }
.bell:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.count {
  position: absolute; top: 4px; right: 3px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  display: grid; place-items: center; background: var(--loss); color: var(--board-text);
  font-size: 11px; font-weight: 700; line-height: 1; box-shadow: 0 0 0 2px var(--bg);
}
.panel {
  position: absolute; right: 0; top: calc(100% + 8px); z-index: var(--z-sheet); width: min(360px, calc(100vw - 32px));
  padding: 8px; border: 1px solid var(--line-strong); border-radius: 8px; background: var(--bg);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
}
.head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px 10px; border-bottom: 1px solid var(--line); }
.head strong { font-size: 15px; color: var(--headline); }
.mark-all {
  min-height: 32px; padding: 0 8px; border: 0; border-radius: 4px; background: transparent;
  color: var(--link-hover); font-size: 13px; font-weight: 600; cursor: pointer;
}
.mark-all:hover { background: var(--surface); }
.mark-all:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.list { list-style: none; margin: 4px 0 0; padding: 0; }
.item {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 4px;
  color: var(--headline); text-decoration: none;
}
.item:hover { background: var(--surface); }
.item:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.icon {
  flex: none; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%;
  background: var(--surface); color: var(--headline);
}
.item--unread .icon { background: var(--accent); color: var(--on-accent); }
.body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.text { font-size: 14px; line-height: 1.35; }
.item--unread .text { font-weight: 600; }
.meta { font-size: 12px; color: var(--meta); }
.dot { flex: none; width: 8px; height: 8px; margin-top: 6px; border-radius: 50%; background: var(--link-hover); }
.invite { margin: 6px 0 0; padding: 10px; border-top: 1px solid var(--line); font-size: 13px; color: var(--summary); }
.invite-link { font-weight: 700; color: var(--link-hover); }
/* Phones: the bell is not at the screen edge, so the panel spans the screen under the header. */
@media (max-width: 599px) {
  .panel { position: fixed; top: calc(56px + env(safe-area-inset-top, 0px)); left: 16px; right: 16px; width: auto; max-height: calc(100dvh - 72px); overflow-y: auto; }
}
</style>
