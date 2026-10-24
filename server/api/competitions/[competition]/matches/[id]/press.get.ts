// Discovery only: match coverage and three recent updates for each team. No AI calls here.
export default defineEventHandler(async (event) => {
  const match = await resolveNewsMatch(event)
  // Do not allow a browser cache to conceal an official phase or score transition.
  setResponseHeader(event, 'cache-control', 'no-store')
  const coverage = await newsCoverageForMatch(match)
  // Preserve the existing headline translator while discovery and IDs keep publisher originals.
  const articles = coverage.groups.flatMap(group => group.articles)
  const titles = await translateTexts(articles.map(article => article.title), requestLang(event))
  let index = 0
  return { ...coverage, groups: coverage.groups.map(group => ({ ...group, articles: group.articles.map(article => {
    const title = titles[index++]!
    return { ...article, title: title.text, translated: title.translated, originalTitle: title.translated ? article.title : undefined }
  }) })) }
})
