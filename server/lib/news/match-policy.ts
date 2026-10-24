import type { NewsCachePolicy, NewsMatchState } from '../../../shared/types/news-coverage.ts'
import { preMatchScanSeconds } from './pre-match.ts'

/** Status comes from the data provider. Elapsed time alone never declares a match live or final. */
export function matchNewsPolicy(match: NewsMatchState, now = Date.now()): NewsCachePolicy {
  const kickoff = Date.parse(match.start)
  if (match.status === 'cancelled' || match.status === 'postponed') {
    return { phase: match.status, discoverySeconds: 1800, summarySeconds: 1800, pollSeconds: 300 }
  }
  if (match.status === 'live') return { phase: 'streaming', discoverySeconds: 60, summarySeconds: 60, pollSeconds: 60 }
  if (match.status === 'finished') {
    const age = now - kickoff
    const ttl = age < 6 * 3600_000 ? 300 : age < 24 * 3600_000 ? 3600 : 86400
    return { phase: 'post-match', discoverySeconds: ttl, summarySeconds: ttl, pollSeconds: ttl < 3600 ? 60 : 300 }
  }
  const untilKickoff = (kickoff - now) / 1000
  // Never let a preview's validity extend past scheduled kickoff. If the provider is late,
  // keep checking its status rather than guessing that play has started.
  const ttl = untilKickoff <= 0 ? 60 : Math.max(1, Math.min(untilKickoff, preMatchScanSeconds(kickoff, now)))
  return { phase: 'upcoming', discoverySeconds: ttl, summarySeconds: ttl, pollSeconds: untilKickoff <= 3600 ? Math.min(60, ttl) : 300 }
}

export function matchStateKey(match: NewsMatchState): string {
  return JSON.stringify([match.key, match.status, match.start, match.home.name, match.home.score, match.away.name, match.away.score])
}
