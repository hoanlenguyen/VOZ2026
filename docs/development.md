# Development, deployment and architecture

Technical reference for VOZ (moved from the README). Feature overview: [README](../README.md); contributor rules for AI coding agents: [CLAUDE.md](../CLAUDE.md).

## Quick start

Requirements: Node.js 22.22.3+, 24.15.0+, or 26+ (use an even-numbered supported release;
the scripts use Node's built-in TypeScript support).

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
| `NUXT_OPENAI_API_KEY` | OpenAI key for AI match stories (optional: without it the pre-written demo stories are served) |
| `NUXT_OPENAI_MODEL` | Model for AI match stories, as a name or API id (default `GPT-6 Luna`). Switch models by changing it; in production it is set in `wrangler.jsonc` |
| `NUXT_DATA_MODE` | `live` (APIs only), `auto` (APIs, fall back to snapshots) or `snapshot` (offline) |
| `NUXT_NEWS_AI_PROVIDER` | `openai` (default) or `huggingface`; no automatic provider switching |
| `NUXT_OPENAI_API_KEY` | Server-only OpenAI API key for click-to-summarize |
| `NUXT_OPENAI_MODEL` | OpenAI model ID, default `gpt-6-luna` |
| `NUXT_HF_TOKEN` | Server-only token when using Hugging Face |
| `NUXT_HF_MODEL` | Hugging Face model ID, default `openai/gpt-oss-120b` |

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
([.github/workflows/deploy.yml](../.github/workflows/deploy.yml)): install → typecheck → `nuxt build`
(Nitro preset `cloudflare_module`) → `wrangler deploy`. It can also be started by hand from the
Actions tab ("Run workflow").

One-time setup, in the GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare token with Workers deployment and D1 Edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account id (Workers & Pages overview page) |
| `NUXT_LIIGA_API_KEY` | Liiga API key |
| `NUXT_FOOTBALL_DATA_TOKEN` | football-data.org token |
| `NUXT_GNEWS_API_KEY` | GNews API key (press headlines) |
| `NUXT_OPENAI_API_KEY` | OpenAI API key (AI match stories, headline translation, news summaries when `NUXT_NEWS_AI_PROVIDER=openai`) |
| `NUXT_HF_TOKEN` | Hugging Face token (news summaries when `NUXT_NEWS_AI_PROVIDER=huggingface`) |

The API keys are uploaded as encrypted Worker secrets on each deploy. Non-secret settings
(`NUXT_DATA_MODE`) live in [wrangler.jsonc](../wrangler.jsonc). The site is served at
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
| `npm test` | Story checker tests |
| `npm run warm:stories` | Pre-write the demo's AI stories into `data/stories/` (dev server running) |
| `npm run warm:podcasts` | Pre-generate demo podcast episodes into `data/podcasts/` + `public/podcasts/` (dev server running) |
| `npm run snapshot` | Save API responses to `data/snapshots/` |
| `npm run match-news -- <match.json>` | Find 3–4 verified publisher previews as JSON |
| `npm test` | Run match-news parser, validation, and crawler tests without network |

## How it works

```
Liiga API ─┐                                   ┌─ /api/landing (stories, fixtures, tables)
           ├─ upstream.ts ─ providers/* ─ shared types ─┤
football ──┘  (keys, cache,  (raw JSON →     (Match,    └─ /api/competitions/:id/...
-data.org      rate limit,    sport-agnostic   Standing…)
               snapshots)     types)
```

- **`server/utils/upstream.ts`** handles external sports/search APIs. It adds keys, caches
  responses, respects rate limits and falls back to snapshots.
- **`server/lib/news/`** discovers and verifies public publisher pages for match-news JSON,
  using its own restricted crawler; `server/utils/match-news.ts` adds API caching and optional GNews discovery.
- **`server/providers/`** has one adapter per data source. Each maps raw API JSON into the shared,
  sport-agnostic types in `shared/types/sports.ts`. Adding a sport means adding one provider.
- **`shared/utils/competitions.ts`** lists every league. Adding a league from an existing source is
  one line.
- **`server/utils/stories.ts`** builds headlines and summaries from fixed templates. Every phrase maps
  to a data field.

### AI match stories

A single AI agent writes the match story; a harness around it makes sure only checked text is shown.

```
match data ─ facts.ts ─ fact list f1…fN ─┐
                                          ├─ agent (GPT-6 Luna) ── get_facts → write → check_story → submit_story
                       story-check.ts ────┘        │                                         │
                                                   └─ harness: 8 turns / 90 s, final check, trace, template fallback
                                                                                             │
                              cache: memory → Workers KV → bundled data/stories/ → page ─────┘
```

- **Fact list** (`server/utils/facts.ts`): every verified statement about the match, numbered
  (result, goals and assists, cards, VAR, substitutions, stats, last five results, table before and
  after, head-to-head this season, line-ups, referee). All computed from data.
- **Agent** (`server/utils/story-agent.ts`): GPT-6 Luna through the OpenAI Responses API
  (`server/utils/llm.ts`). It can only use three tools: get the facts, check a draft, submit. Every
  sentence cites the facts it relies on.
- **Checker** (`shared/utils/story-check.ts`): every number and every person in a sentence must appear
  in the facts it cites (rounding allowed); no quotes, no "said", no injuries; word range per length.
  The harness checks again on submit; if the agent cannot pass within 8 turns or 90 seconds, a
  template story built from the facts is shown instead and labelled as such.
- **Versions:** 3 lengths (short, standard, long read) × 4 perspectives (neutral, home fans, away
  fans, analyst) = 12 per match.
- **Switching models:** set `NUXT_OPENAI_MODEL` (for example `GPT-6 Sol`). The page label follows the
  model, and pre-written stories from another model are not reused, so the new model writes its own;
  run `npm run warm:stories` to pre-write them.
- **Cache** (`server/utils/story-cache.ts`): memory, then Workers KV, then stories pre-written into the
  app with `npm run warm:stories` (re-checked against today's facts before use), then a live run.
  Only stories that passed the check are cached.
- **Cost and speed:** a run takes 3 turns, 6–14 seconds and about 5,000 tokens in / 700 out, roughly
  $0.001 per version. Cached and pre-written stories load in under 0.2 seconds.
- **On the page:** length and perspective switches, "Show the facts behind this story" (numbered links
  from each sentence to its facts) and "How this was made" (the agent's steps, time and tokens).

To refresh the pre-written demo stories after changing facts or the agent's instructions (dev server
running), then commit `data/stories/`:

```bash
npm run warm:stories -- --base http://localhost:3000 --match premier-league/2645271
```

### API

| Endpoint | Returns |
|---|---|
| `GET /api/landing` | Front-page stories, fixture strip and tables |
| `GET /api/competitions` | All leagues, with availability |
| `GET /api/competitions/:competition/teams` | Teams |
| `GET /api/competitions/:competition/standings` | Table |
| `GET /api/competitions/:competition/matches?team=&state=finished\|upcoming` | Current-season matches |
| `GET /api/competitions/:competition/matches/:id` | One match |
| `GET /api/competitions/:competition/matches/:id/press` | Match coverage and three recent updates per team; discovery only |
| `POST /api/news/:id/summary` | On-demand AI summary for a discovered article; cached 24 hours |
| `POST /api/competitions/:competition/matches/:id/summary` | Automatic three-source match synthesis; status-aware caching |
| `GET /api/competitions/:competition/matches/:id/story?length=&tone=` | AI match story with its facts (`length`: short, standard, long; `tone`: neutral, home-fan, away-fan, analyst) |
| `GET /api/health` | Status of each data source |
| `POST /api/match-news` | Verified title/link/summary JSON for supplied match info |
| `GET /api/news/sources?competition=premier-league` | Current reviewed publisher priority list for a league |
| `GET /api/news/monitor` | Background news collector freshness, queue and source health metadata |

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
- **AI stories are checked, not trusted:** each sentence cites numbered facts, and a checker verifies
  every number and name against them before publishing; failures fall back to a labelled template.
  Readers can open the facts behind every sentence. Tested with deliberately wrong drafts (`npm test`).
- **Labelling:** template stories are marked "Written automatically from official match data"; AI
  stories are marked "AI-written by GPT-6 Luna from official match data · checked against N facts".

## Data limits

- The football-data.org free plan covers 12 top competitions (scores, standings, teams), with no goal
  scorers, lineups or match stats. **Veikkausliiga requires a paid plan.**
- Optional GNews search is quota-limited. Finnish leagues also use the official league index and
  Yle/MTV sports feeds; missing, restricted or irrelevant coverage is reported as a gap.
- Liiga season ids are the year the season ends (`2027` = 2026–27).

## Project layout

```
app/          pages, layouts, components (news/), composables, utils
server/       api/ routes, providers/, utils/ (upstream, sports, stories, facts, story agent, cache)
shared/       types and helpers used by both server and scripts (incl. the story checker)
scripts/      snapshot.ts, warm-stories.ts
tests/        story checker tests (npm test)
data/         snapshots/ for offline mode, mock/ full-data matches, stories/ pre-written AI stories
design-system/voz/   design rules (MASTER.md, pages/landing.md)
```

## Design

Dark app screens with a gold accent, and a light editorial front page. Fonts are Barlow Condensed
for scores and titles and Inter for text. Rules, tokens and contrast checks are in
[design-system/voz/MASTER.md](../design-system/voz/MASTER.md). Contributor notes for AI coding agents are
in [CLAUDE.md](../CLAUDE.md).

## Data sources

- Liiga stats API – official Finnish ice hockey league data
- [football-data.org](https://www.football-data.org) – football data (free plan)
- [GNews](https://gnews.io) – headline search for "What the press says"
- [OpenAI GPT-6 Luna](https://openai.com/index/introducing-gpt-6-sol-and-luna/) – the model behind AI match stories
