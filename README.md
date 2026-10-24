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
- **AI match stories** (mock match): a single GPT-6 Luna agent writes the story in 3 lengths × 4
  perspectives (neutral, either team's fans, analyst) from a ledger of verified facts. Every sentence
  cites its facts and is checked (numbers, names, no quotes or injuries) before it is shown; readers can
  open the facts behind each sentence and see how the story was made. Stories are cached in memory, in
  Workers KV, and pre-written into the app for the demo (`npm run warm:stories`).
- **What the press says** (match page): other outlets' headlines about the game, with source and
  link, found via [GNews](https://gnews.io) and matched by date and both team names. Only headlines and
  links are shown, so VOZ points to the coverage instead of republishing it.
- **News & insights** (match page): one automatic match summary synthesized from three verified
  sources, plus three recent updates per team about form, players, and injuries. Match summaries
  are labelled Pre-match or Post-match. During play, pre-match links are retained and news
  discovery/synthesis pauses; the match page handles live updates. Rolling live blogs are excluded.
  Team headlines retain click-to-summarize with a cache of up to 24 hours, invalidated sooner by source changes.
  Three distinct verified publishers are required for the combined summary; missing coverage is
  reported explicitly rather than filled with unrelated or unverified articles.
- **Full match data demo** (mock): Ipswich Town 1–1 Nottingham Forest (Premier League, 23 Oct 2026)
  with an event timeline, line-ups on a pitch, possession/xG/shots and officials. It shows what VOZ does
  with a richer data feed than the free football plan. Add more in `data/mock/<competition>/<id>.json`.
- **SportWorld API** (mock sports server, `/sportworld/api`, open, no key; Swagger-style docs and
  try-it page at `/sportworld`): a stand-in for a paid deep-data feed, labelled "Simulated match data
  (demo)". `POST /sportworld/api/generate` simulates 1–2 matches: the newest finished fixtures not yet
  generated keep their real final and half-time score from football-data.org; line-ups, scorers, events
  and stats are simulated from the clubs' squads, in the same JSON structure as the full-data demo match.
  Stored in D1.
- **AI match posts** (`/newsroom`, "AI match posts"): a cron-driven agent turns new SportWorld matches
  into posts: a story written by the GPT-6 Luna story agent from the match facts and checked sentence by
  sentence (English and Finnish), plus trusted publishers' coverage of the fixture and both teams as
  attributed links. Posts are tagged "AI content" and "Simulated data" and wait for the newsroom's review;
  readers see nothing until a post is approved. The Workers cron ticks every 5 minutes and runs the agent
  when the interval set in the Newsroom (5 minutes to 24 hours) has passed; "Run now" runs it at once.
  The review page (`/newsroom/posts/:id`) shows the story with the facts each sentence cites, and lets
  the newsroom edit it (with a live fact check), approve, reject or unpublish it. Approved posts appear
  on the front page with a "Simulated data" tag and at `/posts/:id`, which opens with a banner saying the
  match details were simulated.
- **Onboarding** (`/onboarding`): pick a league and see its teams (first version).
- **Offline demo mode:** saved API snapshots keep the app running without network.
- **Data status** (`/status`): live check of each data source.

Planned: AI stories for every finished match (and in Finnish), a playoff-odds engine, alerts that
fire only when something matters, a 60-second audio briefing, and data-driven vertical videos.

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

## Match news as JSON

Pass a complete match export (with a `matchInfo` property) or just the match-info object.
The required fields are `homeTeam.name`, `awayTeam.name`, and `kickoff`.
A local kickoff such as `2026-10-23 20:00:00` also requires an IANA
`kickoffTimezone`, such as `Europe/London`. ISO timestamps with offsets are accepted.

From the repository folder, run the standalone lookup (no app server or news API key required):

```powershell
npm run match-news -- "../ipswich-vs-nottm-forest-2645271.json" --output "../match-news-result.json"
```

Use `--limit 3` to request three publishers; the default is four. Omit `--output` to
print JSON to stdout (use `npm run --silent match-news -- ...` for machine-readable output).

The same feature is available as `POST /api/match-news` with `Content-Type: application/json`.
Send the match export unchanged, optionally adding a top-level `"limit": 3` or `4`.
The API caches results for 15 minutes. To run the CLI through the API instead:

```powershell
npm run match-news -- "../ipswich-vs-nottm-forest-2645271.json" --endpoint http://localhost:3000/api/match-news --output "../match-news-api-result.json"
```

The response contains `matchId`, `status`, `checkedAt`, `note`, and an `articles` array.
Each article has **`title`, `link`, `summary`**, plus `source` and `publishedAt` for attribution.
`summary` is an extractive publisher preview of at most 24 words, not an AI-written recap.
No full articles, images, or input commentary are returned.

Discovery uses public sports feeds and official news indexes. The trusted registry in
`server/lib/news/sources.ts` currently includes BBC Sport, Sky Sports, The Guardian,
Premier League, and the Ipswich/Nottingham Forest club sites. Club indexes are consulted only
for matches involving that club. Add other clubs or sports to that server-owned registry.
When `NUXT_GNEWS_API_KEY` is configured, the **API** also uses GNews for historical discovery;
all resulting links still undergo the same publisher verification. The standalone CLI uses feeds/indexes only.

Results require a reachable HTTPS publisher article, permitted crawling, both teams (the
publishing club can identify itself implicitly), and publication within three days before to
two days after kickoff. Future publication dates, unrelated or old meetings, duplicate publishers,
untrusted redirects, and pages marked as paywalled or restricting previews are excluded.
Publisher HTML and hydration data are parsed without executing scripts. Requests have time,
response-size, crawl-delay, and redirect limits. News lookup uses live public pages independently
of `NUXT_DATA_MODE`; sports snapshots cannot verify third-party coverage.

The target is **three or four distinct publishers, never invented results**. `status` is `ok`
for at least three, `partial` for one or two, `none` when searched indexes yield no verified
coverage, and `unavailable` when every source index fails and no article is verified.
The note explains a shortfall. Recent feeds are not historical archives; sparse coverage,
client-rendered indexes, publisher restrictions, or network failures can produce fewer results.
Publication date plus team matching is a relevance heuristic, not a publisher match-ID join.

Run the isolated parser/crawler tests with `npm test`, then `npm run typecheck` and `npm run build`.

### News & insights: team news and AI summaries

`GET /api/competitions/:competition/matches/:id/press` returns three groups: match coverage,
the home team's recent news, and the away team's recent news. Team discovery targets three
verified articles per team from the last 14 days, prioritizing form, players, and injuries.
It uses team-specific publisher feeds where available, deduplicates headlines/URLs, and excludes
other clubs' official updates, youth/women's sides when the match is for senior men, and ticketing
or commercial stories. Sparse or inaccessible coverage is reported explicitly rather than padded.
No article bodies or generated summary paragraphs are sent by this discovery endpoint.
Background classification metadata can accompany pre-match articles.

The browser automatically requests `POST /api/competitions/:competition/matches/:id/summary`
to show one combined match summary with its three original source links. It does not require
opening each match headline. The server resolves the current official status/score and selected
sources, rather than accepting a client-supplied phase or article URLs. Its prompt writes a
Pre-match preview for Upcoming and a recap for Post-match. While a match is live, the news
section retains pre-match links and pauses discovery and summaries. Live-blog URLs are excluded
from news discovery in every phase. The news API also rejects direct live synthesis requests.
Elapsed time alone never promotes a scheduled match to live or final. Postponed/cancelled
matches do not generate a normal match recap.

Match discovery and source rechecks use this cache policy:

| Match state | Recheck interval |
|---|---|
| Upcoming, over 48 hours to kickoff | 60 minutes |
| Upcoming, 48–6 hours to kickoff | 15 minutes |
| Upcoming, 6–1 hours to kickoff | 5 minutes |
| Upcoming, within one hour | 1 minute, capped at kickoff |
| Live match | No news crawling or synthesis; retain pre-match links |
| Post-match, under 6 hours since kickoff | 5 minutes |
| Post-match, 6–24 hours since kickoff | 1 hour |
| Post-match, over 24 hours since kickoff | 24 hours |

A changed status, score, kickoff, or selected source invalidates the match cache immediately
when the provider reports it. After expiry, source text is reread; if the articles are unchanged,
the existing AI synthesis is reused without another model call. Changed source text generates
a new synthesis. A separate content cache lasts at most
24 hours. The visible page polls status every minute near kickoff/during play/early post-match,
and every five minutes otherwise. Hidden tabs pause refreshes and catch up on return. Individual
football match endpoints use a 60-second shared cache; the provider currently prefers
the cached season list when its match is present, so season-list freshness can still limit status updates.
This depends on provider freshness and quota; snapshots are not a live score feed.

Selecting a **team** headline calls `POST /api/news/:id/summary`. Only server-registered article IDs are
accepted. The server rereads the accessible publisher text and asks the configured model for a
short paraphrase, preserving uncertainty and attribution. A failed output validation allows one
bounded correction attempt within the same click; provider/network failures are not automatically retried. Supplied article text is treated as
untrusted evidence, with no model tools enabled. Output requires source evidence and a numeric
consistency check. These checks are safeguards, not a guarantee of factual accuracy; the UI labels
the paragraph as AI-written and links to the original report.

Successful **team-article** summaries have a **24-hour maximum lifetime** from generation, with earlier
invalidation after a monitored correction. Expired summaries regenerate
only on the next click; failures are not cached. Cache identity includes article, provider, model,
content hash when monitored, and prompt version. Reopening an unchanged, unexpired summary does not make another browser request.
Simultaneous requests within one server share one generation. In production the cache is in
Cloudflare KV; simultaneous misses in separate Workers can still generate twice because KV is
eventually consistent. Development stores summaries in ignored `.data/news/`, so they survive
server restarts. On-demand team discovery is cached separately for 15 minutes; pre-match coverage
reads the background collection on every page poll.

Add real credentials only to ignored `.env`/`.dev.vars`; the committed examples contain placeholders.
OpenAI uses the Responses API with `store: false`; Hugging Face uses its compatible chat endpoint.
Select a provider explicitly using `NUXT_NEWS_AI_PROVIDER`. Model/provider failures remain visible
with a retry action and an original-article link. The standalone match-news CLI continues to return
extractive previews; the match-page summary endpoint provides the on-demand AI feature.

## League news source priorities

On-demand match discovery follows a **server-owned ranking**, rather than asking the model to choose publishers.
Each tier finishes before the next begins. Official club sites share a tier and are eligible only
for a participating team. A lower tier fills missing places; it cannot displace verified higher-tier
coverage because it is newer or faster. Match coverage takes one article per publisher; team
coverage can take three from the same official source. Topic variety and recency break ties within
a tier. On-demand discovery stops when the requested lists are full, and never pads gaps with unverified news.
The pre-match background collector described below continues monitoring **all approved tiers**;
its visible selections also consider freshness and the importance of new developments.

| Competition | First priority | Second priority | Remaining priorities, in order |
|---|---|---|---|
| Premier League | Premier League | Registered official clubs | BBC Sport → Sky Sports → The Guardian |
| Championship | EFL | Registered official clubs | BBC Sport → Sky Sports → The Guardian |
| LaLiga | LaLiga | Registered official clubs | BBC Sport → Sky Sports → The Guardian |
| Bundesliga | Bundesliga | Registered official clubs | BBC Sport → Sky Sports → The Guardian |
| Serie A | Lega Serie A | Registered official clubs | BBC Sport → Sky Sports → The Guardian |
| Ligue 1 | Ligue 1 | Registered official clubs | BBC Sport → Sky Sports → The Guardian |
| Eredivisie | Eredivisie | Registered official clubs | BBC Sport → Sky Sports → The Guardian |
| Primeira Liga | Liga Portugal | Registered official clubs | BBC Sport → Sky Sports → The Guardian |
| Champions League | UEFA | Registered official clubs | BBC Sport → Sky Sports → The Guardian |
| Liiga | Liiga | Registered official clubs | Yle Sport → MTV Urheilu |
| Veikkausliiga | Veikkausliiga | Registered official clubs | Yle Sport → MTV Urheilu |

Edit `server/lib/news/source-policy.ts` to reorder or extend a league's list. Publisher hostnames,
article paths and indexes are reviewed entries in `server/lib/news/sources.ts`; search results and
AI output cannot introduce new domains. The current official-club registry contains **Ipswich Town
and Nottingham Forest**. Other teams use their league authority and approved newsrooms until their
club is registered. Cross-league competition authorities are excluded. JSON without a competition
uses only the generic BBC/Sky/Guardian fallback; an explicitly unsupported competition is rejected.
The JSON parser accepts our competition IDs, league names and provider codes (e.g. `PL` or `EPL`).

Inspect the active ranking at `GET /api/news/sources?competition=premier-league`. Discovery JSON
also includes `sourcePolicy`, `sourceChecks` (selected, unavailable, or no verified articles), and
each article's `sourceId`, `sourcePriority` and `sourceKind`. The `/press` endpoint puts checks on
each group. These fields explain fallbacks without exposing publisher text or credentials.

Every result still needs an allowed HTTPS host, crawl permission, a valid publication date, a
relevant article and readable publisher content. Each source has a 12-second crawl budget with
5-second individual request timeouts, so a stalled authority cannot indefinitely block fallback.
A priority does **not** promise availability: client-rendered news indexes (currently including
Premier League and Liiga) may expose no article links to the text crawler; blocked, paywalled,
stale or unparseable articles are skipped. Optional GNews candidates are verified against the same
ranked allowlist, never treated as evidence themselves. Recent feeds cannot guarantee historical coverage.

Source rank is an editorial preference, not proof of accuracy. The AI receives the verified
reports in priority order, keeps rumours and injuries attributed and uncertain, treats a club's
statement as that club's account, and preserves conflicting reports rather than inventing agreement.
Official match state remains the authority for the current status and score. Status-aware caching
and the 24-hour maximum on-click team-summary cache remain active; pre-match intervals follow
the monitoring schedule below. Discovery caches
include competition and `SOURCE_POLICY_VERSION`; bump it after any ranking/registry change to
invalidate prior selections and combined summaries immediately.

## Background pre-match news monitoring

`server/plugins/news-monitor.ts` runs a Cloudflare scheduled hook every minute and sends due jobs
to `voz-news`. The queue consumer discovers fixtures, scans feeds, verifies publisher articles and
classifies new developments. Monitoring runs without any reader opening the site. Nuxt development
uses the same scheduler and job handlers in a background loop while the dev server is running.
Stopping the local server stops that local loop; deployed Cron Triggers provide unattended operation.

| Time before kickoff | Publisher feed check interval |
|---|---|
| More than 48 hours | 60 minutes |
| 48–6 hours | 15 minutes |
| 6–1 hours | 5 minutes |
| Final hour | 1 minute |

The schedule covers the next seven days of fixtures. Fixtures refresh hourly, or every 15 minutes
for a league with a match within six hours (subject to the sports provider's own cache/quota).
Actual provider status controls eligibility; elapsed time never declares a match live or finished.
Known postponements/cancellations stop pre-match monitoring. A delayed scheduled status is watched
for up to two hours after kickoff. Provider/snapshot limitations remain visible through the existing
match-data source header and monitoring metadata; these are not guaranteed real-time updates.

All approved publishers are monitored even if three cards are already filled. A feed URL is shared
across teams/matches and uses the shortest applicable interval. HTTP ETag/Last-Modified validators
avoid downloading unchanged feeds. Existing article bodies are rechecked no faster than every two
minutes (or the feed interval if longer), including when the feed returns 304, because corrections
may not alter a feed. Source requests share a database-backed hostname throttle and respect robots
rules, crawl delays and preview restrictions. Failures back off up to an hour; empty JavaScript-only
indexes are recorded as `empty`, not successful article discovery. Those sites still need a readable
approved index, sitemap, or publisher-supported feed/API to close the coverage gap.

D1 stores fixture plans, feed health, verified article evidence, hashes, classification results and
the job ledger. The schema in `server/lib/news/database.ts` is initialized with idempotent additive
statements. Local Cloudflare emulation persists D1 under ignored `.wrangler/state/`; a plain Node
development fallback uses `.data/news-watch.sqlite`. Article text is server-only and retained for
14 days after its last verification; selection uses publication dates within the last 14 days.
It is never returned by the public monitoring endpoint or republished in the UI.

Atomic SQL job claims with three-minute leases prevent concurrent redelivery from processing the
same job. Unfinished work is deduplicated by kind/target as well as job identity. Expired leases
are recoverable; failed work gets persisted exponential backoff and a maximum of four attempts.
`voz-news-dead` receives exhausted queue deliveries. New articles are scheduled ahead of routine
body rechecks, and the dispatcher sends at most 100 jobs per tick. Queue/backoff/network delays can
exceed the desired poll interval; monitor backlog age rather than assuming every check is instant.

AI runs **classification only** for a new or changed content hash, using the selected existing
OpenAI/Hugging Face provider. Output requires an exact short source quotation and bounded values
for topic, importance and certainty. Rumours cannot get breaking-news importance. The default
limit is **100 classification attempts per UTC day**, reserved atomically across Workers; use
`NUXT_NEWS_ASSESSMENT_DAILY_LIMIT=0` to use deterministic ranking only. Missing keys, provider
failures or a spent budget fall back to source-based rules. Unchanged text is not reclassified.
Classification is an editorial aid, not an independent confirmation of a report's claims.

Pre-match pages select directly from the collected corpus on each poll. Source authority remains
a ranking preference, while recent injuries, lineups, suspensions and postponements can outrank
an older routine preview. Match previews select three different publishers and include both teams'
coverage where distinct publishers are available. A team update can inform the preview without
naming the opponent in its headline. Fewer than three verified publishers produces an explicit gap,
not invented evidence. Original source dates, uncertainty and attribution remain intact.

Selected content hashes are part of the match-summary revision and the team-summary cache key.
A publisher correction invalidates the previous summary before 24 hours; a removed/restricted
article leaves the corpus. The browser also discards an open cached team result when its article
hash changes. Team summaries are still generated **only after a click**. The automatic match
summary regenerates on the next page request after its selected evidence changes; background
classification never calls the team-summary generator or creates summaries for unseen matches.

Inspect `GET /api/news/monitor` for the last scheduler tick, active fixture count, verified article
count, pending-job age, daily AI usage, and each feed's last successful check, next due time,
failure count, discovered-link count and stale flag. It returns metadata only. This is also the
first place to look when new stories are missing.

Configuration: `NUXT_NEWS_MONITOR_ENABLED=true` and `NUXT_NEWS_ASSESSMENT_DAILY_LIMIT=100`.
Disable the monitor explicitly with `NUXT_NEWS_MONITOR_ENABLED=false`; on-demand discovery remains.
Source registration is still manual and server-owned; the current official club registry contains
Ipswich and Forest. Monitoring cannot find articles on an unregistered or unreadable site.

Production setup is included in `wrangler.jsonc`: minute Cron, D1 binding, processing queue and
dead-letter queue. Before deploying, `npm run news:provision` creates missing queues using
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; it reuses existing queues. The token needs
Workers deployment, D1 provisioning and Queue Edit permissions. `npm run news:provision -- --check`
prints required resource names without contacting Cloudflare. Wrangler 4.152 provisions the D1
binding automatically on deployment. CI provisions queues before deploying; `npm run deploy`
does the same. These commands create resources/deploy only when explicitly run; local testing
does not activate a production schedule.

Cloudflare references: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/),
[queue delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/),
[automatic D1 provisioning](https://developers.cloudflare.com/changelog/post/2025-10-24-automatic-resource-provisioning/).

## Deployment (Cloudflare Workers)

Every push to `main` builds and deploys the app to Cloudflare Workers through GitHub Actions
([.github/workflows/deploy.yml](.github/workflows/deploy.yml)): install → typecheck → `nuxt build`
(Nitro preset `cloudflare_module`) → `wrangler deploy`. It can also be started by hand from the
Actions tab ("Run workflow").

One-time setup, in the GitHub repository under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare token with Workers deployment, D1 provisioning and Queue Edit permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account id (Workers & Pages overview page) |
| `NUXT_LIIGA_API_KEY` | Liiga API key |
| `NUXT_FOOTBALL_DATA_TOKEN` | football-data.org token |
| `NUXT_GNEWS_API_KEY` | GNews API key (press headlines) |
| `NUXT_OPENAI_API_KEY` | OpenAI API key (AI match stories, headline translation, news summaries when `NUXT_NEWS_AI_PROVIDER=openai`) |
| `NUXT_HF_TOKEN` | Hugging Face token (news summaries when `NUXT_NEWS_AI_PROVIDER=huggingface`) |

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
| `npm test` | Story checker tests |
| `npm run warm:stories` | Pre-write the demo's AI stories into `data/stories/` (dev server running) |
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
| `GET /api/competitions/:competition/matches/:id/press` | Trusted publishers' match coverage and three recent updates per team (news monitor); discovery only |
| `GET /api/competitions/:competition/matches/:id/press-headlines` | GNews headlines about the match ("What the press says") |
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
[design-system/voz/MASTER.md](design-system/voz/MASTER.md). Contributor notes for AI coding agents are
in [CLAUDE.md](CLAUDE.md).

## Data sources

- Liiga stats API – official Finnish ice hockey league data
- [football-data.org](https://www.football-data.org) – football data (free plan)
- [GNews](https://gnews.io) – headline search for "What the press says"
- [OpenAI GPT-6 Luna](https://openai.com/index/introducing-gpt-6-sol-and-luna/) – the model behind AI match stories
