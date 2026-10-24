<script setup lang="ts">
// Discussion under the match story (server/utils/comments.ts). Totals (comments, story likes) are
// shown to everyone. Subscribers and the newsroom read, post, reply (one level) and like; the
// newsroom also hides, shows and deletes any comment and posts with a "VOZ newsroom" badge. Free
// and signed-out readers get the totals, a read-only preview of the newest comments and an invitation.
import { PhChatCircle, PhHeart, PhLockSimple } from '@phosphor-icons/vue'
import type { Discussion, Engagement, PublicComment } from '#shared/types/comments'

const props = defineProps<{ competitionId: string, matchId: string, engagement: Engagement }>()
const emit = defineEmits<{ engagement: [Engagement] }>()
const { t } = useI18n()
const { account, can } = useAccount()
const route = useRoute()

const base = computed(() => `/api/competitions/${props.competitionId}/matches/${props.matchId}`)
const totals = ref<Engagement>({ ...props.engagement })
const { data, status } = useLazyFetch<Discussion>(() => `${base.value}/comments`, { server: false })
watch(data, (d) => { if (d) setTotals(d.engagement) })
function setTotals(e: Engagement) {
  totals.value = e
  emit('engagement', e)
}

const top = computed(() => (data.value?.comments ?? []).filter(c => !c.parentId).sort((a, b) => b.at.localeCompare(a.at)))
const repliesTo = (id: string) => (data.value?.comments ?? []).filter(c => c.parentId === id).sort((a, b) => a.at.localeCompare(b.at))

// Posting (top level or a reply); every change returns the updated discussion.
const text = ref('')
const replyTo = ref<string | null>(null)
const replyText = ref('')
const busy = ref(false)
const message = ref('')
const MAX = 1000
async function act(path: string, body: Record<string, unknown>, method: 'POST' | 'DELETE' = 'POST') {
  busy.value = true
  message.value = ''
  try {
    data.value = await $fetch<Discussion>(`${base.value}${path}`, { method, body: method === 'POST' ? body : undefined })
    return true
  }
  catch (err) {
    const code = (err as { statusCode?: number }).statusCode
    message.value = code === 429 ? t('discussion.errors.wait') : code === 400 ? t('discussion.errors.length') : t('discussion.errors.failed')
    return false
  }
  finally {
    busy.value = false
  }
}
async function post() {
  if (await act('/comments', { text: text.value })) {
    text.value = ''
    message.value = t('discussion.posted')
  }
}
async function postReply(parentId: string) {
  if (await act('/comments', { text: replyText.value, parentId })) {
    replyText.value = ''
    replyTo.value = null
    message.value = t('discussion.posted')
  }
}
// Likes update at once and roll back if the server refuses.
async function likeStory() {
  const d = data.value
  if (!d) return
  const liked = !d.storyLikedByMe
  d.storyLikedByMe = liked
  setTotals({ ...totals.value, likes: totals.value.likes + (liked ? 1 : -1) })
  if (!(await act('/like', { liked }))) d.storyLikedByMe = !liked
}
async function likeComment(c: PublicComment) {
  const liked = !c.likedByMe
  c.likedByMe = liked
  c.likes += liked ? 1 : -1
  await act(`/comments/${c.id}/like`, { liked })
}
const remove = (c: PublicComment) => act(`/comments/${c.id}`, {}, 'DELETE')
const hide = (c: PublicComment) => act(`/comments/${c.id}/hide`, { hidden: !c.hidden })
const loginLink = computed(() => ({ path: '/login', query: { redirect: `${route.fullPath}#discussion` } }))
</script>

<template>
  <section id="discussion" class="block discussion" aria-labelledby="discussion-title">
    <NewsSectionTitle id="discussion-title">{{ t('discussion.title') }}</NewsSectionTitle>

    <!-- Totals: everyone sees them. -->
    <div class="totals">
      <button
        v-if="can.premium && data" type="button" class="like like--story" :aria-pressed="data.storyLikedByMe"
        :disabled="busy" @click="likeStory"
      >
        <PhHeart :size="20" :weight="data.storyLikedByMe ? 'fill' : 'bold'" aria-hidden="true" />
        <span class="num">{{ totals.likes }}</span>
        <span class="sr-only">{{ t('discussion.likeStory') }}</span>
      </button>
      <span v-else class="total"><PhHeart :size="20" weight="bold" aria-hidden="true" /> {{ t('discussion.likes', { n: totals.likes }, totals.likes) }}</span>
      <span class="total"><PhChatCircle :size="20" weight="bold" aria-hidden="true" /> {{ t('discussion.comments', { n: totals.comments }, totals.comments) }}</span>
    </div>

    <template v-if="can.premium">
      <form class="composer" @submit.prevent="post">
        <label for="comment-text" class="sr-only">{{ t('discussion.write') }}</label>
        <textarea id="comment-text" v-model="text" rows="3" :maxlength="MAX" :placeholder="t('discussion.placeholder', { name: account?.name ?? '' })" />
        <div class="composer-bar">
          <span class="counter num" :class="{ 'counter--near': text.length > MAX - 100 }">{{ text.length }}/{{ MAX }}</span>
          <button type="submit" class="btn-primary" :disabled="busy || text.trim().length < 2">{{ t('discussion.post') }}</button>
        </div>
      </form>
      <p class="status" role="status" aria-live="polite">{{ message }}</p>

      <p v-if="status === 'pending'" class="hint">{{ t('discussion.loading') }}</p>
      <p v-else-if="!top.length" class="hint">{{ t('discussion.empty') }}</p>
      <ol class="comments">
        <li v-for="c in top" :key="c.id" class="thread">
          <NewsDiscussionComment
            :comment="c" :newsroom="can.newsroom" :busy="busy" can-reply
            @like="likeComment(c)" @reply="replyTo = replyTo === c.id ? null : c.id" @remove="remove(c)" @hide="hide(c)"
          />
          <ol v-if="repliesTo(c.id).length || replyTo === c.id" class="replies">
            <li v-for="r in repliesTo(c.id)" :key="r.id">
              <NewsDiscussionComment
                :comment="r" :newsroom="can.newsroom" :busy="busy"
                @like="likeComment(r)" @remove="remove(r)" @hide="hide(r)"
              />
            </li>
            <li v-if="replyTo === c.id">
              <form class="composer composer--reply" @submit.prevent="postReply(c.id)">
                <label :for="`reply-${c.id}`" class="sr-only">{{ t('discussion.replyTo', { name: c.author.name }) }}</label>
                <textarea :id="`reply-${c.id}`" v-model="replyText" rows="2" :maxlength="MAX" :placeholder="t('discussion.replyTo', { name: c.author.name })" />
                <div class="composer-bar">
                  <button type="button" class="btn-secondary" @click="replyTo = null">{{ t('discussion.cancel') }}</button>
                  <button type="submit" class="btn-primary" :disabled="busy || replyText.trim().length < 2">{{ t('discussion.reply') }}</button>
                </div>
              </form>
            </li>
          </ol>
        </li>
      </ol>
    </template>

    <!-- Free and signed-out readers: the newest comments (read-only) fading into an invitation. -->
    <div v-else class="locked">
      <ol v-if="data?.comments.length" class="comments preview" :aria-label="t('discussion.preview')">
        <li v-for="c in data.comments" :key="c.id" class="thread">
          <NewsDiscussionComment :comment="c" :newsroom="false" :busy="false" readonly />
        </li>
      </ol>
      <div class="invite">
        <PhLockSimple :size="28" weight="bold" class="invite-icon" aria-hidden="true" />
        <p class="invite-title">{{ t('discussion.lockedTitle') }}</p>
        <p class="invite-text">{{ t(account ? 'discussion.lockedFree' : 'discussion.lockedSignedOut') }}</p>
        <NuxtLink v-if="account" to="/account" class="invite-cta">{{ t('discussion.subscribe') }}</NuxtLink>
        <NuxtLink v-else :to="loginLink" class="invite-cta">{{ t('nav.signIn') }}</NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.block { margin-top: 50px; scroll-margin-top: 80px; }
.totals { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; margin-bottom: 16px; font-size: 15px; font-weight: 600; color: var(--headline); }
.total { display: inline-flex; align-items: center; gap: 6px; }
.like {
  min-height: 44px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px;
  border: 1px solid var(--border-control); background: var(--bg); color: var(--headline); font-size: 15px; font-weight: 700;
}
.like:hover { background: var(--surface); }
.like[aria-pressed="true"] { color: var(--loss); border-color: var(--loss); }

.composer { display: flex; flex-direction: column; gap: 8px; }
.composer textarea {
  width: 100%; padding: 12px 14px; border: 1px solid var(--border-control); border-radius: 4px; resize: vertical;
  background: var(--bg); color: var(--headline); font: inherit; font-size: 16px; line-height: 1.5;
}
.composer textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.composer-bar { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.counter { margin-right: auto; font-size: 12px; color: var(--meta); }
.counter--near { color: var(--loss); }
.btn-primary, .btn-secondary {
  min-height: 44px; padding: 0 20px; border-radius: 999px; font-size: 14px; font-weight: 700;
}
.btn-primary { border: 0; background: var(--accent); color: var(--on-accent); }
.btn-secondary { border: 1px solid var(--border-control); background: var(--bg); color: var(--headline); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.status { min-height: 20px; margin: 6px 0 0; font-size: 13px; color: var(--meta); }
.hint { margin: 8px 0 0; font-size: 14px; color: var(--meta); }

.comments, .replies { list-style: none; margin: 0; padding: 0; }
.thread { padding: 16px 0; border-bottom: 1px solid var(--line); }
.replies { margin: 12px 0 0 22px; padding-left: 18px; border-left: 2px solid var(--line); display: flex; flex-direction: column; gap: 12px; }
.composer--reply textarea { font-size: 15px; }

.locked { display: flex; flex-direction: column; }
/* The preview fades out towards the invitation. */
.preview { -webkit-mask-image: linear-gradient(to bottom, black 55%, transparent 100%); mask-image: linear-gradient(to bottom, black 55%, transparent 100%); }
.invite {
  margin-top: -8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 24px 16px; border-radius: 4px; text-align: center; background: var(--offer-bg); color: var(--offer-text);
}
.invite-icon { color: var(--offer-ink); }
.invite-title { margin: 0; font-size: 18px; font-weight: 700; }
.invite-text { margin: 0; max-width: 420px; font-size: 14px; line-height: 1.5; }
.invite-cta {
  margin-top: 6px; min-height: 44px; padding: 0 20px; display: inline-flex; align-items: center; border-radius: 999px;
  background: var(--offer-ink); color: var(--offer-bg); font-weight: 700; text-decoration: none;
}
.invite-cta:hover { background: var(--offer-ink-hover); color: var(--offer-bg); }
.like:focus-visible, .btn-primary:focus-visible, .btn-secondary:focus-visible, .invite-cta:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
