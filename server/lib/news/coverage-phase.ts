import type { NewsGroup, NewsMatchState } from '../../../shared/types/news-coverage.ts'

/** During play, expose only previously discovered previews. This never fetches a publisher. */
export function retainedPreMatchGroups(match: NewsMatchState, groups: NewsGroup[] = []): NewsGroup[] {
  return (['match', 'home', 'away'] as const).map((key, i) => {
    const group = groups.find(group => group.key === key)
    const articles = (group?.articles ?? []).filter(article => Date.parse(article.publishedAt) <= Date.parse(match.start)).slice(0, 3)
    return { key, title: i === 0 ? 'This match' : i === 1 ? match.home.name : match.away.name, articles,
      note: articles.length === 3 ? null : `${articles.length} of 3 pre-match ${i === 0 ? 'sources' : 'team updates'} available. Post-match coverage will be checked after full time.` }
  })
}
