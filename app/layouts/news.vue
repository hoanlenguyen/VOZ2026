<!-- Editorial front page: light "paper" theme, full width. -->
<script setup lang="ts">
useHead({ htmlAttrs: { 'data-theme': 'paper' }, meta: [{ name: 'theme-color', content: '#FFFFFF' }] })
</script>

<template>
  <div class="news-layout">
    <NewsSiteHeader />
    <slot />
    <footer class="news-footer">
      <p>VOZ – My Sports World · Stories on this page are written automatically from official league data (Liiga, football-data.org).</p>
    </footer>
  </div>
</template>

<style scoped>
.news-layout { min-height: 100dvh; background: var(--bg); color: var(--text); }
.news-footer {
  max-width: 1200px; margin: 48px auto 0; padding: 24px 16px calc(32px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--line); color: var(--muted); font-size: 13px;
}
</style>
