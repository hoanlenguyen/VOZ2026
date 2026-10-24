<script setup lang="ts">
// News: the front page (layout in NewsFrontPage).
definePageMeta({ layout: 'news' })
const { t } = useI18n()
useHead({ title: () => t('home.pageTitle') })
</script>

<template>
  <NewsFrontPage />
</template>
