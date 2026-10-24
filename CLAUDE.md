# VOZ – My Sports World

Hackathon app (Kaleva Media "Beyond the Scoreboard"): AI-driven, personalised **multi-sport** news.
Today: ice hockey (Liiga) and football (football-data.org). New sports and leagues plug in as providers.
Nuxt 4 full stack; API keys live in `.env` (gitignored) and are only used server-side.

## Commands
- `npm run dev` — dev server (stop it before restarting; Nuxt refuses a second instance). After adding a new component, restart if SSR logs "Failed to resolve component".
  Changing `.env` or `nuxt.config.ts` makes the server restart itself; a second dev server of this folder (e.g. an old `--port 3002`) blocks that restart and every request then returns 500 "Another Nuxt dev server is already running".
- `npm run typecheck` — must pass before committing
- `npm test` — story checker tests (Node's test runner, plain TS); also run by the deploy workflow
- `npm run snapshot -- [--only liiga|football-data] [--details] [--competitions PL,BL1]` — save upstream
  responses to `data/snapshots/<provider>/` for offline demos (football: ~6.5 s per request, free-plan limit)

## Deployment
- Cloudflare Workers, auto-deployed by `.github/workflows/deploy.yml` on push to `main` (typecheck → build → `wrangler deploy`).
- Nitro preset `cloudflare_module` (nuxt.config); Worker config in `wrangler.jsonc` (`deployConfig: false`, so this file is the only config).
- Workers has no filesystem: snapshots are Nitro server assets (`useStorage('assets:snapshots')`); per-game Liiga files are excluded from the bundle.
- API keys are Worker secrets uploaded by the workflow from GitHub secrets; new secrets must be added to the workflow's `secrets:` list and `env:` block.
- Read env only inside request handlers (Workers provides it per request). Local Workers test: `npm run preview` with `.dev.vars`.
- Keep `compatibility_date` within what the pinned wrangler's runtime supports (wrangler 4.152.0 ⇒ 2026-10-01 works).

## Environment (`.env`, see `.env.example`)
- `NUXT_LIIGA_API_KEY` — Liiga stats API, sent as `x-api-key`
- `NUXT_FOOTBALL_DATA_TOKEN` — football-data.org, sent as `X-Auth-Token`; free plan = TIER_ONE competitions, 10 requests/minute
- `NUXT_GNEWS_API_KEY` — GNews headline search (sent as `apikey` query param, redacted from errors); free plan 100 requests/day, ~1 request/s
- `NUXT_HF_TOKEN`, `NUXT_HF_MODEL` (default `openai/gpt-oss-120b`) — Hugging Face Inference Providers (`https://router.huggingface.co/v1`, OpenAI-compatible) for the translation agent. Without a token, headlines stay untranslated.
  For Cloudflare, add `NUXT_HF_TOKEN` as a GitHub secret and to the deploy workflow's `secrets:` list and `env:` block (not there yet).
- `NUXT_OPENAI_API_KEY` — OpenAI Responses API for AI match stories (model `gpt-6-luna`, reasoning effort `low`; `NUXT_OPENAI_MODEL`, `NUXT_STORY_REASONING_EFFORT` override)
- `NUXT_DATA_MODE=live|auto|snapshot` — upstream only / upstream with snapshot fallback / offline only

## Architecture
- `shared/types/sports.ts` — sport-agnostic types (Competition, TeamListItem, Match, ScoringEvent, StandingRow). The app and AI work only with these.
- `shared/utils/competitions.ts` — every competition we cover; adding a league of an existing provider is one entry
- `server/providers/<provider>.ts` — one per data source; implements `SportProvider` (`server/providers/types.ts`) and maps raw JSON → shared types
- `server/utils/upstream.ts` — the only place that calls external APIs (`UpstreamId` = sports providers + `gnews`): keys, cache, rate limit, snapshot fallback. Query-string keys go in `authQuery` so they never reach cache keys, snapshot names or logs.
- `server/utils/sports.ts` — provider registry and the `[competition]` route helper
- API: `/api/landing`, `/api/competitions`, `/api/competitions/:competition/{teams,standings,matches,matches/:id,matches/:id/press}`, `/api/health`, dev-only `/api/raw/:provider/*`. Every route that returns text takes `?lang=en|fi`.
- `server/utils/compare.ts` — match-page comparison: goals by period, `MatchTeam.stats` (Liiga: shots, puck control, faceoffs, passes, PIM, … from `games/{season}/{id}/stats`), and both teams' season record before kick-off counted from results (points/goals reconcile with the official tables); returned as `compare` by `/api/competitions/:competition/matches/:id`. Labels and notes per language in `server/utils/compare-text.ts` (row label key = row id / stats key)
- `server/utils/press.ts` — "What the press says": GNews search by both team names (ASCII-folded; GNews rejects non-ASCII) in a window around kick-off, kept only if headline/description names both teams; returns headline, source, link only (never description/content/images). Endpoint `/api/competitions/:competition/matches/:id/press`, loaded client-side by `NewsPressCard`.
- `server/utils/mock-matches.ts` — mock "deep data" matches from `data/mock/<competition>/<id>.json` (server assets `mocks`, bundled on Workers): full match-centre facts (key events, line-ups, stats, structured event list). Mapped to `Match` + `MatchDetailExtras` (`shared/types/match-detail.ts`: timeline, line-ups, referee, source). Teams resolve to the provider's team keys/crests by name; the provider's record of the same game (same teams + UTC day) is replaced on the front page, and both ids serve the mock detail. Mocks always appear on the front page and lead their league. Store facts only, never another outlet's written commentary; labels are written in code.
- `server/utils/translate.ts` — AI translation agent `translateTexts(texts, lang)` for text VOZ doesn't write; today only the press headlines (`press.ts`). Never use it for VOZ's own stories or labels (those are templates / i18n).
  - Cache: `kvcache` key `tr:v1:<lang>:<model>:<sha256>`, 30 days; concurrent requests share one in-flight call; all uncached texts of a request go in one chat call.
  - `keepsNumbers()` guard: a translation must keep the original's digit groups; otherwise the original is shown and nothing is cached. Any failure returns the originals.
  - UI: `PressArticle.translated` / `originalTitle`; the card shows "Translated automatically" / "Konekäännös" and the original on hover.
  - gpt-oss: send `reasoning_effort: 'low'` (about 3× fewer tokens, under 1 s); the reply has `content` plus a separate `reasoning` field; ask for `{"translations": [...]}` and parse from the first `{`.
- AI match stories (single agent + harness):
  - `server/utils/facts.ts` — fact ledger f1…fN for a match (result, timeline, stats, form, table, h2h, context), computed from Match / extras / season results. Name teams as the match does.
  - `shared/utils/story-check.ts` — checker: every number (rounding allowed) and every person named must appear in the facts a sentence cites; no quotes, speech or injuries; word range per length. Pure TS, tested in `tests/` (`npm test`).
  - `server/utils/story-agent.ts` — agent with tools `get_facts`, `check_story`, `submit_story` (`tool_choice: required`); harness: 8 turns / 90 s, final re-check, trace, template fallback. `server/utils/llm.ts` — fetch-based Responses API client (one retry on 429/5xx, key never in errors).
  - `server/utils/story-cache.ts` — memory → KV (`kvcache`) → bundled `data/stories/` (re-checked against today's facts) → agent; in-flight dedupe; only checked agent stories are cached. Key includes a hash of the facts, model and prompt version.
  - `GET /api/competitions/:competition/matches/:id/story?length=short|standard|long&tone=neutral|home-fan|away-fan|analyst` (`&fresh=1` in dev regenerates). UI: `NewsMatchStory` on match pages with full data.
  - `npm run warm:stories -- --base http://localhost:3000 --match premier-league/2645271` pre-writes all 12 variants into `data/stories/` for the demo; re-run after changing facts or prompts, then commit.
  - Rules when changing it: never let the harness publish text that failed `checkStory`; bump `PROMPT_VERSION` in `story-cache.ts` after changing the agent's instructions or tools (it invalidates cached stories); keep facts in the match's own team names and with original capitalisation (the checker matches names case-insensitively, but readers see the fact text); add a test in `tests/` for every new checker rule.
  - Stories show only on match pages with full data (`data.extras`), i.e. mock matches today. Cost per version ≈ $0.001 (3 turns, ~5k tokens in / 700 out).
  - Before reading the OpenAI API shape from memory, check the docs: Responses API `/v1/responses`, `tool_choice: required`, function outputs as `function_call_output` items, reasoning/call items passed back verbatim, `store: false`.
- `server/utils/stories.ts` — deterministic story templates (headline + summary) from Match/StandingRow facts; used by `/api/landing`
- Pages: `/` news front page (layout `news`, light theme), `/match/:competition/:id`, `/onboarding`, `/status` (data-layer check); app screens use layout `default` (dark)
- Keys: team `"<competition>:<team>"` (`liiga:karpat`, `premier-league:57`), match `"<competition>:<id>"`
- `shared/utils/` must stay free of Nuxt imports: `scripts/` runs it with plain Node (type stripping)

### Adding a sport or provider
1. Add the `SportId` / `ProviderId` in `shared/types/sports.ts`
2. Add an upstream entry (base URL, auth header, cache, rate limit) in `server/utils/upstream.ts` and `scripts/snapshot.ts`
3. Write `server/providers/<name>.ts` implementing `SportProvider`; register it in `server/utils/sports.ts`
4. Add its competitions to `shared/utils/competitions.ts`
5. Check that goals reconcile with final scores across a full season before trusting the data

## Languages (English + Finnish)
- `@nuxtjs/i18n`, strategy `no_prefix`: same URLs, language from the browser on first visit, then the `voz_lang` cookie; EN | FI switcher in the header (`SiteHeader.vue`). `<html lang>` follows via `useLocaleHead()` in the layouts.
- Interface text: `i18n/locales/en.json` + `fi.json`, which must keep the same keys. Use `t()` and never hardcode English in components.
- Dates, scores and numbers: `useFormat()` (`app/composables/useFormat.ts`) → `fixture()` (time + day, `relative` today/tomorrow), `stamp()`, `score()`, `number()`. Never compare display words like "Today".
- `Lang` / `INTL_LOCALE` live in `shared/utils/format.ts`; `formatScore(m, lang)` suffixes: en `OT`, `SO`, `AET`, `pens`; fi `ja`, `vl`, `ja`, `rp.`
- Server text (stories, compare labels, timeline, press notes) is written per language. APIs read `requestLang(event)` (`server/utils/lang.ts`), and pages fetch with `query: { lang: locale }` (reactive, so switching refetches).
- Competition names and countries per language: `competitionName(c, lang)`, `competitionCountry(c, lang)` (`fi` field in `shared/utils/competitions.ts`, e.g. Mestarien liiga); `describeCompetition(def, lang)`.
- Stories: `server/utils/stories.ts` picks the facts, `server/utils/story-text/{en,fi}.ts` words them (`StoryPhrases`). Both languages must state the same numbers.
  Finnish keeps team names in the basic form (no case endings): "HIFK voittoon: K-Espoo–HIFK 0–3", "Maalit (HIFK): …".
- Code never reads display labels: use structured fields (`TimelineEvent.goalType`, `assist`, `playerOff`).
- External text (other outlets' headlines) is translated by the AI agent (`server/utils/translate.ts`), not by i18n. The press search runs in the reader's language first, then any language.

## Score semantics (important for the fact ledger)
- `MatchTeam.score` = goals scored in play (regulation + overtime/extra time). Never shootout goals.
- `Match.shootout` records who won a hockey shootout / football penalty shootout (tallies when known).
- Display with `formatScore(m, lang)` (`shared/utils/format.ts`): hockey "4–3 SO" (fi "4–3 vl"), football "1–1, 5–4 pens" (fi "1–1, rp. 5–4"). `displayScore()` gives the shown numbers without text.

## Data gotchas
- Liiga season id = the year the season ends (`2027` = 2026–27); regular season serie `runkosarja`.
- Liiga strings can be mis-decoded UTF-8 ("KÃ¤rpÃ¤t"); `fixEncodingDeep` repairs every Liiga response.
- Liiga team ids contain non-ASCII ("495643563:kärpät"); use ASCII slugs from `shared/utils/liiga-teams.ts`.
- Liiga goal events include ones that did not count (`VT0`, `RL0`) and the shootout decider (`VL`); the
  provider moves them to `notCounted` / `shootout`. Verified: goals match final scores in all 131 finished games.
- football-data v4 `score.fullTime` includes penalty-shootout goals; the provider subtracts them.
- football-data free plan has no goal events, lineups or match stats (`Competition.hasScoringEvents = false`);
  Veikkausliiga needs TIER_THREE (paid).

## UI work
- Use the **ui-ux-pro-max** skill for any UI change.
- Follow `design-system/voz/MASTER.md` (page overrides in `design-system/voz/pages/`, e.g. `landing.md` for the light front page); tokens in `app/assets/css/main.css`, no raw hex in components.
- `main.css` defines global classes `.app-shell .card .chip .badge .select .eyebrow .muted .display .num .sr-only`.
  Use them only for their global meaning; never reuse these names for component-specific styles (scoped
  styles still merge with the global rule; `.card`, `.chip` and `.badge` collisions have each caused layout bugs).
- Never copy articles or photos from other news sites into the app or mock data; story text comes from our data, images are crests + data visuals.
