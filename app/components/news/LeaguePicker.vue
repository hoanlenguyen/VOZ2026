<script setup lang="ts">
// League switcher for the fixture strip: a button that opens a listbox of leagues grouped by sport.
// Keyboard: arrows/Home/End move, Enter/Space choose, Esc or Tab closes (WAI-ARIA listbox pattern).
import { PhCaretDown, PhCheck } from '@phosphor-icons/vue'
import type { LandingData } from '#shared/types/stories'

type League = LandingData['ticker'][number]

const props = defineProps<{ leagues: League[] }>()
const model = defineModel<string>({ required: true })

const { t } = useI18n()
const sportLabel = (sport: string) => (sport === 'hockey' || sport === 'football' ? t(`sport.${sport}`) : sport)
const groups = computed(() => {
  const map = new Map<string, League[]>()
  for (const l of props.leagues) map.set(l.sport, [...(map.get(l.sport) ?? []), l])
  return [...map].map(([sport, leagues]) => ({ sport, label: sportLabel(sport), leagues }))
})
// Flat order as displayed, for keyboard movement across groups.
const flat = computed(() => groups.value.flatMap(g => g.leagues))
const current = computed(() => props.leagues.find(l => l.competitionId === model.value) ?? props.leagues[0]!)
// Skips missing parts, so a partial or older API response never shows "undefined".
const subtitle = (l: League) => [sportLabel(l.sport), l.country].filter(Boolean).join(' · ')

const open = ref(false)
const active = ref(0)
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const list = ref<HTMLUListElement>()
const optionId = (l: League) => `league-opt-${l.competitionId}`

async function show(at?: number) {
  active.value = at ?? Math.max(0, flat.value.findIndex(l => l.competitionId === model.value))
  open.value = true
  await nextTick()
  list.value?.focus()
  scrollActiveIntoView()
}
function hide(refocus = true) {
  open.value = false
  if (refocus) trigger.value?.focus()
}
function choose(l: League) {
  model.value = l.competitionId
  hide()
}
function move(to: number) {
  active.value = (to + flat.value.length) % flat.value.length
  scrollActiveIntoView()
}
function scrollActiveIntoView() {
  nextTick(() => list.value?.querySelector(`#${optionId(flat.value[active.value]!)}`)?.scrollIntoView({ block: 'nearest' }))
}

function onTriggerKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    show()
  }
}
function onListKey(e: KeyboardEvent) {
  const keys: Record<string, () => void> = {
    ArrowDown: () => move(active.value + 1),
    ArrowUp: () => move(active.value - 1),
    Home: () => move(0),
    End: () => move(flat.value.length - 1),
    Enter: () => choose(flat.value[active.value]!),
    ' ': () => choose(flat.value[active.value]!),
    Escape: () => hide(),
  }
  if (e.key === 'Tab') return hide(false)
  const fn = keys[e.key]
  if (fn) {
    e.preventDefault()
    fn()
  }
}

// Close on a click or tap outside.
function onOutside(e: PointerEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) hide(false)
}
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))

defineExpose({ open })
</script>

<template>
  <div ref="root" class="picker">
    <button
      ref="trigger" type="button" class="trigger"
      aria-haspopup="listbox" :aria-expanded="open" aria-controls="league-listbox"
      :aria-label="t('ticker.league', { name: current.competitionName })"
      @click="open ? hide() : show()" @keydown="onTriggerKey"
    >
      <NewsLeagueBadge :name="current.competitionName" :emblem="current.emblem" :size="40" />
      <span class="label">
        <span v-if="subtitle(current)" class="eyebrow">{{ subtitle(current) }}</span>
        <span class="name">{{ current.competitionName }}</span>
      </span>
      <PhCaretDown :size="16" weight="bold" class="caret" :class="{ 'caret--open': open }" aria-hidden="true" />
    </button>

    <Transition name="pop">
      <ul
        v-if="open" id="league-listbox" ref="list" class="menu" role="listbox" tabindex="-1"
        :aria-label="t('ticker.choose')" :aria-activedescendant="optionId(flat[active]!)" @keydown="onListKey"
      >
        <li v-for="g in groups" :key="g.sport" role="group" :aria-labelledby="`league-group-${g.sport}`">
          <p :id="`league-group-${g.sport}`" class="group" role="presentation">{{ g.label }}</p>
          <ul role="presentation" class="options">
            <li
              v-for="l in g.leagues" :id="optionId(l)" :key="l.competitionId" role="option"
              class="option" :class="{ 'option--active': flat[active]?.competitionId === l.competitionId }"
              :aria-selected="l.competitionId === model"
              @click="choose(l)" @pointermove="active = flat.indexOf(l)"
            >
              <NewsLeagueBadge :name="l.competitionName" :emblem="l.emblem" :size="28" />
              <span class="option-text">
                <span class="option-name">{{ l.competitionName }}</span>
                <span class="option-sub">{{ [l.country, t('ticker.upcoming', { n: l.fixtures.length })].filter(Boolean).join(' · ') }}</span>
              </span>
              <PhCheck v-if="l.competitionId === model" :size="16" weight="bold" class="check" aria-hidden="true" />
            </li>
          </ul>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.picker { position: relative; }
.trigger {
  width: 100%; min-height: 56px; padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: 10px;
  background: var(--bg); color: var(--headline); text-align: left;
  display: flex; align-items: center; gap: 10px;
  transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
.trigger:hover { border-color: var(--border-control); }
.trigger[aria-expanded="true"] { border-color: var(--headline); box-shadow: 0 0 0 3px rgb(245 197 24 / 0.35); }
.label { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.eyebrow { font-size: 11px; line-height: 14px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.name { font-size: 15px; line-height: 1.25; font-weight: 700; }
.caret { flex: 0 0 auto; color: var(--meta); transition: transform var(--dur) var(--ease-out); }
.caret--open { transform: rotate(180deg); }

.menu {
  position: absolute; z-index: var(--z-sheet); top: calc(100% + 6px); left: 0; width: max(100%, 280px);
  max-height: min(420px, 70vh); overflow-y: auto; overscroll-behavior: contain;
  margin: 0; padding: 6px; list-style: none; outline: none;
  background: var(--bg); border: 1px solid var(--line-strong); border-radius: 12px;
  box-shadow: 0 12px 32px rgb(17 18 20 / 0.16), 0 2px 6px rgb(17 18 20 / 0.08);
}
.menu:focus-visible { box-shadow: 0 0 0 2px var(--accent), 0 12px 32px rgb(17 18 20 / 0.16); }
.group { margin: 6px 10px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--meta); }
.options { list-style: none; margin: 0; padding: 0; }
.option {
  min-height: 48px; padding: 8px 10px; border-radius: 8px; cursor: pointer;
  display: flex; align-items: center; gap: 12px; color: var(--headline);
}
.option--active { background: var(--surface); }
.option[aria-selected="true"] .option-name { font-weight: 700; }
.option-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.option-name { font-size: 15px; line-height: 1.25; font-weight: 500; }
.option-sub { font-size: 12px; color: var(--meta); }
.check { color: var(--accent-ink); flex: 0 0 auto; }

.pop-enter-active { transition: opacity var(--dur) var(--ease-out), transform var(--dur) var(--ease-out); }
.pop-leave-active { transition: opacity var(--dur-fast) ease-in, transform var(--dur-fast) ease-in; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }
</style>
