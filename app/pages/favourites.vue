<script setup lang="ts">
// My favourites: the News layout with only what the account follows (preferences from My teams).
definePageMeta({ layout: 'news' })
const { t } = useI18n()
useHead({ title: () => t('favourites.pageTitle') })
</script>

<template>
  <NewsFrontPage favourites />
</template>
