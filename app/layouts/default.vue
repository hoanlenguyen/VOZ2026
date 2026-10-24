<!-- App screens (feed, match story, onboarding): dark, phone-width column. -->
<script setup lang="ts">
const head = useLocaleHead()
useHead({ htmlAttrs: { lang: () => head.value.htmlAttrs.lang } })
</script>

<template>
  <div class="app-shell">
    <slot />
  </div>
</template>
