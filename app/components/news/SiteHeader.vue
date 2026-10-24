<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()
const open = ref(false)
// "My teams" is for readers; newsroom accounts have the newsroom instead.
const { can } = useAccount()
const links = computed(() => [
  { to: '/', label: t('nav.sports') },
  ...(can.value.newsroom ? [] : [{ to: '/my-teams', label: t('nav.myTeams') }]),
])
const route = useRoute()
watch(() => route.fullPath, () => (open.value = false))
</script>

<template>
  <header class="site-header">
    <div class="bar">
      <button
        type="button" class="icon-btn" :aria-expanded="open" aria-controls="site-menu"
        :aria-label="t('site.menu')" @click="open = !open"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      <NuxtLink to="/" class="logo" :aria-label="t('site.logoLabel')">
        <NewsLogoMark :size="36" />
        <span class="logo-text">
          <span class="wordmark">VOZ</span>
          <small>{{ t('site.tagline') }}</small>
        </span>
      </NuxtLink>

      <nav class="desktop-nav" aria-label="Main">
        <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="nav-link">{{ l.label }}</NuxtLink>
      </nav>

      <div class="lang lang--bar" role="group" :aria-label="t('site.language')">
        <button
          v-for="l in locales" :key="l.code" type="button" class="lang-btn" :lang="l.code" :title="l.name"
          :aria-pressed="locale === l.code" @click="setLocale(l.code)"
        >
          {{ l.code.toUpperCase() }}
        </button>
      </div>

      <div class="account-slot"><NewsAccountMenu /></div>
    </div>

    <nav v-show="open" id="site-menu" class="menu" aria-label="Main">
      <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="menu-link">{{ l.label }}</NuxtLink>
      <div class="lang lang--menu" role="group" :aria-label="t('site.language')">
        <button
          v-for="l in locales" :key="l.code" type="button" class="lang-btn" :lang="l.code"
          :aria-pressed="locale === l.code" @click="setLocale(l.code)"
        >
          {{ l.name }}
        </button>
      </div>
    </nav>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky; top: 0; z-index: var(--z-sticky);
  background: var(--bg); border-bottom: 1px solid var(--line-strong);
  padding-top: env(safe-area-inset-top);
}
.bar {
  max-width: calc(var(--page-max) + 2 * 50px); margin: 0 auto; height: 52px; padding: 0 8px 0 4px;
  display: grid; grid-template-columns: 48px 1fr auto; align-items: center; gap: 8px;
}
.icon-btn {
  width: 44px; height: 44px; border: 0; border-radius: 8px; background: transparent; color: var(--text);
  display: grid; place-items: center;
}
.icon-btn:hover { background: var(--surface); }
.logo { justify-self: center; display: flex; align-items: center; gap: 10px; color: var(--text); text-decoration: none; }
.logo-text { display: flex; flex-direction: column; line-height: 1; }
.wordmark { font-family: var(--font-display); font-weight: 700; font-size: 26px; letter-spacing: 0.06em; line-height: 0.9; color: var(--headline); }
.logo-text small { margin-top: 3px; font-size: 11px; font-weight: 500; letter-spacing: 0.04em; color: var(--muted); }
.logo:hover .wordmark { color: var(--link-hover); }
.desktop-nav { display: none; }
.account-slot { justify-self: end; }
.lang { display: flex; gap: 2px; padding: 2px; border: 1px solid var(--line-strong); border-radius: 999px; }
.lang-btn {
  min-width: 44px; min-height: 36px; padding: 0 10px; border: 0; border-radius: 999px; background: transparent;
  color: var(--meta); font-size: 13px; font-weight: 700; letter-spacing: 0.04em;
  transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}
.lang-btn:hover { color: var(--link-hover); }
.lang-btn[aria-pressed="true"] { background: var(--headline); color: var(--bg); }
.lang-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.lang--bar { display: none; }
.lang--menu { align-self: flex-start; margin-top: 12px; }
.lang--menu .lang-btn { min-height: 44px; padding: 0 16px; letter-spacing: 0; }
.menu { max-width: calc(var(--page-max) + 2 * 50px); margin: 0 auto; padding: 4px 16px 12px; display: flex; flex-direction: column; }
.menu-link { padding: 12px 0; border-top: 1px solid var(--line-soft); color: var(--text); font-weight: 600; text-decoration: none; }

@media (min-width: 1024px) {
  .bar { grid-template-columns: auto auto 1fr auto auto; padding: 0 30px; }
  .lang--bar { display: flex; justify-self: end; }
  .icon-btn { display: none; }
  .logo { justify-self: start; }
  .desktop-nav { display: flex; gap: 4px; margin-left: 24px; }
  .nav-link {
    min-height: 44px; padding: 0 12px; display: inline-flex; align-items: center;
    color: var(--text-2); font-weight: 600; font-size: 14px; text-decoration: none; border-radius: 8px;
  }
  .nav-link:hover { background: transparent; color: var(--link-hover); }
  .nav-link.router-link-exact-active { color: var(--text); box-shadow: inset 0 -3px 0 var(--accent); border-radius: 0; }
  .account-slot { justify-self: end; }
  .menu { display: none !important; }
}
</style>
