// Mock fan communities for the "Communities" tab (demo). Communities, members and posts are invented
// for the demo; nothing is taken from real forums or social networks. Pictures are drawn in the app
// (CommunityImage.vue). Post times are relative to
// now, so the feed always looks current.
import type { CommunitiesFeed, Community, CommunityPost } from '#shared/types/communities'

const COMMUNITIES: Community[] = [
  { id: 'tractor-boys', name: 'Tractor Boys Terrace', competitionId: 'premier-league', sport: 'football', description: 'Ipswich Town fans: matchdays, away trips and transfer talk.', members: 18420 },
  { id: 'trent-end', name: 'The Trent End Collective', competitionId: 'premier-league', sport: 'football', description: 'Nottingham Forest supporters talking tactics, tickets and travel.', members: 15230 },
  { id: 'pl-tactics', name: 'Premier League Tactics Board', competitionId: 'premier-league', sport: 'football', description: 'Formations, pressing triggers and the numbers behind the results.', members: 42110 },
  { id: 'liiga-fanit', name: 'Liiga-fanit', competitionId: 'liiga', sport: 'hockey', description: 'Kaikki Liigasta: ottelut, siirrot ja sarjataulukko.', members: 23650 },
  { id: 'kiekko-stats', name: 'Hockey Numbers Club', competitionId: 'liiga', sport: 'hockey', description: 'Liiga stats nerds: xG, shot maps and power-play units.', members: 6890 },
]

// minutes: how long ago it was posted.
const POSTS: Array<Omit<CommunityPost, 'at' | 'image'> & { minutes: number, image?: CommunityPost['image'] }> = [
  { id: 'p1', image: { kind: 'coach', alt: 'Drawing of the supporters\' coach on the road at night' }, communityId: 'tractor-boys', author: 'Becky from Bramford', role: 'moderator', minutes: 38, lang: 'en',
    title: 'Matchday thread: away travel to the next fixture',
    text: 'Coaches leave Portman Road at 8:30. Still 12 seats left, reply here or message the travel team. Please bring your membership card, they check at the door this time.',
    poll: null, likes: 214, replies: 46, tags: ['Matchday', 'Away travel'] },
  { id: 'p2', communityId: 'tractor-boys', author: 'Suffolk Punch', role: 'member', minutes: 95, lang: 'en', title: null,
    text: 'Point against Forest felt like a win after that first half. Enciso is playing with so much confidence right now.',
    poll: { question: 'Man of the match against Forest?', options: [{ label: 'Julio Enciso', votes: 612 }, { label: 'Christian Walton', votes: 188 }, { label: 'Leif Davis', votes: 154 }, { label: 'Someone else', votes: 41 }] },
    likes: 388, replies: 97, tags: ['Poll'] },
  { id: 'p3', image: { kind: 'shotmap', alt: 'Shot map: 17 shots, five on target, one goal' }, communityId: 'trent-end', author: 'Garibaldi Red', role: 'member', minutes: 52, lang: 'en', title: '17 shots and one goal',
    text: 'We created enough to win two games. Finishing has to be the focus on the training ground this week. Not panicking, but it is a pattern.',
    poll: null, likes: 176, replies: 58, tags: ['Analysis'] },
  { id: 'p4', communityId: 'trent-end', author: 'City Ground Steve', role: 'moderator', minutes: 240, lang: 'en', title: 'Ticket exchange is open',
    text: 'Season-ticket holders who can not make the next home game: list your seat on the club exchange by Thursday so it goes to a fellow Red.',
    poll: null, likes: 92, replies: 14, tags: ['Tickets'] },
  { id: 'p5', image: { kind: 'tactics', alt: 'Tactics board with a 3-4-2-1 and the wing-backs pushing up' }, communityId: 'pl-tactics', author: 'Half-space Hannah', role: 'member', minutes: 70, lang: 'en', title: 'Why back threes are back',
    text: 'Five of the top ten now start with a back three at least some of the time. Wing-backs give width without losing a midfielder, which suits the pressing teams.',
    poll: { question: 'Best formation for a promoted side?', options: [{ label: '4-2-3-1', votes: 940 }, { label: '3-4-2-1', votes: 1210 }, { label: '4-4-2', votes: 520 }, { label: '5-3-2', votes: 310 }] },
    likes: 1290, replies: 233, tags: ['Tactics', 'Poll'] },
  { id: 'p6', communityId: 'pl-tactics', author: 'xG Merchant', role: 'member', minutes: 180, lang: 'en', title: null,
    text: 'Reminder that one game of xG tells you about chances, not about who deserved what. Look at ten games before calling anything a trend.',
    poll: null, likes: 640, replies: 121, tags: ['Data'] },
  { id: 'p7', image: { kind: 'rink', alt: 'Piirros jääkiekkokaukalosta aloitustilanteessa' }, communityId: 'liiga-fanit', author: 'Kiekkomutsi', role: 'moderator', minutes: 25, lang: 'fi', title: 'Viikonlopun otteluketju',
    text: 'Tähän ketjuun kaikki viikonlopun Liiga-ottelut. Muistakaa hyvä käytös, vastustajan faneja kunnioitetaan.',
    poll: null, likes: 158, replies: 64, tags: ['Ottelut'] },
  { id: 'p8', communityId: 'liiga-fanit', author: 'Pohjoisen poika', role: 'member', minutes: 130, lang: 'fi', title: null,
    text: 'Kuka voittaa runkosarjan tänä vuonna? Kärjessä on tiukkaa.',
    poll: { question: 'Runkosarjan voittaja?', options: [{ label: 'Kärpät', votes: 830 }, { label: 'Tappara', votes: 790 }, { label: 'Ilves', votes: 610 }, { label: 'Joku muu', votes: 280 }] },
    likes: 302, replies: 145, tags: ['Kysely'] },
  { id: 'p9', image: { kind: 'powerplay', alt: 'Power-play setup with the one-timer from the left circle' }, communityId: 'kiekko-stats', author: 'PowerPlayPekka', role: 'member', minutes: 300, lang: 'en', title: 'Power-play units ranked',
    text: 'Pulled the last month of power plays: the top three units all use a one-timer from the left circle. Entries with control beat dump-ins by a mile.',
    poll: null, likes: 211, replies: 39, tags: ['Stats'] },
  { id: 'p10', image: { kind: 'stadium', alt: 'Drawing of a stadium under the floodlights' }, communityId: 'tractor-boys', author: 'Blue Army Ben', role: 'member', minutes: 600, lang: 'en', title: null,
    text: 'First time taking my daughter to Portman Road this weekend. Any tips for a seven-year-old fan?',
    poll: null, likes: 410, replies: 88, tags: ['Family'] },
]

export function communitiesFeed(now = Date.now()): CommunitiesFeed {
  return {
    communities: COMMUNITIES,
    posts: POSTS.map(({ minutes, image, ...p }) => ({ ...p, image: image ?? null, at: new Date(now - minutes * 60_000).toISOString() }))
      .sort((a, b) => b.at.localeCompare(a.at)),
    mock: true,
  }
}
