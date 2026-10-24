<script setup lang="ts">
// Share button with a small menu (demo): X, Facebook, Threads and WhatsApp open their own share
// page in a new tab; Instagram and TikTok have no web share, so they copy the link to paste in the
// app; "Copy link"; and the device's share sheet where the browser has one. Closes on Esc, on a
// click outside and after a choice.
import { PhCheck, PhDotsThreeOutline, PhLinkSimple, PhShareNetwork } from '@phosphor-icons/vue'
import type { SocialBrand } from './SocialIcon.vue'

const props = withDefaults(defineProps<{
  /** Page path to share (made absolute in the browser); the current page by default. */
  path?: string
  /** Text that goes with the link. */
  text: string
  /** Accessible name of the button, e.g. "Share this discussion". */
  label: string
  /** Icon-only button (in comment rows). */
  compact?: boolean
  /** Which side of the button the menu lines up with. */
  align?: 'start' | 'end'
}>(), { align: 'end' })

const { t } = useI18n()
const open = ref(false)
const note = ref('')
const root = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const id = useId()
const canNative = ref(false)
onMounted(() => { canNative.value = typeof navigator !== 'undefined' && typeof navigator.share === 'function' })

const url = () => new URL(props.path ?? `${location.pathname}${location.search}`, location.origin).toString()
const enc = encodeURIComponent
type Target = { brand: SocialBrand, label: string, href?: (u: string) => string, copy?: boolean }
const TARGETS: Target[] = [
  { brand: 'x', label: 'X', href: u => `https://twitter.com/intent/tweet?text=${enc(props.text)}&url=${enc(u)}` },
  { brand: 'facebook', label: 'Facebook', href: u => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  { brand: 'threads', label: 'Threads', href: u => `https://www.threads.net/intent/post?text=${enc(`${props.text} ${u}`)}` },
  { brand: 'whatsapp', label: 'WhatsApp', href: u => `https://wa.me/?text=${enc(`${props.text} ${u}`)}` },
  { brand: 'instagram', label: 'Instagram', copy: true },
  { brand: 'tiktok', label: 'TikTok', copy: true },
]

async function toggle() {
  open.value = !open.value
  note.value = ''
  if (open.value) {
    await nextTick()
    menu.value?.querySelector<HTMLElement>('a, button')?.focus()
  }
}
function close(focusButton = false) {
  open.value = false
  if (focusButton) root.value?.querySelector<HTMLElement>('.share-btn')?.focus()
}
async function copy(app?: string) {
  try {
    await navigator.clipboard.writeText(url())
    note.value = app ? t('share.copiedFor', { app }) : t('share.copied')
  }
  catch {
    note.value = t('share.copyFailed')
  }
}
function go(target: Target) {
  if (target.copy) return copy(target.label)
  window.open(target.href!(url()), '_blank', 'noopener,noreferrer')
  close()
}
async function native() {
  try { await navigator.share({ title: props.text, text: props.text, url: url() }) }
  catch { /* cancelled */ }
  close()
}
function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close()
}
function onKey(e: KeyboardEvent) {
  if (open.value && e.key === 'Escape') close(true)
}
onMounted(() => { document.addEventListener('click', onDocClick); document.addEventListener('keydown', onKey) })
onBeforeUnmount(() => { document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey) })
</script>

<template>
  <div ref="root" class="share">
    <button
      type="button" class="share-btn" :class="{ 'share-btn--compact': compact }" :aria-expanded="open" :aria-controls="id"
      :aria-label="compact ? label : undefined" @click="toggle"
    >
      <PhShareNetwork :size="compact ? 16 : 18" weight="bold" aria-hidden="true" />
      <span v-if="!compact">{{ t('share.button') }}</span>
    </button>
    <div v-show="open" :id="id" ref="menu" class="panel" :class="`panel--${align}`" role="group" :aria-label="label">
      <p class="panel-title">{{ t('share.title') }}</p>
      <ul class="targets">
        <li v-for="target in TARGETS" :key="target.brand">
          <button type="button" class="target" @click="go(target)">
            <NewsSocialIcon :platform="target.brand" :size="28" />
            <span class="target-label">{{ target.label }}</span>
            <span v-if="target.copy" class="target-hint">{{ t('share.copyLinkShort') }}</span>
          </button>
        </li>
      </ul>
      <div class="extra">
        <button type="button" class="extra-btn" @click="copy()">
          <component :is="note === t('share.copied') ? PhCheck : PhLinkSimple" :size="16" weight="bold" aria-hidden="true" />{{ t('share.copyLink') }}
        </button>
        <button v-if="canNative" type="button" class="extra-btn" @click="native">
          <PhDotsThreeOutline :size="16" weight="bold" aria-hidden="true" />{{ t('share.more') }}
        </button>
      </div>
      <p class="note" role="status" aria-live="polite">{{ note }}</p>
    </div>
  </div>
</template>

<style scoped>
.share { position: relative; display: inline-flex; }
.share-btn {
  min-height: 44px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
  border: 1px solid var(--border-control); background: var(--bg); color: var(--headline); font-size: 14px; font-weight: 700; cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out);
}
.share-btn:hover { background: var(--surface); }
.share-btn--compact { min-height: 36px; padding: 0 10px; border: 0; background: none; color: var(--summary); font-size: 13px; font-weight: 600; }
.share-btn--compact:hover { color: var(--headline); }
.share-btn[aria-expanded="true"] { background: var(--surface); color: var(--headline); }
.share-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.panel {
  position: absolute; top: calc(100% + 6px); z-index: 30; width: 272px; max-width: calc(100vw - 32px); padding: 12px;
  border: 1px solid var(--line-strong); border-radius: 8px; background: var(--bg); box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
}
.panel--end { right: 0; }
.panel--start { left: 0; }
.panel-title { margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta); }
.targets { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
.target {
  width: 100%; min-height: 72px; padding: 8px 4px; display: flex; flex-direction: column; align-items: center; gap: 4px;
  border: 0; border-radius: 6px; background: none; color: var(--headline); cursor: pointer;
}
.target:hover { background: var(--surface); }
.target:focus-visible, .extra-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.target-label { font-size: 12px; font-weight: 600; }
.target-hint { font-size: 10px; color: var(--meta); }
.extra { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 4px; }
.extra-btn {
  min-height: 40px; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 999px;
  background: none; color: var(--headline); font-size: 13px; font-weight: 600; cursor: pointer;
}
.extra-btn:hover { background: var(--surface); }
.note { min-height: 16px; margin: 6px 0 0; font-size: 12px; color: var(--summary); }
</style>
