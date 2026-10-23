# VOZ – My Sports World

Hackathon app (Kaleva Media "Beyond the Scoreboard"): AI-driven, personalised **multi-sport** news.
Today: ice hockey (Liiga) and football (football-data.org). New sports and leagues plug in as providers.
Nuxt 4 full stack; API keys live in `.env` (gitignored) and are only used server-side.

## Commands
- `npm run dev` — dev server (stop it before restarting; Nuxt refuses a second instance)
- `npm run typecheck` — must pass before committing
- `npm run snapshot -- [--only liiga|football-data] [--details] [--competitions PL,BL1]` — save upstream
  responses to `data/snapshots/<provider>/` for offline demos (football: ~6.5 s per request, free-plan limit)

## Environment (`.env`, see `.env.example`)
- `NUXT_LIIGA_API_KEY` — Liiga stats API, sent as `x-api-key`
- `NUXT_FOOTBALL_DATA_TOKEN` — football-data.org, sent as `X-Auth-Token`; free plan = TIER_ONE competitions, 10 requests/minute
- `NUXT_DATA_MODE=live|auto|snapshot` — upstream only / upstream with snapshot fallback / offline only

## Architecture
- `shared/types/sports.ts` — sport-agnostic types (Competition, TeamListItem, Match, ScoringEvent, StandingRow). The app and AI work only with these.
- `shared/utils/competitions.ts` — every competition we cover; adding a league of an existing provider is one entry
- `server/providers/<provider>.ts` — one per data source; implements `SportProvider` (`server/providers/types.ts`) and maps raw JSON → shared types
- `server/utils/upstream.ts` — the only place that calls external APIs: keys, cache, rate limit, snapshot fallback
- `server/utils/sports.ts` — provider registry and the `[competition]` route helper
- API: `/api/competitions`, `/api/competitions/:competition/{teams,standings,matches,matches/:id}`, `/api/health`, dev-only `/api/raw/:provider/*`
- Keys: team `"<competition>:<team>"` (`liiga:karpat`, `premier-league:57`), match `"<competition>:<id>"`
- `shared/utils/` must stay free of Nuxt imports: `scripts/` runs it with plain Node (type stripping)

### Adding a sport or provider
1. Add the `SportId` / `ProviderId` in `shared/types/sports.ts`
2. Add an upstream entry (base URL, auth header, cache, rate limit) in `server/utils/upstream.ts` and `scripts/snapshot.ts`
3. Write `server/providers/<name>.ts` implementing `SportProvider`; register it in `server/utils/sports.ts`
4. Add its competitions to `shared/utils/competitions.ts`
5. Check that goals reconcile with final scores across a full season before trusting the data

## Score semantics (important for the fact ledger)
- `MatchTeam.score` = goals scored in play (regulation + overtime/extra time). Never shootout goals.
- `Match.shootout` records who won a hockey shootout / football penalty shootout (tallies when known).
- Display with `formatScore()` (`shared/utils/format.ts`): hockey "4–3 SO", football "1–1, 5–4 pens".

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
- Follow `design-system/voz/MASTER.md` (page overrides in `design-system/voz/pages/`); tokens in `app/assets/css/main.css`, no raw hex in components.
