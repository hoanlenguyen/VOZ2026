// Newsroom image store for match story covers. Workers has no filesystem, so images live in
// "kvcache" (Workers KV in production, memory in dev) as base64, keyed by a content hash; they are
// served by /api/images/:id with a long cache (the id changes when the bytes do).
// Only JPEG, PNG and WebP, recognised by their bytes (never SVG, which can carry script), up to 2 MB.

export const IMAGE_ID = /^[a-f0-9]{32}$/
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const key = (id: string) => `newsroom:image:${id}`

interface StoredImage { type: string, data: string }

/** The image type from its first bytes, or null when it is not a JPEG, PNG or WebP. */
export function imageType(bytes: Uint8Array): string | null {
  const at = (i: number, ...b: number[]) => b.every((x, j) => bytes[i + j] === x)
  if (at(0, 0xFF, 0xD8, 0xFF)) return 'image/jpeg'
  if (at(0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return 'image/png'
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'
  return null
}

export const imageUrl = (id: string) => `/api/images/${id}`

export async function saveImage(bytes: Uint8Array): Promise<string> {
  const type = imageType(bytes)
  if (!type) throw createError({ statusCode: 415, statusMessage: 'Use a JPEG, PNG or WebP image' })
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw createError({ statusCode: 413, statusMessage: 'The image is larger than 2 MB' })
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))
  const id = [...hash.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('')
  let data = ''
  for (let i = 0; i < bytes.length; i += 0x8000) data += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  await useStorage('kvcache').setItem<StoredImage>(key(id), { type, data: btoa(data) })
  return id
}

export async function loadImage(id: string): Promise<{ type: string, bytes: Uint8Array } | null> {
  const img = await useStorage('kvcache').getItem<StoredImage>(key(id)).catch(() => null)
  if (!img?.data) return null
  return { type: img.type, bytes: Uint8Array.from(atob(img.data), c => c.charCodeAt(0)) }
}
