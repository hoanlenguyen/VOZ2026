// AI match preview ("paper") of an upcoming match (server/utils/paper-agent.ts): an agent reads the
// News section's trusted-outlet articles (VOZ summaries) and VOZ facts, then writes a sourced
// analysis. Subscribers get it in full and may start the agent (the first run takes about a minute);
// free and signed-out readers get the headline and standfirst from the cache only (no model call).
import type { PaperResponse } from '#shared/types/match-paper'

export default defineEventHandler(async (event): Promise<PaperResponse> => {
  const { def, provider } = competitionParam(event)
  setResponseHeader(event, 'cache-control', 'private, no-store')
  const lang = requestLang(event)
  const [match, season] = await Promise.all([resolveNewsMatch(event), provider.matches(def, {}).then(r => r.data, () => [])])
  if (match.status === 'finished') throw createError({ statusCode: 409, statusMessage: 'Previews are written before the match' })

  const coverage = await newsCoverageForMatch(match).catch(() => null)
  if (!coverage) return { status: 'unavailable', paper: null, locked: false }
  const prepared = preparePaper({ competition: def, match, season, articles: coverage.groups.flatMap(g => g.articles) }, lang)
  if (!prepared) return { status: 'none', paper: null, locked: false }

  const { entitlements } = await sessionInfo(event)
  if (entitlements.premium) {
    const paper = await matchPaper(prepared, lang)
    return { status: paper ? 'ok' : 'unavailable', paper, locked: false }
  }
  const cached = await cachedPaper(prepared)
  if (!cached) return { status: 'none', paper: null, locked: true }
  return { status: 'ok', locked: true, paper: { ...cached, sections: [], trace: [] } }
})
