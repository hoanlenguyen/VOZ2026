// Demo commentary, hand-written for single matches so the match page can show a "live" feed.
// No player names: the free football plan has no scorers, and we do not invent facts about real people.
// Before it is served, a feed is checked against the real result (half-time and final score);
// a feed that disagrees with the data is dropped.

import type { CommentaryEntry, CommentaryKind, MatchCommentary } from '#shared/types/commentary'

type Draft = [minute: number | `${number}+${number}`, kind: CommentaryKind, side: 'home' | 'away' | null, text: string]

const FEEDS: Record<string, Draft[]> = {
  // Torino 3–2 Monza, Serie A matchday 8 (half-time 1–0).
  'serie-a:558567': [
    [0, 'kick-off', null, 'We are under way in Turin. Torino get the game started.'],
    [6, 'chance', 'home', 'First sight of goal for Torino: a cross from the right is headed over the bar.'],
    [11, 'card', 'away', 'Yellow card for Monza after a late challenge in midfield.'],
    [17, 'corner', 'home', 'Torino win the first corner of the game. It is cleared at the near post.'],
    [23, 'save', 'away', 'Monza go close! A low drive from the edge of the box is pushed round the post.'],
    [31, 'goal', 'home', 'GOAL! Torino lead. A quick move down the left ends with a finish into the far corner.'],
    [38, 'card', 'home', 'Yellow card for Torino for pulling back a Monza runner on the break.'],
    [44, 'offside', 'away', 'Monza have the ball in the net, but the flag is up for offside. Still 1–0.'],
    ['45+2', 'half-time', null, 'Half-time. Torino take a one-goal lead into the break.'],
    [46, 'kick-off', null, 'The second half is under way.'],
    [52, 'goal', 'away', 'GOAL! Monza are level. A corner is flicked on and turned in at the back post.'],
    [57, 'card', 'away', 'Another yellow card for Monza, this time for dissent.'],
    [61, 'goal', 'home', 'GOAL! Torino are back in front! A sweeping counter-attack, finished first time.'],
    [66, 'card', 'home', 'Yellow card for Torino after a mistimed tackle.'],
    [69, 'card', 'away', 'Monza pick up their third booking of the afternoon.'],
    [74, 'goal', 'away', 'GOAL! Monza hit back again. A shot from distance takes a deflection and loops in.'],
    [78, 'card', 'home', 'Yellow card for Torino for time-wasting at a throw-in.'],
    [81, 'save', 'home', 'Big chance for Monza to lead for the first time, but the Torino goalkeeper stands tall.'],
    [84, 'card', 'away', 'A fourth yellow card for Monza as the game gets stretched.'],
    [88, 'goal', 'home', 'GOAL! Torino lead again late on! A header from a free-kick finds the corner.'],
    ['90+3', 'card', 'home', 'Yellow card for Torino, their fourth, for kicking the ball away.'],
    ['90+5', 'full-time', null, 'Full-time. Five goals, three lead changes, and Torino take the points.'],
  ],
}

function toEntries(key: string, drafts: Draft[]): CommentaryEntry[] {
  const score = { home: 0, away: 0 }
  return drafts.map(([at, kind, side, text], i) => {
    const [minute, added] = String(at).split('+').map(Number) as [number, number | undefined]
    if (kind === 'goal' && side) score[side]++
    return {
      id: `${key}-${i}`,
      minute,
      added: added ?? null,
      kind,
      side,
      text,
      score: kind === 'goal' ? { ...score } : null,
    }
  })
}

/** The feed must end on the real final score and pass the real half-time score at the break. */
function agreesWithResult(m: Match, entries: CommentaryEntry[]): boolean {
  const goals = entries.filter(e => e.kind === 'goal')
  const last = goals.at(-1)?.score ?? { home: 0, away: 0 }
  if (last.home !== m.home.score || last.away !== m.away.score) return false
  const half = m.periods[0]
  if (m.sport === 'football' && half) {
    const breakAt = entries.findIndex(e => e.kind === 'half-time')
    const atBreak = goals.filter(g => entries.indexOf(g) < breakAt).at(-1)?.score ?? { home: 0, away: 0 }
    if (breakAt < 0 || atBreak.home !== half.home || atBreak.away !== half.away) return false
  }
  return true
}

export function matchCommentary(m: Match): MatchCommentary | null {
  const drafts = FEEDS[m.key]
  if (!drafts || m.status !== 'finished') return null
  const entries = toEntries(m.key, drafts)
  return agreesWithResult(m, entries) ? { sample: true, entries } : null
}
