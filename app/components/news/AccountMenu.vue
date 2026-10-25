<script setup lang="ts">
// Header account control: "Sign in" when signed out; otherwise a button with the reader's initials
// that opens a small panel (plan, account, sign out). Closes on Escape, outside click or navigation.
// The newsroom has its own header tab (SiteHeader.vue).
import { PhCaretDown, PhSignOut, PhUser } from '@phosphor-icons/vue'

const { t } = useI18n()
const { account, can, logout } = useAccount()
const route = useRoute()
const open = ref(false)
const root = ref<HTMLElement>()
const initials = computed(() => account.value?.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '')

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
async function signOut() {
  open.value = false
  await logout()
  if (route.meta.middleware) await navigateTo('/')
}
</script>

<template>
  <NuxtLink v-if="!account" :to="{ path: '/login', query: { redirect: route.fullPath } }" class="sign-in">
    {{ t('nav.signIn') }}
  </NuxtLink>
  <div v-else ref="root" class="account">
    <button
      type="button" class="trigger" :aria-expanded="open" aria-controls="account-panel"
      :aria-label="`${t('nav.accountMenu')}: ${account.name}, ${t(`plan.${account.plan}`)}`" @click="open = !open"
    >
      <span class="avatar" :class="`avatar--${account.plan}`" aria-hidden="true">{{ initials }}</span>
      <span class="plan-tag">{{ t(`plan.${account.plan}`) }}</span>
      <PhCaretDown :size="14" weight="bold" class="caret" :class="{ 'caret--open': open }" aria-hidden="true" />
    </button>
    <div v-show="open" id="account-panel" class="panel">
      <p class="who">
        <strong>{{ account.name }}</strong>
        <span>{{ account.email }}</span>
      </p>
      <NuxtLink to="/account" class="item"><PhUser :size="16" weight="bold" aria-hidden="true" />{{ t('nav.account') }}</NuxtLink>
      <button type="button" class="item" @click="signOut"><PhSignOut :size="16" weight="bold" aria-hidden="true" />{{ t('nav.signOut') }}</button>
    </div>
  </div>
</template>

<style scoped>
.sign-in {
  min-height: 40px; padding: 0 16px; border-radius: 999px; display: inline-flex; align-items: center;
  background: var(--accent); color: var(--on-accent); font-weight: 600; font-size: 14px; text-decoration: none;
}
.sign-in:hover { color: var(--on-accent); filter: brightness(0.95); }
.account { position: relative; }
.trigger {
  min-height: 44px; display: inline-flex; align-items: center; gap: 8px; padding: 0 8px 0 4px;
  border: 1px solid var(--line-strong); border-radius: 999px; background: var(--bg); color: var(--headline);
}
.trigger:hover { background: var(--surface); }
.trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.avatar {
  width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
  font-size: 13px; font-weight: 700; background: var(--surface-2); color: var(--headline);
}
.avatar--subscriber { background: var(--accent); color: var(--on-accent); }
.avatar--newsroom { background: var(--board); color: var(--board-text); }
.plan-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--summary); }
.caret { color: var(--meta); transition: transform var(--dur-fast) var(--ease-out); }
.caret--open { transform: rotate(180deg); }
.panel {
  position: absolute; right: 0; top: calc(100% + 8px); z-index: var(--z-sheet); min-width: 240px;
  padding: 8px; border: 1px solid var(--line-strong); border-radius: 8px; background: var(--bg);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
}
.who { margin: 0 0 6px; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 2px; border-bottom: 1px solid var(--line); }
.who strong { color: var(--headline); font-size: 14px; }
.who span { color: var(--meta); font-size: 12px; }
.item {
  width: 100%; min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 10px;
  border: 0; border-radius: 4px; background: transparent; color: var(--headline);
  font-size: 14px; font-weight: 600; text-decoration: none; text-align: left;
}
.item:hover { background: var(--surface); color: var(--link-hover); }
.item:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (max-width: 479px) { .plan-tag { display: none; } }
@media (prefers-reduced-motion: reduce) { .caret { transition: none; } }
</style>
