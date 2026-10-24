// Duration of an MP3 file from its frame headers, so podcast episodes show their real length.
// Pure code (no Nuxt imports), tested under plain Node. Handles a leading ID3v2 tag, a Xing/Info
// frame count (VBR) and otherwise assumes a constant bitrate (what the TTS API returns).

// Bitrates in kbps by [MPEG-1 ? 0 : 1][bitrate index], Layer III.
const BITRATES = [
  [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
]
// Sample rates in Hz by MPEG version bits (0 = 2.5, 2 = 2, 3 = 1).
const RATES: Record<number, number[]> = { 0: [11025, 12000, 8000], 2: [22050, 24000, 16000], 3: [44100, 48000, 32000] }

/** Seconds of audio, or null when no MPEG Layer III frame is found. */
export function mp3Duration(bytes: Uint8Array): number | null {
  let i = 0
  // ID3v2: "ID3", version (2), flags (1), size as 4 syncsafe bytes.
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 && bytes.length > 10) {
    i = 10 + ((bytes[6]! & 0x7F) << 21 | (bytes[7]! & 0x7F) << 14 | (bytes[8]! & 0x7F) << 7 | (bytes[9]! & 0x7F))
  }
  for (; i + 4 <= bytes.length; i++) {
    if (bytes[i] !== 0xFF || (bytes[i + 1]! & 0xE0) !== 0xE0) continue
    const version = (bytes[i + 1]! >> 3) & 0x03
    const layer = (bytes[i + 1]! >> 1) & 0x03
    const bitrateIndex = bytes[i + 2]! >> 4
    const rateIndex = (bytes[i + 2]! >> 2) & 0x03
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) continue
    const mpeg1 = version === 3
    const kbps = BITRATES[mpeg1 ? 0 : 1]![bitrateIndex]!
    const rate = RATES[version]![rateIndex]!
    const samplesPerFrame = mpeg1 ? 1152 : 576
    const mono = (bytes[i + 3]! >> 6) === 3
    // Xing/Info header (VBR): its frame count gives the exact length.
    const side = mpeg1 ? (mono ? 17 : 32) : (mono ? 9 : 17)
    const x = i + 4 + side
    const tag = String.fromCharCode(...bytes.subarray(x, x + 4))
    if ((tag === 'Xing' || tag === 'Info') && (bytes[x + 7]! & 0x01)) {
      const frames = (bytes[x + 8]! << 24 | bytes[x + 9]! << 16 | bytes[x + 10]! << 8 | bytes[x + 11]!) >>> 0
      return Math.round(frames * samplesPerFrame / rate * 10) / 10
    }
    return Math.round((bytes.length - i) * 8 / (kbps * 1000) * 10) / 10
  }
  return null
}
