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
    dataMode: 'auto',
    public: {
      season: 2027,
      serie: 'runkosarja',
    },
  },

  nitro: {
    storage: {
      snapshots: { driver: 'fs', base: './data/snapshots' },
    },
  },
})
