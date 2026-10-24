// Run with: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mp3Duration } from '../shared/utils/mp3.ts'

// MPEG-2 Layer III, 128 kbps, 24 kHz, mono: the frame header the TTS API returns.
const HEADER = [0xFF, 0xF3, 0xC4, 0xC4]

function cbr(bytes: number, prefix: number[] = []): Uint8Array {
  const out = new Uint8Array(prefix.length + bytes)
  out.set(prefix)
  out.set(HEADER, prefix.length)
  return out
}

test('constant bitrate: length from size and bitrate', () => {
  // 128 kbps = 16 000 bytes per second
  assert.equal(mp3Duration(cbr(16_000 * 25)), 25)
  assert.equal(mp3Duration(cbr(84_864)), 5.3)
})

test('a leading ID3v2 tag is skipped', () => {
  const id3 = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20, ...new Array(20).fill(0)]
  assert.equal(mp3Duration(cbr(16_000 * 10, id3)), 10)
})

test('Xing header: length from the frame count', () => {
  const bytes = cbr(4_000)
  const x = 4 + 9 // header + MPEG-2 mono side info
  bytes.set([0x58, 0x69, 0x6E, 0x67, 0, 0, 0, 0x01, 0, 0, 0x03, 0xE8], x) // "Xing", frames flag, 1000 frames
  assert.equal(mp3Duration(bytes), 24) // 1000 * 576 / 24 000
})

test('not an MP3: null', () => {
  assert.equal(mp3Duration(new TextEncoder().encode('<html>not audio</html>')), null)
})
