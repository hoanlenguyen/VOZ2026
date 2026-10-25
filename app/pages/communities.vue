<script setup lang="ts">
// Communities (mock, demo): invented fan communities and their posts, with polls, a filter per
// community, Join (kept in this browser only) and the share menu. Nothing here is real user content.
import { PhChatCircle, PhHeart, PhUsersThree } from '@phosphor-icons/vue'
import type { CommunitiesFeed, Community, CommunityPost } from '#shared/types/communities'

definePageMeta({ layout: 'news' })
const { t, locale } = useI18n()
const { number } = useFormat()
useHead({ title: () => t('communities.pageTitle') })

const { data, error } = await useFetch<CommunitiesFeed>('/api/communities')
const route = useRoute()
const router = useRouter()
const selected = computed(() => String(route.query.c ?? ''))
const select = (id: string) => router.replace({ query: id ? { c: id } : {} })
const byId = computed(() => new Map((data.value?.communities ?? []).map(c => [c.id, c])))
const posts = computed(() => (data.value?.posts ?? []).filter(p => !selected.value || p.communityId === selected.value))

// Join is a mock: remembered in this browser only.
const joined = ref(new Set<string>())
onMounted(() => {
  try { joined.value = new Set(JSON.parse(localStorage.getItem('voz_communities') ?? '[]')) }
  catch { /* private mode: start empty */ }
})
function toggleJoin(c: Community) {
  const next = new Set(joined.value)
  if (next.has(c.id)) next.delete(c.id)
  else next.add(c.id)
  joined.value = next
  try { localStorage.setItem('voz_communities', JSON.stringify([...next])) }
  catch { /* not kept */ }
}
const members = (c: Community) => c.members + (joined.value.has(c.id) ? 1 : 0)

// Likes and poll votes are mock too: they change on screen only.
const liked = ref(new Set<string>())
const voted = ref(new Map<string, number>())
function like(p: CommunityPost) {
  const next = new Set(liked.value)
  if (next.has(p.id)) next.delete(p.id)
  else next.add(p.id)
  liked.value = next
}
const vote = (p: CommunityPost, i: number) => { voted.value = new Map(voted.value).set(p.id, i) }
const pollTotal = (p: CommunityPost) => (p.poll?.options.reduce((s, o) => s + o.votes, 0) ?? 0) + (voted.value.has(p.id) ? 1 : 0)
const optionVotes = (p: CommunityPost, i: number) => p.poll!.options[i]!.votes + (voted.value.get(p.id) === i ? 1 : 0)
const percent = (p: CommunityPost, i: number) => Math.round(100 * optionVotes(p, i) / Math.max(1, pollTotal(p)))

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  const rtf = new Intl.RelativeTimeFormat(locale.value === 'fi' ? 'fi' : 'en', { numeric: 'auto' })
  return minutes < 60 ? rtf.format(-Math.max(1, minutes), 'minute') : minutes < 1440 ? rtf.format(-Math.round(minutes / 60), 'hour') : rtf.format(-Math.round(minutes / 1440), 'day')
}
const initials = (name: string) => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
</script>

<template>
  <main id="main" class="wrap">
    <header class="head">
      <h1 class="title">{{ t('communities.title') }}</h1>
      <p class="lead">{{ t('communities.lead') }}</p>
      <p class="mock">{{ t('communities.mockNote') }}</p>
    </header>

    <p v-if="error" class="notice" role="alert">{{ t('communities.loadError') }}</p>
    <div v-else-if="data" class="layout">
      <section class="feed" aria-labelledby="feed-title">
        <h2 id="feed-title" class="sr-only">{{ t('communities.feed') }}</h2>
        <!-- Filter: all communities or one. -->
        <div class="filters" role="group" :aria-label="t('communities.filter')">
          <button type="button" class="filter" :aria-pressed="!selected" @click="select('')">{{ t('communities.all') }}</button>
          <button
            v-for="c in data.communities" :key="c.id" type="button" class="filter" :aria-pressed="selected === c.id"
            @click="select(c.id)"
          >
            {{ c.name }}
          </button>
        </div>

        <ol class="posts">
          <li v-for="p in posts" :key="p.id">
            <article class="post" :lang="p.lang">
              <p class="post-meta">
                <span class="avatar" aria-hidden="true">{{ initials(p.author) }}</span>
                <span class="who">
                  <strong class="author">{{ p.author }}</strong>
                  <span v-if="p.role === 'moderator'" class="mod">{{ t('communities.moderator') }}</span>
                  <span class="sub">
                    <button type="button" class="community-link" @click="select(p.communityId)">{{ byId.get(p.communityId)?.name }}</button>
                    · <time :datetime="p.at">{{ ago(p.at) }}</time>
                  </span>
                </span>
              </p>
              <h3 v-if="p.title" class="post-title">{{ p.title }}</h3>
              <p class="post-text">{{ p.text }}</p>

              <fieldset v-if="p.poll" class="poll">
                <legend class="poll-q">{{ p.poll.question }}</legend>
                <template v-if="voted.has(p.id)">
                  <div v-for="(o, i) in p.poll.options" :key="o.label" class="poll-result" :class="{ 'poll-result--mine': voted.get(p.id) === i }">
                    <span class="bar" :style="{ width: `${percent(p, i)}%` }" aria-hidden="true" />
                    <span class="poll-label">{{ o.label }}</span>
                    <span class="poll-pct num">{{ percent(p, i) }}%</span>
                  </div>
                </template>
                <template v-else>
                  <button v-for="(o, i) in p.poll.options" :key="o.label" type="button" class="poll-option" @click="vote(p, i)">{{ o.label }}</button>
                </template>
                <p class="poll-total num">{{ t('communities.votes', { n: number(pollTotal(p)) }) }}</p>
              </fieldset>

              <p v-if="p.tags.length" class="tags">
                <span v-for="tag in p.tags" :key="tag" class="tag">{{ tag }}</span>
              </p>
              <div class="actions">
                <button type="button" class="act" :class="{ 'act--on': liked.has(p.id) }" :aria-pressed="liked.has(p.id)" @click="like(p)">
                  <PhHeart :size="16" :weight="liked.has(p.id) ? 'fill' : 'regular'" aria-hidden="true" />
                  <span class="num">{{ number(p.likes + (liked.has(p.id) ? 1 : 0)) }}</span>
                  <span class="sr-only">{{ t('communities.like') }}</span>
                </button>
                <span class="act act--static"><PhChatCircle :size="16" aria-hidden="true" /><span class="num">{{ number(p.replies) }}</span><span class="sr-only">{{ t('communities.replies') }}</span></span>
                <NewsShareMenu compact align="start" :path="`/communities?c=${p.communityId}`" :text="p.title ?? p.text" :label="t('share.postLabel', { name: p.author })" />
              </div>
            </article>
          </li>
        </ol>
      </section>

      <aside class="side" aria-labelledby="side-title">
        <h2 id="side-title" class="side-title"><PhUsersThree :size="20" weight="bold" aria-hidden="true" />{{ t('communities.popular') }}</h2>
        <ul class="community-list">
          <li v-for="c in data.communities" :key="c.id" class="community">
            <div class="community-text">
              <button type="button" class="community-name" @click="select(c.id)">{{ c.name }}</button>
              <p class="community-desc">{{ c.description }}</p>
              <p class="community-members num">{{ t('communities.members', { n: number(members(c)) }) }}</p>
            </div>
            <button type="button" class="join" :aria-pressed="joined.has(c.id)" @click="toggleJoin(c)">
              {{ joined.has(c.id) ? t('communities.joined') : t('communities.join') }}<span class="sr-only">: {{ c.name }}</span>
            </button>
          </li>
        </ul>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.wrap { max-width: calc(var(--page-max) + 2 * 16px); margin: 0 auto; padding: 24px 16px 0; }
@media (min-width: 768px) { .wrap { padding: 32px 30px 0; max-width: calc(var(--page-max) + 2 * 30px); } }
.title { margin: 0; font-size: 32px; line-height: 1.2; font-weight: 700; color: var(--headline); }
.lead { margin: 8px 0 0; max-width: 70ch; line-height: 1.5; color: var(--summary); }
.mock { margin: 6px 0 0; font-size: 12px; color: var(--meta); }
.notice { margin: 24px 0; padding: 14px 16px; border-radius: 4px; background: var(--surface); color: var(--text-2); }

.layout { margin-top: 24px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px; }
@media (min-width: 1024px) { .layout { grid-template-columns: minmax(0, 1fr) 320px; } }

.filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.filter {
  min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--bg);
  color: var(--summary); font-size: 13px; font-weight: 700; cursor: pointer;
}
.filter:hover { color: var(--headline); }
.filter[aria-pressed="true"] { background: var(--headline); border-color: var(--headline); color: var(--bg); }

.posts { list-style: none; margin: 0; padding: 0; }
.post { padding: 20px 0; border-bottom: 1px solid var(--line); }
.post-meta { margin: 0; display: flex; gap: 10px; align-items: center; }
.avatar {
  flex: 0 0 auto; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
  background: var(--surface); color: var(--headline); font-size: 13px; font-weight: 700;
}
.who { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; min-width: 0; }
.author { font-size: 15px; color: var(--headline); }
.mod { padding: 1px 8px; border-radius: 999px; background: var(--board); color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.sub { width: 100%; font-size: 13px; color: var(--meta); }
.community-link, .community-name { padding: 0; border: 0; background: none; font: inherit; font-weight: 600; color: var(--link-hover); cursor: pointer; text-align: left; }
.community-link:hover, .community-name:hover { text-decoration: underline; }
.post-title { margin: 12px 0 0; font-size: 18px; line-height: 1.35; font-weight: 700; color: var(--headline); }
.post-text { margin: 8px 0 0; font-size: 16px; line-height: 1.6; color: var(--text-2); overflow-wrap: anywhere; }

.poll { margin: 12px 0 0; padding: 12px; border: 1px solid var(--line-strong); border-radius: 8px; display: flex; flex-direction: column; gap: 6px; }
.poll-q { padding: 0 4px; font-size: 14px; font-weight: 700; color: var(--headline); }
.poll-option {
  min-height: 44px; padding: 0 14px; border: 1px solid var(--border-control); border-radius: 6px; background: var(--bg);
  color: var(--headline); font-size: 14px; font-weight: 600; text-align: left; cursor: pointer;
}
.poll-option:hover { background: var(--surface); }
.poll-result { position: relative; min-height: 40px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-radius: 6px; overflow: hidden; background: var(--surface); }
.bar { position: absolute; inset: 0 auto 0 0; background: var(--line-strong); }
.poll-result--mine .bar { background: var(--accent); }
.poll-label, .poll-pct { position: relative; font-size: 14px; font-weight: 600; color: var(--headline); }
.poll-total { margin: 2px 4px 0; font-size: 12px; color: var(--meta); }

.tags { margin: 10px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }
.tag { padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line-strong); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--summary); }
.actions { margin-top: 8px; display: flex; align-items: center; gap: 4px; }
.act {
  min-height: 36px; padding: 0 10px; display: inline-flex; align-items: center; gap: 5px; border: 0; border-radius: 999px;
  background: none; color: var(--summary); font-size: 13px; font-weight: 600; cursor: pointer;
}
.act:hover { background: var(--surface); color: var(--headline); }
.act--on { color: var(--loss); }
.act--static { cursor: default; }
.act--static:hover { background: none; color: var(--summary); }

.side-title { margin: 0 0 8px; display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; color: var(--headline); }
.community-list { list-style: none; margin: 0; padding: 0; }
.community { padding: 14px 0; border-bottom: 1px solid var(--line); display: flex; gap: 12px; align-items: flex-start; }
.community-text { flex: 1 1 auto; min-width: 0; }
.community-name { font-size: 15px; }
.community-desc { margin: 4px 0 0; font-size: 13px; line-height: 1.45; color: var(--summary); }
.community-members { margin: 4px 0 0; font-size: 12px; color: var(--meta); }
.join {
  flex: 0 0 auto; min-height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--accent);
  background: var(--accent); color: var(--on-accent); font-size: 13px; font-weight: 700; cursor: pointer;
}
.join[aria-pressed="true"] { background: var(--bg); color: var(--headline); border-color: var(--border-control); }
.filter:focus-visible, .poll-option:focus-visible, .act:focus-visible, .join:focus-visible, .community-link:focus-visible, .community-name:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
