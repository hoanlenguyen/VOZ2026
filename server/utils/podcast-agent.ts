// AI podcast desk: a 20–30 second spoken bulletin about one match, team or league.
//
// 1. Facts: resolveSubject() (podcast-subjects.ts) builds the verified fact ledger.
// 2. Script: one Responses call (no tools, JSON {title, sentences: [{text, facts}]}), checked by
//    checkStory() with a word range sized for 20–30 seconds of speech; one retry with the issues,
//    then give up. Text that failed the check is never read aloud.
// 3. Audio: OpenAI text to speech (tts.ts), MP3; the real length is read from the file (mp3.ts).
// 4. Store: kvcache `podcast:ep:<id>` (episode) and `podcast:audio:<id>` (MP3, base64), an index of
//    the newest ids, and per subject + language the latest episode, so a daily run skips subjects
//    whose facts did not change. Demo episodes are bundled: data/podcasts/<id>.json (server assets
//    "podcasts") with the audio in public/podcasts/<id>.mp3 (`npm run warm:podcasts`).

import type { PodcastEpisode, PodcastRun, PodcastRunResult, PodcastSchedule, PodcastSubject, PodcastTrigger } from '#shared/types/podcast'
import type { StoryDraft } from '#shared/types/story'
import type { Lang } from '#shared/utils/format'
import type { ResolvedSubject } from './podcast-subjects'
import type { ResponseItem } from './llm'

/** Bump after changing the writer's instructions, the facts it gets or the spoken intro/outro. */
const PODCAST_PROMPT_VERSION = 'v1'
/**
 * Script words (intro and outro excluded) for 20–30 seconds. Measured with the default voice:
 * English ~2.6 words/s, Finnish ~1.4 words/s (longer words, read more slowly). A recording that still
 * runs over MAX_SECONDS is read again a little faster.
 */
export const PODCAST_WORDS: Record<Lang, [number, number]> = { en: [38, 54], fi: [26, 34] }
const MAX_EPISODES_PER_MINUTE = 12
const MAX_SECONDS = 30
/** Fastest re-read for an over-long recording; the voice still sounds natural up to here. */
const MAX_SPEED = 1.15
const INDEX_SIZE = 60
const TTL = 120 * 86_400
/** Daily run (UTC); keep in step with wrangler.jsonc `triggers.crons` and nuxt.config scheduledTasks. */
export const PODCAST_CRON = '0 5 * * *'

export const DEFAULT_SCHEDULE: PodcastSchedule = {
  subjects: [
    // Ipswich: the team of the demo's deep-data match.
    { kind: 'team', competitionId: 'premier-league', teamKey: 'premier-league:349' },
    { kind: 'league', competitionId: 'premier-league' },
    { kind: 'league', competitionId: 'liiga' },
  ],
  langs: ['en', 'fi'],
}

const INTRO: Record<Lang, { match: string, daily: string }> = {
  en: { match: 'This is VOZ.', daily: 'Good morning from VOZ.' },
  fi: { match: 'Tämä on VOZ.', daily: 'Huomenta, tässä VOZ.' },
}
const OUTRO: Record<Lang, string> = { en: 'That is all from VOZ for now, thanks for listening.', fi: 'Siinä tällä kertaa, kuulemisiin!' }

const LANGUAGE: Record<Lang, string> = { en: 'English', fi: 'Finnish' }

// Read the whole text: without the last line the model sometimes drops the short sign-off.
const VOICE_COMMON = 'Say the brand name Voz as one word, rhyming with dose. Read the whole text, including the final sign-off.'
const VOICE_STYLE: Record<Lang, string> = {
  en: `You are an upbeat, clear sports radio host reading a short news bulletin. Natural pace, light energy. Read a score such as 1–1 as "one-one" and 2–0 as "two-nil". ${VOICE_COMMON}`,
  fi: `Speak Finnish with natural Finnish pronunciation, as an upbeat, clear Finnish sports radio host reading a short news bulletin. Natural pace, light energy. Read a score such as 1–1 as "yksi–yksi" and 2–0 as "kaksi–nolla"; say English team names the English way. ${VOICE_COMMON}`,
}

/** What the voice reads: the brand as a word ("VOZ" is read as letters or as "VAR"), the sign-off as its own paragraph. */
const spoken = (intro: string, sentences: string[], outro: string) =>
  `${[intro, ...sentences].join(' ')}\n\n${outro}`.replace(/\bVOZ\b/g, 'Voz')

const storage = () => useStorage('kvcache')
const callTimes: number[] = []
const inFlight = new Map<string, Promise<PodcastEpisode>>()
let indexQueue: Promise<void> = Promise.resolve()

/** FNV-1a, as in story-cache.ts. */
function hash(s: string): string {
  let h = 0x811C9DC5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

function underRateLimit(): boolean {
  const now = Date.now()
  while (callTimes.length && now - callTimes[0]! > 60_000) callTimes.shift()
  if (callTimes.length >= MAX_EPISODES_PER_MINUTE) return false
  callTimes.push(now)
  return true
}

/** Today in Helsinki (the newsroom's day), YYYY-MM-DD. */
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' })

export function episodeId(s: ResolvedSubject, lang: Lang): string {
  return s.daily ? `${s.subjectId}.${today()}.${lang}` : `${s.subjectId}.${lang}`
}

function instructions(s: ResolvedSubject, lang: Lang): string {
  const [min, max] = PODCAST_WORDS[lang]
  const what = s.subject.kind === 'match'
    ? `the match ${s.label} (${s.competitionName}): the result and how it happened, one or two telling numbers, what it means in the table`
    : s.subject.kind === 'team'
      ? `${s.label} (${s.competitionName}): their latest result and how it came about, where they stand, their next game`
      : `the ${s.competitionName}: the latest results in a few words each, the top of the table, a game coming up`
  return `You are the podcast desk of VOZ, a Finnish sports news app. Write the script of a 20–30 second audio bulletin about ${what}, using only the verified facts you are given. A text-to-speech voice reads it right after the line "${INTRO[lang][s.daily ? 'daily' : 'match']}" and before "${OUTRO[lang]}"; do not repeat those lines.

Style:
- ${LANGUAGE[lang]}, written for the ear: short, complete, flowing sentences, plain words, a lively radio voice. No lists, colons, semicolons, fragments, brackets, abbreviations (say "expected goals", not "xG"), links or emoji.
- ${min}–${max} words in total, 3–5 sentences: it must fit in 20–30 seconds of speech. A title for the episode list of 4–10 words, in sentence case.${lang === 'fi' ? '\n- Natural Finnish sports radio, not a translation. "Maaliodottama" for expected goals (never the English term), "laukaukset" for shots; table places as "9. sijalla", minutes as "41. minuutilla". Make the teams the subjects of their sentences, so the basic form is correct Finnish: "Nott\'m Forest laukoi 17 kertaa ja Ipswich 7", not "Laukaukset menivät Nott\'m Forest 17–7".' : ''}
- Name teams exactly as written in the facts${lang === 'fi' ? ' and keep them in the basic form, without case endings (write "Ipswich ja Nott\'m Forest pelasivat", not "Ipswichin" or "Forestille"); build sentences so that the basic form reads naturally' : ''}.

Accuracy (a checker rejects anything else):
- Every sentence cites the ids of the facts it uses. Every number and every person in a sentence must appear in a fact that sentence cites. Write numbers as digits${lang === 'fi' ? ', with a decimal comma (2,29, not 2.29)' : ''}. Never compute new numbers.
- No quotes, speech, injuries, emotions, crowd reactions, or anything about earlier seasons ("history", "record") unless a cited fact says it.
- Table places as the facts state them: never say a team rose, climbed, dropped or moved unless a fact says so.

Reply only with JSON: {"title": "...", "sentences": [{"text": "...", "facts": ["f1", ...]}, ...]}`
}

function brief(s: ResolvedSubject): string {
  return [`${s.competitionName}, ${s.def.sport}. Subject: ${s.label}.`, 'Facts:', ...s.facts.map(f => `${f.id} [${f.section}] ${f.text}`)].join('\n')
}

function parseDraft(output: Array<{ type?: string, [k: string]: unknown }>): StoryDraft | null {
  const message = output.find(o => o.type === 'message') as { content?: Array<{ type: string, text?: string }> } | undefined
  const text = message?.content?.find(c => c.type === 'output_text')?.text ?? ''
  try {
    const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { title?: unknown, sentences?: unknown }
    if (typeof j.title !== 'string' || !Array.isArray(j.sentences)) return null
    const sentences = (j.sentences as Array<{ text?: unknown, facts?: unknown }>)
      .filter(x => typeof x?.text === 'string' && Array.isArray(x.facts))
      .map(x => ({ text: (x.text as string).trim(), facts: (x.facts as unknown[]).filter((f): f is string => typeof f === 'string'), paragraph: 1 }))
    return { headline: j.title.trim(), sentences }
  }
  catch {
    return null
  }
}

/** The checked script, or null after two rejected attempts. */
async function writeScript(s: ResolvedSubject, lang: Lang): Promise<{ draft: StoryDraft, check: ReturnType<typeof checkStory> } | null> {
  const ctx = { facts: s.facts, names: s.names, length: 'short' as const, lang, words: PODCAST_WORDS[lang] }
  const input: ResponseItem[] = [{ role: 'user', content: brief(s) }]
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await respond({ instructions: instructions(s, lang), input, tools: [], max_output_tokens: 4000 })
    const draft = parseDraft(res.output as Array<{ type?: string }>)
    const check = draft ? checkStory(draft, ctx) : { passed: false, issues: ['The reply was not the JSON asked for.'], factsUsed: 0 }
    if (draft && check.passed) return { draft, check }
    console.info(`[podcast] ${s.subjectId} ${lang} attempt ${attempt + 1} rejected: ${check.issues.slice(0, 3).join(' ')}`)
    input.push(...res.output, { role: 'user', content: `The checker rejected it:\n- ${check.issues.join('\n- ')}\nFix every problem and reply with the JSON again.` })
  }
  return null
}

const toBase64 = (bytes: Uint8Array) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))

async function bundledEpisodes(): Promise<PodcastEpisode[]> {
  const assets = useStorage('assets:podcasts')
  const keys = await assets.getKeys().catch(() => [] as string[])
  const eps = await Promise.all(keys.filter(k => k.endsWith('.json')).map(k => assets.getItem<PodcastEpisode>(k).catch(() => null)))
  return eps.filter((e): e is PodcastEpisode => !!e)
}

export async function getEpisode(id: string): Promise<PodcastEpisode | null> {
  const kv = await storage().getItem<PodcastEpisode>(`podcast:ep:${id}`).catch(() => null)
  if (kv) return kv
  return (await bundledEpisodes()).find(e => e.id === id) ?? null
}

export async function episodeAudio(id: string): Promise<Uint8Array | null> {
  const b64 = await storage().getItem<string>(`podcast:audio:${id}`).catch(() => null)
  return b64 ? fromBase64(b64) : null
}

/** Index entry: enough to filter and sort without loading the episode. */
interface IndexEntry { id: string, subjectId: string, lang: Lang, at: string }

/** Newest first: generated episodes (KV) and the bundled demo ones; KV wins for the same id. */
export async function listEpisodes(opts: { lang?: Lang, subjectId?: string, limit?: number } = {}): Promise<PodcastEpisode[]> {
  const wanted = (e: { lang: Lang, subjectId: string }) => (!opts.lang || e.lang === opts.lang) && (!opts.subjectId || e.subjectId === opts.subjectId)
  const limit = opts.limit ?? 20
  const index = (await storage().getItem<IndexEntry[]>('podcast:index').catch(() => null) ?? []).filter(wanted)
  const bundled = (await bundledEpisodes()).filter(wanted)
  // Only the episodes that can make the list are loaded from KV.
  const newest = [...index.map(x => ({ id: x.id, at: x.at, kv: true })), ...bundled.map(e => ({ id: e.id, at: e.generatedAt, kv: false }))]
    .sort((a, b) => b.at.localeCompare(a.at))
  const ids = [...new Set(newest.map(x => x.id))].slice(0, limit)
  const inKv = new Set(index.map(x => x.id))
  const episodes = await Promise.all(ids.map(id => inKv.has(id)
    ? storage().getItem<PodcastEpisode>(`podcast:ep:${id}`).catch(() => null)
    : bundled.find(e => e.id === id) ?? null))
  return episodes.filter((e): e is PodcastEpisode => !!e?.audio)
}

async function latestFor(subjectId: string, lang: Lang): Promise<PodcastEpisode | null> {
  const id = await storage().getItem<string>(`podcast:latest:${subjectId}:${lang}`).catch(() => null)
  if (id) return getEpisode(id)
  return (await listEpisodes({ lang, subjectId, limit: 1 }))[0] ?? null
}

async function store(e: PodcastEpisode, audio: Uint8Array) {
  const kv = storage()
  await kv.setItem(`podcast:audio:${e.id}`, toBase64(audio), { ttl: TTL })
  await kv.setItem(`podcast:ep:${e.id}`, e, { ttl: TTL })
  await kv.setItem(`podcast:latest:${e.subjectId}:${e.lang}`, e.id, { ttl: TTL })
  // Read-modify-write of the index, one at a time in this instance (both languages finish together).
  indexQueue = indexQueue.then(async () => {
    const index = await kv.getItem<IndexEntry[]>('podcast:index').catch(() => null) ?? []
    const entry: IndexEntry = { id: e.id, subjectId: e.subjectId, lang: e.lang, at: e.generatedAt }
    await kv.setItem('podcast:index', [entry, ...index.filter(x => x.id !== e.id)].slice(0, INDEX_SIZE))
  }).catch(err => console.warn(`[podcast] index update failed: ${(err as Error).message}`))
  await indexQueue
}

async function create(s: ResolvedSubject, lang: Lang, factsHash: string, trigger: PodcastTrigger): Promise<PodcastEpisode> {
  const script = await writeScript(s, lang)
  if (!script) throw createError({ statusCode: 422, statusMessage: 'The podcast script did not pass the fact check' })
  const intro = INTRO[lang][s.daily ? 'daily' : 'match']
  const outro = OUTRO[lang]
  const text = spoken(intro, script.draft.sentences.map(x => x.text), outro)
  let audio = await speak(text, VOICE_STYLE[lang])
  const first = mp3Duration(audio)
  if (first && first > MAX_SECONDS) audio = await speak(text, VOICE_STYLE[lang], Math.min(MAX_SPEED, first / (MAX_SECONDS - 1)))
  const id = episodeId(s, lang)
  const generatedAt = new Date().toISOString()
  const cited = new Set(script.draft.sentences.flatMap(x => x.facts))
  const { model: ttsModel, voice } = ttsConfig()
  const episode: PodcastEpisode = {
    id,
    subjectId: s.subjectId,
    subject: s.subject,
    label: s.label,
    competitionName: s.competitionName,
    href: s.href,
    lang,
    title: script.draft.headline,
    sentences: script.draft.sentences,
    intro,
    outro,
    evidence: s.facts.filter(f => cited.has(f.id)),
    factsHash,
    check: script.check,
    audio: { url: `/api/podcasts/${id}/audio?v=${hash(generatedAt)}`, bytes: audio.length, seconds: mp3Duration(audio), voice, model: ttsModel },
    model: llmConfig().model,
    trigger,
    generatedAt,
  }
  await store(episode, audio)
  return episode
}

/**
 * The episode for a subject and language. Unless `force`, an existing episode whose facts read the
 * same is returned as is (status "unchanged"); otherwise a new one is written and read aloud now.
 */
export async function generateEpisode(subject: PodcastSubject, lang: Lang, opts: { trigger: PodcastTrigger, force?: boolean }): Promise<{ episode: PodcastEpisode, status: 'created' | 'unchanged' }> {
  const s = await resolveSubject(subject, lang)
  const factsHash = hash(JSON.stringify(s.facts) + llmConfig().model + ttsConfig().voice + PODCAST_PROMPT_VERSION)
  if (!opts.force) {
    const last = await latestFor(s.subjectId, lang)
    if (last && last.factsHash === factsHash) return { episode: last, status: 'unchanged' }
  }
  if (!llmConfig().key) throw createError({ statusCode: 503, statusMessage: 'NUXT_OPENAI_API_KEY is not set' })
  const key = `${s.subjectId}:${lang}`
  let run = inFlight.get(key)
  if (!run) {
    if (!underRateLimit()) throw createError({ statusCode: 429, statusMessage: 'Too many podcasts this minute; try again shortly' })
    run = create(s, lang, factsHash, opts.trigger).finally(() => inFlight.delete(key))
    inFlight.set(key, run)
  }
  return { episode: await run, status: 'created' }
}

export async function podcastSchedule(): Promise<PodcastSchedule> {
  return await storage().getItem<PodcastSchedule>('podcast:schedule').catch(() => null) ?? DEFAULT_SCHEDULE
}

export async function savePodcastSchedule(s: PodcastSchedule): Promise<void> {
  await storage().setItem('podcast:schedule', s)
}

export async function lastPodcastRun(): Promise<PodcastRun | null> {
  return storage().getItem<PodcastRun>('podcast:lastrun').catch(() => null)
}

/**
 * The daily run: every scheduled subject in every scheduled language, one after another. Failures
 * (a model call that timed out, a script that failed the check twice) get one more try at the end.
 */
export async function runDailyPodcasts(trigger: PodcastTrigger = 'schedule'): Promise<PodcastRun> {
  const schedule = await podcastSchedule()
  const attempt = async (subject: PodcastSubject, lang: Lang): Promise<PodcastRunResult> => {
    const id = podcastSubjectId(subject)
    try {
      const { episode, status } = await generateEpisode(subject, lang, { trigger })
      return { subjectId: id, lang, status, episodeId: episode.id, error: null }
    }
    catch (err) {
      const e = err as { statusMessage?: string, message?: string }
      console.warn(`[podcast] daily ${id} ${lang}: ${e.statusMessage ?? e.message}`)
      return { subjectId: id, lang, status: 'failed', episodeId: null, error: e.statusMessage ?? e.message ?? 'failed' }
    }
  }
  const jobs = schedule.subjects.flatMap(subject => schedule.langs.map(lang => ({ subject, lang })))
  const results: PodcastRunResult[] = []
  for (const j of jobs) results.push(await attempt(j.subject, j.lang))
  for (const [i, j] of jobs.entries()) {
    if (results[i]!.status === 'failed') results[i] = await attempt(j.subject, j.lang)
  }
  const run: PodcastRun = { at: new Date().toISOString(), trigger, results }
  await storage().setItem('podcast:lastrun', run).catch(() => undefined)
  return run
}
