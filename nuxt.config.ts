export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxtjs/i18n'],

  // English and Finnish on the same URLs; the reader's choice is kept in a cookie (first visit: browser language).
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    locales: [
      { code: 'en', language: 'en-GB', file: 'en.json', name: 'English' },
      { code: 'fi', language: 'fi-FI', file: 'fi.json', name: 'Suomi' },
    ],
    detectBrowserLanguage: { useCookie: true, cookieKey: 'voz_lang', fallbackLocale: 'en' },
  },

  app: {
    head: {
      title: 'VOZ – My Sports World',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0E0F11' },
      ],
      link: [
        // VOZ mark (public/): SVG for modern browsers, ICO fallback, home-screen and install icons.
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
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
    /** AI podcasts: text-to-speech model and voice (OpenAI /v1/audio/speech). */
    openaiTtsModel: 'gpt-4o-mini-tts',
    podcastVoice: 'marin',
    gnewsBaseUrl: 'https://gnews.io/api/v4',
    /** News summaries (news monitor): 'openai' uses openaiApiKey/openaiModel above, 'huggingface' uses hf*. */
    newsAiProvider: 'openai',
    hfToken: '',
    hfModel: 'openai/gpt-oss-120b',
    newsMonitorEnabled: true,
    newsAssessmentDailyLimit: 100,
    /** Background news jobs per UTC day (fixtures, feed scans, article checks), run by the every-minute cron. */
    newsJobsDailyLimit: 3000,
    dataMode: 'auto',
    /** Signs the session cookie (NUXT_SESSION_SECRET); a demo secret is used when empty. */
    sessionSecret: '',
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
      // Demo accounts (data/accounts/accounts.json, PBKDF2 password hashes), read via useStorage('assets:accounts').
      { baseName: 'accounts', dir: '../data/accounts' },
      // Pre-written AI stories (npm run warm:stories), read via useStorage('assets:stories').
      { baseName: 'stories', dir: '../data/stories' },
      // Pre-written AI headlines (npm run warm:stories), read via useStorage('assets:headlines').
      { baseName: 'headlines', dir: '../data/headlines' },
      // Pre-generated demo podcast episodes (npm run warm:podcasts); their MP3s are in public/podcasts/.
      { baseName: 'podcasts', dir: '../data/podcasts' },
      // Demo discussion threads (data/comments/<competition>-<id>.json), read via useStorage('assets:comments').
      { baseName: 'comments', dir: '../data/comments' },
    ],
    // Daily AI podcasts (server/tasks/podcasts/daily.ts). On Workers the cron trigger in wrangler.jsonc
    // fires the scheduled handler, which runs the tasks mapped to that cron here; keep both in step
    // (and PODCAST_CRON in server/utils/podcast-agent.ts).
    experimental: { tasks: true },
    // The newsroom agent ticks every 5 minutes and runs when its Newsroom interval has passed
    // (AGENT_CRON in shared/utils/newsroom-agent.ts).
    scheduledTasks: { '0 5 * * *': ['podcasts:daily'], '*/5 * * * *': ['newsroom:agent'] },
    // Shared upstream cache for quota-limited APIs: Workers KV in production, memory in dev.
    storage: {
      kvcache: { driver: 'cloudflare-kv-binding', binding: 'VOZ_CACHE' },
      newscache: { driver: 'cloudflare-kv-binding', binding: 'VOZ_CACHE' },
    },
    devStorage: {
      kvcache: { driver: 'memory' },
      // Keep generated summaries through local server restarts; expiry is also checked explicitly.
      newscache: { driver: 'fs', base: '.data/news' },
    },
  },
})
