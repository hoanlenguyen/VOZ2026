import type { Match } from '#shared/types/sports'
import type { MatchNewsArticle } from '#shared/types/match-news'
import type { NewsCoverage, NewsItem, NewsMatchState, TeamNewsTopic } from '#shared/types/news-coverage'
import { parseNewsInput } from '../lib/news/input'
import { lookupTeamNews } from '../lib/news/team-news'
import { digest, type SummaryArticle } from '../lib/news/summary'
import { matchNewsPolicy, matchStateKey } from '../lib/news/match-policy'
import { createTimedNewsCache } from '../lib/news/timed-cache'
import { newsSourcePolicy, SOURCE_POLICY_VERSION } from '../lib/news/source-policy'
import { selectPreMatchNews } from '../lib/news/pre-match'
import { collectedNews, trackNewsMatch } from './news-monitor'
import { newsCoveragePhase } from '../../shared/utils/news-phase'
import { retainedPreMatchGroups } from '../lib/news/coverage-phase'

export async function registerNewsArticle(article: MatchNewsArticle, topic?: TeamNewsTopic): Promise<NewsItem> {
  const id = await digest(article.link)
  const item: NewsItem = { id, title: article.title, link: article.link, source: article.source, publishedAt: article.publishedAt,
    sourceId: article.sourceId, sourcePriority: article.sourcePriority, sourceKind: article.sourceKind, contentHash: article.contentHash, assessment: article.assessment, ...(topic ? { topic } : {}) }
  // Only server-discovered articles can be submitted to the summarizer. No caller URLs/text.
  await useStorage('newscache').setItem(`news:article:${id}`, { ...item, registeredAt: Date.now() }, { ttl: 2 * 86400 })
  return item
}

const store = {
  getItem: <T>(key: string) => useStorage('newscache').getItem<T>(key),
  setItem: (key: string, value: object, options?: { ttl?: number }) => useStorage('newscache').setItem(key, value, options),
}
const coverageCache = createTimedNewsCache<NewsCoverage['groups']>(store, `news:coverage-v5:${SOURCE_POLICY_VERSION}`)
const teamCache = createTimedNewsCache<Awaited<ReturnType<typeof lookupTeamNews>>>(store, `news:team-discovery-v2:${SOURCE_POLICY_VERSION}`)

export async function newsCoverageForMatch(match: Match): Promise<NewsCoverage> {
  const config = useRuntimeConfig()
  const state: NewsMatchState = {
    key: match.key, status: match.status, start: match.start,
    home: { name: match.home.name, score: match.home.score }, away: { name: match.away.name, score: match.away.score },
  }
  const policy = matchNewsPolicy(state)
  const identity = JSON.stringify([match.competitionId, matchStateKey(state)])
  if (config.newsMonitorEnabled && match.status !== 'scheduled' && Math.abs(Date.parse(match.start) - Date.now()) < 24 * 3600_000) {
    try { await trackNewsMatch(match) } catch { /* Discovery still works without the monitor. */ }
  }
  let groups: NewsCoverage['groups'] | undefined
  const snapshotKey = `news:preview-groups:${SOURCE_POLICY_VERSION}:${match.key}`
  // Read the shared corpus on every preview poll. A long outer cache must not hide breaking news.
  if ((match.status === 'scheduled' || match.status === 'live') && config.newsMonitorEnabled) {
    try {
      await trackNewsMatch(match)
      const selected = selectPreMatchNews(match, await collectedNews())
      groups = [{ key: 'match', title: 'This match', articles: await Promise.all(selected.articles.map(article => registerNewsArticle(article))),
        note: selected.articles.length === 3 ? null : `Collected ${selected.articles.length} of 3 verified preview sources. Background monitoring is checking for more coverage.` }]
      for (const [index, team] of selected.teams.entries()) groups.push({ key: index === 0 ? 'home' : 'away', title: team.name,
        articles: await Promise.all(team.articles.map(article => registerNewsArticle(article, article.topic))),
        note: team.articles.length === 3 ? null : `Collected ${team.articles.length} of 3 recent team updates. Background monitoring is checking for more coverage.` })
    }
    catch { /* Existing on-demand discovery remains usable if monitoring storage is unavailable. */ }
  }
  if (match.status === 'live') {
    // Never fall through to search/crawling during play, even if the monitor is disabled
    // or its storage fails. Retain a preview snapshot when the shared corpus has no coverage.
    const snapshot = await store.getItem<{ start: string, groups: NewsCoverage['groups'] }>(snapshotKey)
    const retained = groups?.some(group => group.articles.length) ? groups : snapshot?.start === match.start ? snapshot.groups : []
    groups = retainedPreMatchGroups(state, retained)
  }
  groups ??= await coverageCache(identity, policy.discoverySeconds, async () => {
    const info = parseNewsInput({ competitionId: match.competitionId, matchId: match.id, status: match.status, kickoff: match.start, homeTeam: match.home, awayTeam: match.away, limit: 3 })
    const teams = [{ name: match.home.name, variants: info.home }, { name: match.away.name, variants: info.away }]
    const [coverage, teamResults] = await Promise.all([
      cachedMatchNews(JSON.stringify(info), policy.discoverySeconds),
      teamCache(JSON.stringify([match.competitionId, teams]), 900, () => lookupTeamNews(teams, { competitionId: match.competitionId })),
    ])
    const groups: NewsCoverage['groups'] = [{
      key: 'match', title: 'This match',
      articles: await Promise.all(coverage.articles.slice(0, 3).map(article => registerNewsArticle(article))),
      note: coverage.articles.length >= 3 ? null : `Found ${coverage.articles.length} of 3 verified sources about this match.`,
      sourceChecks: coverage.sourceChecks,
    }]
    for (const [index, team] of teamResults.entries()) groups.push({
      key: index === 0 ? 'home' : 'away', title: team.name,
      articles: await Promise.all(team.articles.map(article => registerNewsArticle(article, article.topic))), note: team.note, sourceChecks: team.sourceChecks,
    })
    return groups
  })
  if (match.status === 'scheduled') await store.setItem(snapshotKey, { start: match.start, groups }, { ttl: 3 * 86400 })
  const revision = await digest(JSON.stringify([SOURCE_POLICY_VERSION, identity, groups[0]?.articles.map(a => [a.id, a.publishedAt, a.sourcePriority, a.contentHash])]))
  return {
    groups, checkedAt: new Date().toISOString(), match: state, policy, revision, newsPhase: newsCoveragePhase(match.status),
    sourcePolicy: newsSourcePolicy(match.competitionId),
    summaryAvailable: match.status !== 'live' && (config.newsAiProvider === 'huggingface' ? !!config.hfToken : !!config.openaiApiKey),
  }
}

export async function registeredNewsArticle(id: string): Promise<SummaryArticle> {
  const article = await useStorage('newscache').getItem<SummaryArticle & { registeredAt: number }>(`news:article:${id}`)
  if (!article || Date.now() - article.registeredAt >= 2 * 86400_000) {
    throw createError({ statusCode: 404, statusMessage: 'This news item has expired. Refresh the news list and try again.' })
  }
  return article
}
