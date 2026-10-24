<script setup lang="ts">
// An approved AI match post (newsroom agent, SportWorld match). Every reader sees the simulated-data
// banner first: the result is real, the match details behind the story were generated. Other
// outlets' coverage is listed as links with their source, never their text.
import { PhArrowSquareOut, PhFlask } from '@phosphor-icons/vue'
import type { ReaderPost } from '#shared/types/ai-post'

definePageMeta({ layout: 'news' })
const { t, locale } = useI18n()
const { stamp } = useFormat()
const route = useRoute()
const { data: post, error } = await useFetch<ReaderPost>(() => `/api/posts/${encodeURIComponent(String(route.params.id))}`, { query: { lang: locale } })
useHead({ title: () => (post.value ? `${post.value.headline} – VOZ` : t('post.notFound')) })
const date = (iso: string) => new Intl.DateTimeFormat(locale.value === 'fi' ? 'fi-FI' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
const about = (p: ReaderPost['press'][number]) => (p.about === 'match' ? t('post.aboutMatch') : t('post.aboutTeam', { team: p.team ?? '' }))
</script>

<template>
  <main id="main" class="wrap">
    <p v-if="error" class="notice" role="alert">{{ error.statusCode === 404 ? t('post.notFound') : t('post.loadError') }}</p>

    <article v-else-if="post" class="article" :lang="post.lang === locale ? undefined : post.lang">
      <aside class="sim-banner" role="note">
        <PhFlask :size="20" weight="bold" aria-hidden="true" />
        <p><strong>{{ t('post.simTitle') }}</strong> {{ t('post.simText') }}</p>
      </aside>

      <p class="kicker">
        <span>{{ post.competitionName }}</span>
        <template v-if="post.round"><span aria-hidden="true">·</span><span>{{ t('post.round', { n: post.round }) }}</span></template>
        <span aria-hidden="true">·</span><span>{{ date(post.match.start) }}</span>
      </p>
      <h1 class="headline">{{ keepScoresTogether(post.headline) }}</h1>
      <p class="byline">{{ t('post.byline', { name: post.reviewedBy }) }} · <time :datetime="post.publishedAt">{{ stamp(post.publishedAt) }}</time></p>

      <div class="visual"><NewsMatchVisual :story="post.card" size="lg" /></div>

      <div class="body">
        <p v-for="(para, i) in post.paragraphs" :key="i">{{ keepScoresTogether(para) }}</p>
      </div>

      <section v-if="post.press.length" class="press" aria-labelledby="press-title">
        <h2 id="press-title" class="press-title">{{ t('post.pressTitle') }}</h2>
        <p class="meta">{{ t('post.pressNote') }}</p>
        <ul class="press-list">
          <li v-for="p in post.press" :key="p.link">
            <a :href="p.link" target="_blank" rel="noopener noreferrer" class="press-link">
              <span class="press-head">{{ p.title }}</span>
              <PhArrowSquareOut :size="14" weight="bold" aria-hidden="true" />
              <span class="sr-only">({{ t('post.newTab') }})</span>
            </a>
            <span class="meta">{{ p.source }} · {{ about(p) }} · {{ stamp(p.publishedAt) }}</span>
          </li>
        </ul>
      </section>
    </article>
  </main>
</template>

<style scoped>
.wrap { max-width: calc(720px + 2 * 16px); margin: 0 auto; padding: 24px 16px 0; }
@media (min-width: 768px) { .wrap { padding: 32px 30px 0; max-width: calc(720px + 2 * 30px); } }
.notice { margin: 24px 0; padding: 14px 16px; border-radius: 4px; background: var(--surface); color: var(--text-2); }
.sim-banner {
  margin: 0 0 24px; padding: 12px 16px; display: flex; gap: 12px; align-items: flex-start;
  border: 1px solid var(--line-strong); border-left: 4px solid var(--accent); border-radius: 4px; background: var(--surface);
  color: var(--headline);
}
.sim-banner svg { flex: 0 0 auto; margin-top: 2px; }
.sim-banner p { margin: 0; font-size: 14px; line-height: 1.5; }
.kicker {
  margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; font-size: 11px; line-height: 16px;
  font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--meta);
}
.headline { margin: 8px 0 0; font-size: clamp(26px, 4vw, 36px); line-height: 1.2; font-weight: 700; color: var(--headline); }
.byline { margin: 12px 0 0; font-size: 13px; color: var(--meta); }
.visual { margin-top: 20px; }
.body { margin-top: 24px; }
.body p { margin: 0 0 18px; font-size: 18px; line-height: 1.65; color: var(--headline); }
.press { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--line-strong); }
.press-title { margin: 0; font-size: 20px; font-weight: 700; color: var(--headline); }
.meta { margin: 4px 0 0; font-size: 13px; color: var(--meta); }
.press-list { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; }
.press-list li { padding: 10px 0; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.press-link {
  display: inline-flex; align-items: baseline; gap: 6px; min-height: 24px;
  font-size: 16px; font-weight: 700; line-height: 1.4; color: var(--headline); text-decoration: none;
}
.press-link:hover { color: var(--link-hover); text-decoration: underline; }
.press-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
