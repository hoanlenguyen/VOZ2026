<script setup lang="ts">
// One comment in the match discussion: author (newsroom badge), time, plain text, and actions:
// like, reply (top-level comments), delete (own, or any for the newsroom), hide / show (newsroom).
import { PhArrowBendUpLeft, PhEye, PhEyeSlash, PhHeart, PhTrash } from '@phosphor-icons/vue'
import type { PublicComment } from '#shared/types/comments'

// `readonly`: the preview for free and signed-out readers (no actions).
defineProps<{ comment: PublicComment, newsroom: boolean, busy: boolean, canReply?: boolean, readonly?: boolean }>()
defineEmits<{ like: [], reply: [], remove: [], hide: [] }>()
const { t } = useI18n()
const { stamp } = useFormat()
const initials = (name: string) => name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
</script>

<template>
  <article class="comment" :class="{ 'comment--hidden': comment.hidden }">
    <span class="avatar" :class="{ 'avatar--newsroom': comment.author.role === 'newsroom' }" aria-hidden="true">{{ initials(comment.author.name) }}</span>
    <div class="body">
      <p class="meta">
        <strong class="name">{{ comment.author.name }}</strong>
        <span v-if="comment.author.role === 'newsroom'" class="badge">{{ t('discussion.newsroomBadge') }}</span>
        <time class="num" :datetime="comment.at">{{ stamp(comment.at) }}</time>
        <span v-if="comment.hidden" class="hidden-tag">{{ t('discussion.hiddenTag') }}</span>
      </p>
      <p class="text">{{ comment.text }}</p>
      <div v-if="!readonly" class="actions">
        <button
          type="button" class="act" :class="{ 'act--liked': comment.likedByMe }" :aria-pressed="comment.likedByMe" :disabled="busy"
          :aria-label="t('discussion.likeComment', { name: comment.author.name })" @click="$emit('like')"
        >
          <PhHeart :size="16" :weight="comment.likedByMe ? 'fill' : 'regular'" aria-hidden="true" />
          <span class="num">{{ comment.likes }}</span>
        </button>
        <button v-if="canReply" type="button" class="act" @click="$emit('reply')">
          <PhArrowBendUpLeft :size="16" aria-hidden="true" /> {{ t('discussion.reply') }}
        </button>
        <button v-if="newsroom" type="button" class="act" :disabled="busy" @click="$emit('hide')">
          <component :is="comment.hidden ? PhEye : PhEyeSlash" :size="16" aria-hidden="true" />
          {{ comment.hidden ? t('discussion.show') : t('discussion.hide') }}
        </button>
        <button v-if="comment.mine || newsroom" type="button" class="act act--danger" :disabled="busy" @click="$emit('remove')">
          <PhTrash :size="16" aria-hidden="true" /> {{ t('discussion.delete') }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.comment { display: flex; gap: 12px; }
.comment--hidden { opacity: 0.55; }
.avatar {
  flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
  background: var(--surface-2); color: var(--headline); font-size: 13px; font-weight: 700;
}
.avatar--newsroom { background: var(--board); color: var(--accent); }
.body { flex: 1 1 auto; min-width: 0; }
.meta { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 13px; color: var(--meta); }
.name { font-size: 14px; color: var(--headline); }
.badge { padding: 1px 8px; border-radius: 999px; background: var(--board); color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.hidden-tag { padding: 1px 8px; border-radius: 999px; background: var(--loss); color: var(--board-text); font-size: 11px; font-weight: 700; }
.text { margin: 4px 0 0; font-size: 15px; line-height: 1.55; color: var(--text-2); white-space: pre-line; overflow-wrap: anywhere; }
.actions { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 2px; }
.act {
  min-height: 36px; padding: 0 10px; display: inline-flex; align-items: center; gap: 5px; border: 0; border-radius: 999px;
  background: none; color: var(--summary); font-size: 13px; font-weight: 600;
}
.act:hover:not(:disabled) { background: var(--surface); color: var(--headline); }
.act--liked { color: var(--loss); }
.act--danger:hover:not(:disabled) { color: var(--loss); }
.act:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
</style>
