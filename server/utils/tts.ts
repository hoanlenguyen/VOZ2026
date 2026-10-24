// Text to speech for the podcasts: OpenAI POST /v1/audio/speech, MP3 out (fetch, so it runs on
// Workers). One retry on 429/5xx; the key never appears in errors.
// Note: OpenAI deprecates the /v1/audio/speech models on 2027-01-06 (successor: the Realtime API).
// The demo episodes are pre-generated files, so they keep playing after that.

export function ttsConfig() {
  const c = useRuntimeConfig()
  return { key: String(c.openaiApiKey || ''), baseUrl: String(c.openaiBaseUrl), model: String(c.openaiTtsModel), voice: String(c.podcastVoice) }
}

/** MP3 of `input`; `speed` 0.25–4 (1 = normal). */
export async function speak(input: string, instructions: string, speed = 1): Promise<Uint8Array> {
  const { key, baseUrl, model, voice } = ttsConfig()
  if (!key) throw new Error('NUXT_OPENAI_API_KEY is not set')
  const body = JSON.stringify({ model, voice, input, instructions, response_format: 'mp3', ...(speed !== 1 ? { speed: Math.round(speed * 100) / 100 } : {}) })
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/audio/speech`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(60_000),
    })
    if (res.ok) return new Uint8Array(await res.arrayBuffer())
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      continue
    }
    const detail = await res.json().then((j: { error?: { message?: string } }) => j.error?.message ?? '', () => '')
    throw new Error(`OpenAI speech ${res.status}${detail ? `: ${detail}` : ''}`)
  }
}
