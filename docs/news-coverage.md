# News coverage: publisher links, source priorities, background monitoring

Technical reference for VOZ's news coverage (moved from the README). Feature overview: [README](../README.md).

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

### News: team updates and source links

`GET /api/competitions/:competition/matches/:id/press` returns three groups: match coverage,
the home team's recent news, and the away team's recent news. Team discovery targets three
verified articles per team from the last 14 days, prioritizing form, players, and injuries.
It uses team-specific publisher feeds where available, deduplicates headlines/URLs, and excludes
other clubs' official updates, youth/women's sides when the match is for senior men, and ticketing
or commercial stories. Sparse or inaccessible coverage is reported explicitly rather than padded.
No article bodies or generated summary paragraphs are sent by this discovery endpoint.
Background classification metadata can accompany pre-match articles.

The page displays the original match source links without a "This match" heading or combined
AI summary. It does not request match synthesis automatically. The
`POST /api/competitions/:competition/matches/:id/summary` endpoint remains available for integrations.
The server resolves the current official status/score and selected
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

`server/plugins/news-monitor.ts` runs a Cloudflare scheduled hook every minute. It plans the due
jobs (`tick`) and then runs a few of them itself (`drain`): at most 4 per minute, within 25 seconds,
and only while the daily job budget lasts (`NUXT_NEWS_JOBS_DAILY_LIMIT`, default 3000 per UTC day,
reserved atomically in D1 `news_job_budget`). Jobs left over wait for the next minute. The jobs
discover fixtures, scan feeds, verify publisher articles and classify new developments. There is no
Cloudflare Queue: the free plan's 10,000 queue operations a day ran out by about 07:00 UTC (the
monitor needed about 30,000), which stopped monitoring for the rest of the day. Monitoring runs without any reader opening the site. Nuxt development
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
New articles are scheduled ahead of routine body rechecks. The per-minute and daily caps, backoff
and network delays can exceed the desired poll interval; monitor backlog age rather than assuming
every check is instant.

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

Configuration: `NUXT_NEWS_MONITOR_ENABLED=true`, `NUXT_NEWS_ASSESSMENT_DAILY_LIMIT=100` and
`NUXT_NEWS_JOBS_DAILY_LIMIT=3000`.
Disable the monitor explicitly with `NUXT_NEWS_MONITOR_ENABLED=false`; on-demand discovery remains.
Source registration is still manual and server-owned; the current official club registry contains
Ipswich and Forest. Monitoring cannot find articles on an unregistered or unreadable site.

Production setup is included in `wrangler.jsonc`: the minute Cron and the D1 binding, which
Wrangler 4.152 provisions automatically on deployment. The token needs Workers deployment and D1
Edit permissions. Local testing does not activate a production schedule; to run the cron locally,
`npx wrangler dev --test-scheduled` and open `/cdn-cgi/handler/scheduled?cron=*+*+*+*+*`.

Cloudflare references: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/),
[queue delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/),
[automatic D1 provisioning](https://developers.cloudflare.com/changelog/post/2025-10-24-automatic-resource-provisioning/).
