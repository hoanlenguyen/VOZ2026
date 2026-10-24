<!-- Editorial front page: light "paper" theme, full width. -->
<script setup lang="ts">
const { t } = useI18n()
const head = useLocaleHead()
// The newsroom's draft preview (?draft=) shows the page as a reader would: no account header.
const route = useRoute()
useHead({ htmlAttrs: { 'data-theme': 'paper', 'lang': () => head.value.htmlAttrs.lang }, meta: [{ name: 'theme-color', content: '#FFFFFF' }] })
</script>

<template>
  <div class="news-layout">
    <NewsSiteHeader v-if="!route.query.draft" />
    <slot />
    <footer class="news-footer">
      <p>{{ t('site.footer') }}</p>
    </footer>
  </div>
</template>

<style scoped>
.news-layout { min-height: 100dvh; background: var(--bg); color: var(--text); }
.news-footer {
  width: calc(100% - 32px); max-width: var(--page-max); margin: 50px auto 0; padding: 24px 0 calc(32px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--line-strong); color: var(--meta); font-size: 13px;
}
</style>
