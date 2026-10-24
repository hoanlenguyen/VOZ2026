import assert from 'node:assert/strict'
import { test } from 'node:test'
import { modelId, modelLabel } from '../shared/utils/model-name.ts'

test('display names become API ids, ids pass through', () => {
  assert.equal(modelId('GPT-6 Luna'), 'gpt-6-luna')
  assert.equal(modelId('gpt-6-luna'), 'gpt-6-luna')
  assert.equal(modelId('  GPT-6   Sol '), 'gpt-6-sol')
})

test('ids become display names', () => {
  assert.equal(modelLabel('gpt-6-luna'), 'GPT-6 Luna')
  assert.equal(modelLabel('GPT-6 Luna'), 'GPT-6 Luna')
  assert.equal(modelLabel('gpt-6-sol-mini'), 'GPT-6 Sol Mini')
})
