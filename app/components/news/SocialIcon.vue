<script setup lang="ts">
// A social platform's logo in its brand colour (round badge, white glyph). Decorative: callers
// always write the platform's name next to it or in an aria-label.
import { PhFacebookLogo, PhInstagramLogo, PhThreadsLogo, PhTiktokLogo, PhWhatsappLogo, PhXLogo } from '@phosphor-icons/vue'

export type SocialBrand = 'instagram' | 'tiktok' | 'facebook' | 'threads' | 'x' | 'whatsapp'
withDefaults(defineProps<{ platform: SocialBrand, size?: number }>(), { size: 20 })
const ICONS = { instagram: PhInstagramLogo, tiktok: PhTiktokLogo, facebook: PhFacebookLogo, threads: PhThreadsLogo, x: PhXLogo, whatsapp: PhWhatsappLogo }
</script>

<template>
  <span class="social-icon" :class="`social-icon--${platform}`" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">
    <component :is="ICONS[platform]" :size="Math.round(size * 0.62)" weight="bold" />
  </span>
</template>

<style scoped>
.social-icon { flex: 0 0 auto; display: inline-grid; place-items: center; border-radius: 50%; color: var(--on-brand); }
.social-icon--instagram { background: var(--brand-instagram); }
.social-icon--tiktok { background: var(--brand-tiktok); }
.social-icon--facebook { background: var(--brand-facebook); }
.social-icon--threads { background: var(--brand-threads); }
.social-icon--x { background: var(--brand-x); }
.social-icon--whatsapp { background: var(--brand-whatsapp); }
</style>
