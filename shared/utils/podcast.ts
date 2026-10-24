// Podcast subject ids, shared by the server (episode ids, storage keys) and the newsroom desk.
import type { PodcastSubject } from '../types/podcast.ts'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** "match-premier-league-2645271", "team-premier-league-349", "league-liiga". */
export function podcastSubjectId(s: PodcastSubject): string {
  if (s.kind === 'match') return `match-${s.competitionId}-${slug(s.matchId)}`
  if (s.kind === 'team') return `team-${s.competitionId}-${slug(s.teamKey.slice(s.teamKey.indexOf(':') + 1))}`
  return `league-${s.competitionId}`
}
