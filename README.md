# VOZ – My Sports World

AI-powered, personalised multi-sport news, built for the Kaleva Media hackathon
**"Beyond the Scoreboard – Reinventing local sports coverage with AI"**.

VOZ turns structured league data (results, goals, standings, fixtures) into stories people want to
read, hear and watch, for every league, from the top division down to the local level. The rule
behind every feature: **write only from verified facts**. Every sentence comes from data fields,
and nothing is published that the data does not support.

## What works today

- **News front page** (`/`): editorial layout with a fixture strip, category tabs, a lead story,
  story cards, a "Latest" list and league tables. Stories are generated from live data.
- **Ice hockey:** Liiga (Finland), via the official Liiga stats API.
- **Football:** Premier League, Championship, LaLiga, Bundesliga, Serie A, Ligue 1, Eredivisie,
  Primeira Liga and Champions League, via [football-data.org](https://www.football-data.org).
- **Match page** (`/match/:competition/:id`): score, periods/halves, goals (where the data plan
  includes them), xG, attendance.
- **What the press says** (match page): other outlets' headlines about the game, with source and
  link, found via [GNews](https://gnews.io) and matched by date and both team names. Only headlines and
  links are shown, so VOZ points to the coverage instead of republishing it.
- **Full match data demo** (mock): Ipswich Town 1–1 Nottingham Forest (Premier League, 23 Oct 2026)
  with an event timeline, line-ups on a pitch, possession/xG/shots and officials. It shows what VOZ does
  with a richer data feed than the free football plan. Add more in `data/mock/<competition>/<id>.json`.
- **Onboarding** (`/onboarding`): pick a league and see its teams (first version).
- **Offline demo mode:** saved API snapshots keep the app running without network.
- **Data status** (`/status`): live check of each data source.

Planned: AI-written match stories with a fact validator, a playoff-odds engine, alerts that fire
only when something matters, a 60-second audio briefing, and data-driven vertical videos.

## Quick start

Requirements: Node.js 22.18 or newer (the snapshot script uses Node's built-in TypeScript support).

```bash
npm install
```

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | What it is |
|---|---|
| `NUXT_LIIGA_API_KEY` | Liiga stats API key, sent as `x-api-key` |
| `NUXT_FOOTBALL_DATA_TOKEN` | football-data.org token ([free registration](https://www.football-data.org/client/register)) |
| `NUXT_GNEWS_API_KEY` | [GNews](https://gnews.io) key for "What the press says" (optional) |
| `NUXT_DATA_MODE` | `live` (APIs only), `auto` (APIs, fall back to snapshots) or `snapshot` (offline) |

```bash
npm run dev
```

Open http://localhost:3000.

### Offline demo

Save the current data once, then run with `NUXT_DATA_MODE=snapshot` (or `auto`, which falls back
to the snapshot automatically when an API is unreachable):

```bash
npm run snapshot -- --details
```

Options: `--only liiga|football-data`, `--competitions PL,BL1` (football codes), `--details`
(every finished Liiga game; about 28 MB, not committed). Football takes about 3 minutes because the
free plan allows 10 requests per minute.

## Deployment (Cloudflare Workers)

Every push to `main` builds and deploys the app to Cloudflare Workers through GitHub Actions
([.github/workflows/deploy.yml](.github/workflows/deploy.yml)): install → typecheck → `nuxt build`
(Nitro preset `cloudflare_module`) → `wrangler deploy`. It can also be started by hand from the
Actions tab ("Run workflow").

One-time setup, in the GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token from the "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account id (Workers & Pages overview page) |
| `NUXT_LIIGA_API_KEY` | Liiga API key |
| `NUXT_FOOTBALL_DATA_TOKEN` | football-data.org token |
| `NUXT_GNEWS_API_KEY` | GNews API key (press headlines) |

The API keys are uploaded as encrypted Worker secrets on each deploy. Non-secret settings
(`NUXT_DATA_MODE`) live in [wrangler.jsonc](wrangler.jsonc). The site is served at
`https://voz.<your-subdomain>.workers.dev`.

Offline snapshots in `data/snapshots/` that are committed to git are bundled into the Worker, so
`auto` mode still falls back to them in production. Run `npm run snapshot` and commit to refresh them.

Test the production build locally in the Workers runtime (copy `.dev.vars.example` to `.dev.vars` first):

```bash
npm run preview
```

Deploy from your machine (needs `npx wrangler login`):

```bash
npm run deploy
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build for Cloudflare Workers (`.output/`) |
| `npm run preview` | Build and run it locally in the Workers runtime (`wrangler dev`) |
| `npm run deploy` | Build and deploy to Cloudflare from your machine |
| `npm run typecheck` | Type check (must pass before committing) |
| `npm run snapshot` | Save API responses to `data/snapshots/` |

## How it works

```
Liiga API ─┐                                   ┌─ /api/landing (stories, fixtures, tables)
           ├─ upstream.ts ─ providers/* ─ shared types ─┤
football ──┘  (keys, cache,  (raw JSON →     (Match,    └─ /api/competitions/:id/...
-data.org      rate limit,    sport-agnostic   Standing…)
               snapshots)     types)
```

- **`server/utils/upstream.ts`** is the only code that calls external APIs. It adds keys, caches
  responses, respects rate limits and falls back to snapshots.
- **`server/providers/`** has one adapter per data source. Each maps raw API JSON into the shared,
  sport-agnostic types in `shared/types/sports.ts`. Adding a sport means adding one provider.
- **`shared/utils/competitions.ts`** lists every league. Adding a league from an existing source is
  one line.
- **`server/utils/stories.ts`** builds headlines and summaries from fixed templates. Every phrase maps
  to a data field.

### API

| Endpoint | Returns |
|---|---|
| `GET /api/landing` | Front-page stories, fixture strip and tables |
| `GET /api/competitions` | All leagues, with availability |
| `GET /api/competitions/:competition/teams` | Teams |
| `GET /api/competitions/:competition/standings` | Table |
| `GET /api/competitions/:competition/matches?team=&state=finished\|upcoming` | Current-season matches |
| `GET /api/competitions/:competition/matches/:id` | One match |
| `GET /api/competitions/:competition/matches/:id/press` | Press headlines about the match |
| `GET /api/health` | Status of each data source |

Every data response carries an `x-voz-data-source: live|snapshot` header.

## Reliability

The challenge asks that nothing be published as fact unless it is true. What is in place so far:

- **Score reconciliation:** for every finished Liiga game this season, the goals we count add up to
  the final score. The raw feed lists disallowed goals and shootout deciders as goal events; the
  provider separates them.
- **Text clean-up:** some Liiga names arrive with broken characters ("KÃ¤rpÃ¤t"); every response
  is repaired.
- **Honest gaps:** when a data plan has no goal details (football free tier), the page says so instead
  of inventing them.
- **No borrowed content:** story text comes only from our data, and images are team crests plus
  data visuals, never photos from other outlets.
- **Labelling:** generated stories are marked "Written automatically from official match data".

## Data limits

- The football-data.org free plan covers 12 top competitions (scores, standings, teams), with no goal
  scorers, lineups or match stats. **Veikkausliiga requires a paid plan.**
- GNews (free plan: 100 requests a day) has no Finnish-language sources, so Liiga games rarely have
  press headlines; the card then says so. Results are cached for 6 hours.
- Liiga season ids are the year the season ends (`2027` = 2026–27).

## Project layout

```
app/          pages, layouts, components (news/), composables, utils
server/       api/ routes, providers/, utils/ (upstream, sports, stories)
shared/       types and helpers used by both server and scripts
scripts/      snapshot.ts
data/         snapshots/ for offline mode
design-system/voz/   design rules (MASTER.md, pages/landing.md)
```

## Design

Dark app screens with a gold accent, and a light editorial front page. Fonts are Barlow Condensed
for scores and titles and Inter for text. Rules, tokens and contrast checks are in
[design-system/voz/MASTER.md](design-system/voz/MASTER.md). Contributor notes for AI coding agents are
in [CLAUDE.md](CLAUDE.md).

## Data sources

- Liiga stats API – official Finnish ice hockey league data
- [football-data.org](https://www.football-data.org) – football data (free plan)
- [GNews](https://gnews.io) – headline search for "What the press says"
