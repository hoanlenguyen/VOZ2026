export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'VOZ – My Sports World',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0E0F11' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600&display=swap',
        },
      ],
    },
  },

  // Server-only values; set through NUXT_* env vars (see .env.example).
  runtimeConfig: {
    liigaApiKey: '',
    liigaBaseUrl: 'https://prod.liiga-backend.liiga.fi/stats/api/v1',
    /** Liiga season id = the year the season ends (2027 = 2026–27). */
    liigaSeason: 2027,
    footballDataToken: '',
    footballDataBaseUrl: 'https://api.football-data.org/v4',
    /** GNews headline search for "What the press says" (free plan: 100 requests/day). */
    gnewsApiKey: '',
    /** AI match stories (OpenAI Responses API). */
    openaiApiKey: '',
    /** Display name or API id; set NUXT_OPENAI_MODEL to switch models (e.g. "GPT-6 Sol"). */
    openaiModel: 'gpt-6-luna',
    openaiBaseUrl: 'https://api.openai.com/v1',
    storyReasoningEffort: 'low',
    gnewsBaseUrl: 'https://gnews.io/api/v4',
    dataMode: 'auto',
  },

  nitro: {
    // Cloudflare Workers (module syntax) + static assets; config in wrangler.jsonc.
    preset: 'cloudflare_module',
    cloudflare: { deployConfig: false, nodeCompat: true },
    // Snapshots are bundled into the Worker (no filesystem there) and read via useStorage('assets:snapshots').
    // Per-game Liiga files (~28 MB) stay out of the bundle.
    serverAssets: [
      { baseName: 'snapshots', dir: '../data/snapshots', ignore: ['liiga/games_2027_*'] },
      // Mock "deep data" matches (data/mock/<competition>/<id>.json), read via useStorage('assets:mocks').
      { baseName: 'mocks', dir: '../data/mock' },
      // Pre-written AI stories (npm run warm:stories), read via useStorage('assets:stories').
      { baseName: 'stories', dir: '../data/stories' },
    ],
    // Shared upstream cache for quota-limited APIs: Workers KV in production, memory in dev.
    storage: { kvcache: { driver: 'cloudflare-kv-binding', binding: 'VOZ_CACHE' } },
    devStorage: { kvcache: { driver: 'memory' } },
  },
})
