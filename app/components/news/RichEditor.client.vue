<script setup lang="ts">
// TinyMCE article editor for the newsroom (self-hosted and bundled, GPL licence key, so it works
// offline too). Loaded only on the client and only on pages that use it: the import below becomes
// its own chunk. The toolbar offers exactly the tags the server keeps (server/utils/story-edits.ts).
import type { Editor } from 'tinymce'

const props = defineProps<{ modelValue: string, label: string, lang: string }>()
const emit = defineEmits<{ 'update:modelValue': [html: string] }>()
const target = ref<HTMLTextAreaElement>()
const ready = ref(false)
let editor: Editor | null = null
// TinyMCE fires a last "change" while it is removed; that must not overwrite what the page set.
let active = true

onMounted(async () => {
  const { default: tinymce } = await import('tinymce')
  await Promise.all([
    import('tinymce/models/dom/model'),
    import('tinymce/themes/silver'),
    import('tinymce/icons/default'),
    import('tinymce/skins/ui/oxide/skin.js'),
    import('tinymce/skins/ui/oxide/content.js'),
    import('tinymce/skins/content/default/content.js'),
    import('tinymce/plugins/autolink'),
    import('tinymce/plugins/link'),
    import('tinymce/plugins/lists'),
    import('tinymce/plugins/wordcount'),
  ])
  if (!target.value) return
  // The editing iframe can't see the page's CSS variables; hand it the resolved tokens.
  const css = getComputedStyle(target.value)
  const [ed] = await tinymce.init({
    target: target.value,
    license_key: 'gpl',
    skin_url: 'default',
    content_css: 'default',
    menubar: false,
    branding: false,
    promotion: false,
    height: 420,
    plugins: 'autolink link lists wordcount',
    toolbar: 'undo redo | blocks | bold italic underline strikethrough | bullist numlist blockquote | link | removeformat',
    block_formats: 'Paragraph=p; Heading=h2; Subheading=h3',
    valid_elements: 'p,br,h2,h3,blockquote,ul,ol,li,strong/b,em/i,u,s,a[href|title]',
    link_default_target: '',
    link_target_list: false,
    entity_encoding: 'raw',
    content_style: `body { font-family: ${css.getPropertyValue('--font-body')}; font-size: 16px; line-height: 1.6; color: ${css.getPropertyValue('--headline')}; background: ${css.getPropertyValue('--bg')}; }`,
    iframe_aria_text: props.label,
    setup: (e: Editor) => {
      e.on('init', () => {
        e.setContent(props.modelValue || '')
        e.getBody().setAttribute('lang', props.lang)
        ready.value = true
      })
      // Only the editor's own edits are reported (not content set from outside), so the page can
      // tell whether anything changed ("Cancel changes").
      e.on('input change undo redo', () => { if (active) emit('update:modelValue', e.getContent()) })
    },
  })
  editor = ed ?? null
})

// Revert / reload from outside: only push content the editor doesn't already have.
watch(() => props.modelValue, (html) => {
  if (editor && ready.value && html !== editor.getContent()) editor.setContent(html || '')
})

onBeforeUnmount(() => {
  active = false
  editor?.remove()
})
</script>

<template>
  <div class="rich" :class="{ 'rich--loading': !ready }">
    <textarea ref="target" :aria-label="label" />
  </div>
</template>

<style scoped>
.rich { min-height: 420px; border-radius: 4px; }
.rich--loading { background: var(--surface); }
.rich--loading textarea { visibility: hidden; }
.rich :deep(.tox-tinymce) { border: 1px solid var(--border-control); border-radius: 4px; }
</style>
