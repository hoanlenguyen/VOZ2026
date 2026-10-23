# VOZ – My Sports World

Hackathon app (Kaleva Media "Beyond the Scoreboard"): AI-driven, personalised Liiga ice hockey coverage.
Nuxt 4 full stack; the Liiga API key and LLM keys live in `.env` (gitignored) and are only used server-side.

## Commands
- `npm run dev` — dev server
- `npm run snapshot -- --details` — save Liiga API responses to `data/snapshots/` for offline demos
- `NUXT_DATA_MODE=live|auto|snapshot` — live API only / live with snapshot fallback / offline only

## Layout
- `server/utils/liiga.ts` — the only place that calls the Liiga API (key, cache, snapshot fallback)
- `server/utils/normalize.ts` — raw Liiga JSON → types in `shared/types/liiga.ts`
- `shared/utils/` — code shared by server and `scripts/` (keep it free of Nuxt imports)
- Current season is `2027` (= 2026–27), regular season serie `runkosarja`

## UI work
- Use the **ui-ux-pro-max** skill for any UI change.
- Follow `design-system/voz/MASTER.md` (page overrides in `design-system/voz/pages/`); tokens in `app/assets/css/main.css`, no raw hex in components.

## Data gotchas
- Liiga strings can be mis-decoded UTF-8 ("KÃ¤rpÃ¤t"); `fixEncodingDeep` is applied to every response.
- Team ids contain non-ASCII ("495643563:kärpät"); use our ASCII slugs from `shared/utils/teams.ts` in URLs.
