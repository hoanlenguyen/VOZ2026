// Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COMMENT_MAX, cleanCommentText } from '../shared/utils/comments.ts'

test('comment text: tags removed, spaces and blank lines tidied', () => {
  assert.deepEqual(cleanCommentText('  <b>Great</b>   game!\r\n\r\n\r\n\r\nForest <script>x</script>deserved more.  '), { text: 'Great game!\n\nForest xdeserved more.' })
})

test('comment text: empty, too short and too long are refused', () => {
  assert.deepEqual(cleanCommentText('   '), { error: 'empty' })
  assert.deepEqual(cleanCommentText(42), { error: 'empty' })
  assert.deepEqual(cleanCommentText('a'), { error: 'short' })
  assert.deepEqual(cleanCommentText('x'.repeat(COMMENT_MAX + 1)), { error: 'long' })
  assert.deepEqual(cleanCommentText('x'.repeat(COMMENT_MAX)), { text: 'x'.repeat(COMMENT_MAX) })
})
