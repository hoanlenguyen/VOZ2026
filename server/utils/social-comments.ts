// Mock social-media posts for the match discussion (demo): a handful of fan posts "from"
// Instagram, TikTok, Facebook, Threads and X, written here from the match's own facts (teams,
// score, status). Handles and names are invented; the UI labels every post as a mock. Seeded by
// the match key, so a match always shows the same posts.
import type { SocialComment, SocialPlatform } from '#shared/types/comments'
import type { Match } from '#shared/types/sports'

type Outcome = 'win' | 'draw' | 'upcoming' | 'live'
interface Ctx { w: string, l: string, home: string, away: string, score: string, venue: string }

// {w} winner, {l} loser, {home}/{away}, {score} "2–1", {venue}. Draws use home/away.
const POSTS: Record<Outcome, Array<[SocialPlatform, (c: Ctx) => string]>> = {
  win: [
    ['instagram', c => `Matchday done right. ${c.w} take the points, ${c.score} at full time. What a feeling!`],
    ['tiktok', c => `POV: you said ${c.w} would win and everyone laughed. ${c.score}. Who's laughing now`],
    ['facebook', c => `Proud of the lads today. ${c.w} ${c.score} ${c.l} and the whole ground could feel it coming. Onto the next one.`],
    ['threads', c => `Hot take: ${c.l} weren't as bad as the ${c.score} suggests, ${c.w} were just sharper when it mattered.`],
    ['x', c => `FT: ${c.home} ${c.score} ${c.away}. ${c.w} fans, how are we feeling? ${c.l} fans, be honest.`],
    ['instagram', c => `Scenes after the final whistle. Nobody wanted to leave ${c.venue} tonight.`],
    ['x', c => `${c.l} need answers after that one. ${c.score} and it could have been more.`],
  ],
  draw: [
    ['x', c => `FT: ${c.home} ${c.score} ${c.away}. Point each, and honestly both sides will feel they should have had more.`],
    ['facebook', c => `Not the result we wanted but not the end of the world either. ${c.score} at ${c.venue}, back again next week.`],
    ['threads', c => `${c.score} feels about right. ${c.home} had the better spells, ${c.away} had the better chances.`],
    ['tiktok', c => `${c.home} vs ${c.away} in one word: chaos. ${c.score} and my nerves are gone`],
    ['instagram', c => `Shared the points, shared the noise. Great atmosphere for ${c.home} v ${c.away} today.`],
  ],
  live: [
    ['x', c => `${c.home} ${c.score} ${c.away} right now. This is getting tense.`],
    ['threads', c => `Watching ${c.home} v ${c.away} and I've stopped breathing. ${c.score}.`],
    ['instagram', c => `Live from ${c.venue}. ${c.score} and the noise is unreal.`],
    ['tiktok', c => `Me refreshing the score every 10 seconds: ${c.home} ${c.score} ${c.away}`],
  ],
  upcoming: [
    ['x', c => `Prediction time: ${c.home} v ${c.away}. I'm going 2–1 ${c.home}. Yours?`],
    ['instagram', c => `Countdown is on. ${c.home} v ${c.away} at ${c.venue}, who's going?`],
    ['facebook', c => `Big one coming up against ${c.away}. Tickets sorted, scarf ready. Come on ${c.home}!`],
    ['tiktok', c => `Things I'm nervous about this week: 1) ${c.home} v ${c.away} 2) nothing else`],
    ['threads', c => `${c.away} have the form but ${c.home} have the home crowd. Calling it a draw.`],
  ],
}

// Invented fan handles; {team} is a slug of a team name.
const HANDLES = ['{team}_fanzone', 'terrace.talk', '{team}.daily', 'the_away_end', 'matchday_moments', 'footy_in_five', '{team}_till_the_end', 'groundhopper.notes']
const NAMES = ['Sam K.', 'Aino V.', 'Dev P.', 'Laura M.', 'Tomi H.', 'Chris B.', 'Nora S.', 'Jamie R.']

function rand(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  let a = h >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')

export function mockSocialComments(m: Match, count = 4): SocialComment[] {
  const r = rand(`social:${m.key}`)
  const hs = m.home.score ?? 0
  const as = m.away.score ?? 0
  const outcome: Outcome = m.status === 'scheduled' ? 'upcoming' : m.status === 'live' ? 'live' : hs === as ? 'draw' : 'win'
  const homeWon = hs > as
  const ctx: Ctx = {
    home: m.home.shortName, away: m.away.shortName, score: `${hs}–${as}`, venue: m.venue ?? 'the ground',
    w: homeWon ? m.home.shortName : m.away.shortName, l: homeWon ? m.away.shortName : m.home.shortName,
  }
  // A shuffled pick, at most one post per platform so the sources vary.
  const pool = [...POSTS[outcome]].sort(() => r() - 0.5)
  const seen = new Set<SocialPlatform>()
  const picked = pool.filter(([p]) => !seen.has(p) && seen.add(p)).slice(0, count)
  const start = Date.parse(m.start)
  return picked.map(([platform, write], i) => {
    const team = slug(r() < 0.5 ? m.home.shortName : m.away.shortName)
    const minutes = outcome === 'upcoming' ? -(60 + Math.floor(r() * 48 * 60)) : outcome === 'live' ? 15 + Math.floor(r() * 60) : 110 + Math.floor(r() * 240)
    return {
      id: `social-${i}`,
      platform,
      handle: `@${HANDLES[Math.floor(r() * HANDLES.length)]!.replace('{team}', team)}`,
      name: NAMES[Math.floor(r() * NAMES.length)]!,
      text: write(ctx),
      at: new Date(Math.min(Date.now(), start + minutes * 60_000)).toISOString(),
      likes: Math.floor(40 + r() ** 2 * 4000),
    }
  }).sort((a, b) => b.at.localeCompare(a.at))
}
