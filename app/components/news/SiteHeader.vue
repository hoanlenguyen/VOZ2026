<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()
const open = ref(false)
const links = computed(() => [
  { to: '/', label: t('nav.sports') },
  { to: '/onboarding', label: t('nav.myTeams') },
  { to: '/status', label: t('nav.status') },
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
        <span class="logo-mark" aria-hidden="true">V</span>
        <span class="logo-text">
          <span class="display">VOZ</span>
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

      <NuxtLink to="/onboarding" class="cta">{{ t('nav.personalise') }}</NuxtLink>
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
.logo { justify-self: center; display: flex; align-items: center; gap: 8px; color: var(--text); text-decoration: none; }
.logo-mark {
  width: 36px; height: 36px; border-radius: 8px; background: var(--board); color: var(--accent);
  display: grid; place-items: center; font-family: var(--font-display); font-weight: 700; font-size: 24px;
}
.logo-text { display: flex; flex-direction: column; line-height: 1; }
.logo-text .display { font-size: 24px; letter-spacing: 0.08em; }
.logo-text small { font-size: 11px; color: var(--muted); letter-spacing: 0.04em; margin-top: 2px; }
.cta {
  min-height: 40px; padding: 0 14px; border-radius: 999px; display: inline-flex; align-items: center;
  background: var(--accent); color: var(--on-accent); font-weight: 600; font-size: 14px; text-decoration: none;
}
.cta:hover { color: var(--on-accent); filter: brightness(0.95); }
.desktop-nav { display: none; }
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
  .cta { justify-self: end; }
  .menu { display: none !important; }
}
</style>
