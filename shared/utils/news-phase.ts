import type { NewsMatchState } from '../types/news-coverage.ts'

/** The live scoreboard has its own lifecycle; news has only preview and aftermath. */
export function newsCoveragePhase(status: NewsMatchState['status']): 'pre-match' | 'post-match' {
  return status === 'finished' ? 'post-match' : 'pre-match'
}
