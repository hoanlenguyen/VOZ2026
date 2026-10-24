import { createNewsCrawler } from '../lib/news/crawler'
import { articleUrl, readPublisherArticle } from '../lib/news/lookup'
import { sourceForUrl } from '../lib/news/sources'
import { createSummaryService, generateNewsSummary, SummaryError, type SummaryArticle, type SummaryConfig } from '../lib/news/summary'
import { collectedArticleHash, recentlyVerifiedNews } from './news-monitor'
import { modelId } from '../../shared/utils/model-name'

export async function readNewsSummaryEvidence(article: SummaryArticle) {
    const source = sourceForUrl(article.link)
    if (!source || !articleUrl(article.link, article.link, source)) throw new SummaryError('This publisher is not supported.', 400)
    if (article.contentHash) {
      try {
        const document = await recentlyVerifiedNews(article.id, article.contentHash)
        if (document && document.link === article.link && document.text.length >= 150) return {
          title: document.title, source: document.source, publishedAt: document.publishedAt, description: document.description, text: document.text,
        }
      }
      catch { /* A fresh publisher fetch remains the fallback. */ }
    }
    let page
    try { page = await createNewsCrawler()(article.link) }
    catch { throw new SummaryError('The source article cannot be read right now. You can still open the original.', 503) }
    const document = readPublisherArticle(page.text, page.url, { url: article.link, title: article.title, description: '', publishedAt: article.publishedAt }, source)
    if (!document || document.link !== article.link || document.text.length < 150) {
      throw new SummaryError('There is not enough accessible source text to summarize this article.', 503)
    }
    return { title: document.title, source: document.source, publishedAt: document.publishedAt, description: document.description, text: document.text }
}

const summarize = createSummaryService({
  store: {
    getItem: <T>(key: string) => useStorage('newscache').getItem<T>(key),
    setItem: (key, value, options) => useStorage('newscache').setItem(key, value, options),
  },
  readArticle: readNewsSummaryEvidence,
  generate: generateNewsSummary,
})

export function newsSummaryConfig(): SummaryConfig {
  const config = useRuntimeConfig()
  const provider = config.newsAiProvider === 'huggingface' ? 'huggingface' : 'openai'
  const settings: SummaryConfig = {
    provider,
    model: provider === 'huggingface' ? config.hfModel : modelId(config.openaiModel),
    apiKey: provider === 'huggingface' ? config.hfToken : config.openaiApiKey,
  }
  if (!settings.apiKey) throw new SummaryError('AI summaries are not configured yet.', 503)
  return settings
}

export async function summarizeRegisteredNews(id: string) {
  const article = await registeredNewsArticle(id)
  const contentHash = await collectedArticleHash(id)
  if (article.contentHash && !contentHash) throw new SummaryError('This source is no longer available for summarization. Refresh the news list.', 503)
  return summarize({ ...article, contentHash: contentHash ?? article.contentHash }, newsSummaryConfig())
}
