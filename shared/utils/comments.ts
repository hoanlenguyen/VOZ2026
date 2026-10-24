// Comment text rules (plain text, shared by the API and its tests; no Nuxt imports).

export const COMMENT_MIN = 2
export const COMMENT_MAX = 1000

/** Plain text only: tags removed, line ends unified, at most one blank line in a row, trimmed. */
export function cleanCommentText(input: unknown): { text: string } | { error: 'empty' | 'short' | 'long' } {
  if (typeof input !== 'string') return { error: 'empty' }
  const text = input
    .replace(/<[^>]*>/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!text) return { error: 'empty' }
  if (text.length < COMMENT_MIN) return { error: 'short' }
  if (text.length > COMMENT_MAX) return { error: 'long' }
  return { text }
}
