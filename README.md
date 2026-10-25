# VOZ – My Sports World

AI-powered, personalised multi-sport news, built for the Kaleva Media hackathon
**"Beyond the Scoreboard – Reinventing local sports coverage with AI"**.

VOZ turns official match data into news people want to read and hear: match stories, headlines and
short podcasts, in English and Finnish, for ice hockey and football. The rule behind every feature:
**write only from verified facts**. Every number and name an AI writes is checked against the match
data before a reader sees it, and nothing is published that the data does not support.

**Live site:** https://voz.lenguyenhanhoan.workers.dev · demo accounts (password `demo`):
`free@demo.com`, `subscription@demo.com`, `newsroom@demo.com`

**Presentation:** [VOZ Presentation](https://claude.ai/artifact/PGQv8sBrdHnyL1bEtAripS)

## Features we built

### For every reader

- **News front page:** fixture strip, section tabs per sport and league, a lead story, story cards,
  a "Latest" list and league tables that show each team's movement since its last game.
- **11 competitions in 2 sports:** Liiga (ice hockey) and nine football leagues plus the Champions
  League. Veikkausliiga is listed and needs a paid data plan.
- **AI headlines:** a title and subtitle for every match, written from each side's edge (table gap,
  form, runs, xG, comebacks) and checked like the stories.
- **Match page that reads as a story:** score graphic, headline, byline, the opening of the AI match
  story, the league table with both teams marked, and what other outlets wrote (headline, source and
  link only, never their text).
- **English and Finnish** on the same addresses, picked from the browser and switchable at any time.
  Finnish is written directly by the AI, not translated; other outlets' headlines are translated.
- **Discussion:** comment totals and likes are public, with a preview of the newest comments. Below
  them, a few fan posts "from" Instagram, TikTok, Facebook, Threads and X, each with its platform
  icon (mock: invented fans and handles, written from the match's own teams and score).
- **Share:** a share menu for the discussion and for each post: X, Facebook, Threads and WhatsApp
  open their share page; Instagram and TikTok copy the link; phones also get their own share sheet.
- **Communities** (tab next to News, mock): fan communities for Ipswich, Forest, Premier League
  tactics and Liiga, with matchday threads, polls, drawn pictures (stadium, away coach, tactics board,
  shot map, rink), likes, Join and sharing. Communities, members and posts are invented for the demo.

### For VOZ Plus subscribers

- **Full AI match story**, checked sentence by sentence, in the version the newsroom chose (three
  lengths, four perspectives: neutral, either team's fans, analyst).
- **Match stats comparison, timeline and line-ups** on the pitch.
- **AI podcasts:** 20–30 second audio bulletins about a match, a team or a league, with transcripts.
  New team and league episodes are made every morning when something has changed.
- **My teams and My favourites:** follow teams, leagues and players; My favourites is a front page
  with only their stories, fixtures and tables. Free readers can choose but not save.
- **Join the discussion:** post, reply and like.

Visitors and free readers get a teaser of each story that fades into the VOZ Plus offer. The paywall
is enforced on the server, and the newsroom can open any match to everyone.

### For the newsroom

- **Dashboard:** every front-page story with its status (live, preview, draft, hidden), who can read
  it and who wrote it; hide or show any story; data-source health.
- **Match story editor:** publish the checked AI story, an edited version (with a live fact check) or
  nothing; choose the length and perspective readers get; open a match to everyone; set a cover
  image; preview the real page as a subscriber or a free reader before publishing.
- **AI match posts:** an agent turns new matches from the SportWorld feed into posts in English and
  Finnish with links to trusted publishers. Nothing reaches readers until an editor approves it.
  The newsroom sets how often it runs (5 minutes to 24 hours) or runs it at once.
- **Podcasts:** "Generate podcast" on any match page (English and Finnish in about 15 seconds) and
  a daily schedule of teams and leagues.
- **Comment moderation:** hide, show or delete comments and post with a "VOZ newsroom" badge.
- **The facts behind the AI:** "AI content" tags, the facts each sentence cites, and how each text
  was made.

### Trust built in

- **Checked, not trusted:** a checker in plain code rejects any sentence whose numbers or people are
  not in the facts it cites, any quote, speech or injury, and claims such as "comeback" or "streak"
  without a fact that states them. Text that fails is never shown; a labelled template is used instead.
- **Honest gaps:** when a data plan has no goal details, the page says so instead of inventing them.
- **Clearly labelled:** AI content, simulated demo data and translated headlines each carry a label.
- **No borrowed content:** story text comes only from our data; images are team crests, data
  graphics or the newsroom's own covers.

## Planned

- **Notifications for subscribers** about their teams and matches, firing only when something
  matters (a goal, a result, a big table move, team news).
- **AI stories for every finished match** from a real deep-data feed (today: the full-data demo
  matches and simulated SportWorld matches).
- **Playoff odds** for each team, recalculated after every round.
- **Data-driven vertical videos** of match highlights in numbers.

## Tech stack in brief

- **App:** Nuxt 4 (Vue), one full-stack TypeScript app; API keys stay on the server.
- **Hosting:** Cloudflare Workers (free plan), with Workers KV (cache), D1 (news and posts) and cron
  triggers for the news monitor, the daily podcasts and the newsroom agent.
- **AI:** OpenAI GPT-6 Luna writes stories, headlines, podcast scripts and translations from a
  numbered fact list; a checker verifies every sentence; a text-to-speech model reads the podcasts.
- **Data:** Liiga stats API, football-data.org, GNews and trusted publishers' feeds.

## Run it locally

### 1. Requirements

- **Node.js** 22.22.3+, 24.15.0+ or 26+ (CI uses Node 24). The scripts rely on Node's built-in
  TypeScript support, so older versions will not work.
- npm (comes with Node). No Cloudflare account is needed to run the app locally: KV and D1 are
  simulated on your machine by wrangler.

### 2. Install

```bash
git clone <this repository> voz && cd voz
npm install
```

### 3. Configure

```bash
cp .env.example .env
cp .dev.vars.example .dev.vars   # local Cloudflare bindings (KV, D1) read these too
```

Fill in what you have. **Every key is optional:** the committed snapshots in `data/snapshots/` and
the pre-written demo stories, headlines and podcasts are enough to click through the whole demo.
Keys are read only on the server and never reach the browser.

#### Why each key is needed

| Key | Why VOZ needs it | Without it |
|---|---|---|
| `NUXT_LIIGA_API_KEY` | Live Liiga data: fixtures, results, tables, goal events and per-game stats (shots, faceoffs, penalties) that the hockey stories and comparisons are built from. | Liiga comes from the committed snapshot |
| `NUXT_FOOTBALL_DATA_TOKEN` ([free](https://www.football-data.org/client/register)) | Live football data from football-data.org: fixtures, results, tables and squads for the ten football competitions, and the real fixtures behind the SportWorld simulated matches. Free plan: 10 requests per minute. | Football comes from the committed snapshot |
| `NUXT_GNEWS_API_KEY` ([free](https://gnews.io)) | Finds what other outlets published about a match for "What the press says" (headline, source and link only). Free plan: 100 requests per day. | That card stays empty |
| `NUXT_OPENAI_API_KEY` | The AI itself: writes match stories, headlines and podcast scripts from the fact list, translates other outlets' headlines into Finnish, reads podcasts aloud (text to speech) and powers the newsroom agent. | Pre-written demo texts or labelled templates; no new podcasts or agent posts, press headlines stay untranslated |
| `NUXT_SESSION_SECRET` | Signs the login cookie so nobody can fake a subscriber or newsroom session. Use a long random string anywhere other people can reach the site. | A built-in demo secret is used (fine locally) |

Optional settings: `NUXT_OPENAI_MODEL` (default `gpt-6-luna`), `NUXT_OPENAI_TTS_MODEL` and
`NUXT_PODCAST_VOICE` (podcast voice), and `NUXT_NEWS_AI_PROVIDER` / `NUXT_HF_TOKEN` to use Hugging
Face instead of OpenAI for news summaries. See `.env.example` for all of them.

`NUXT_DATA_MODE` decides where sports data comes from: `auto` (default: live APIs, snapshot when
they fail), `live` (APIs only) or `snapshot` (fully offline, no keys needed).

### 4. Start

```bash
npm run dev    # http://localhost:3000
```

Sign in at `/login` with one of the demo accounts (password `demo`) to see each role:

| Account | What you see |
|---|---|
| `free@demo.com` | Teasers and the VOZ Plus offer |
| `subscription@demo.com` | Full stories, stats, line-ups, podcasts, My teams |
| `newsroom@demo.com` | Everything plus `/newsroom` (dashboard, story editor, agent desk, podcast desk) |

Good places to start: a full-data demo match such as
http://localhost:3000/match/premier-league/2645271, the newsroom at `/newsroom`, the SportWorld
mock API at `/sportworld`, and the data-layer check at `/status`.

### 5. Optional: background jobs, tests and the Workers runtime

```bash
# run the scheduled jobs by hand (dev server running)
curl http://localhost:3000/_nitro/tasks/podcasts:daily     # daily podcasts
curl http://localhost:3000/_nitro/tasks/newsroom:agent     # newsroom agent (AI match posts)

npm test            # checker and parser tests
npm run typecheck   # must pass before committing

npm run snapshot -- --details   # refresh offline data (football takes ~3 min on the free plan)
npm run preview                 # production build in the local Workers runtime (uses .dev.vars)
```

### Troubleshooting

- **Every request returns 500 "Another Nuxt dev server is already running"**: an older dev server
  of this folder is still running (maybe on another port). Stop it, then start again.
- **"Failed to resolve component" in the logs** after adding a component: restart `npm run dev`.
- **Port 3000 is taken:** `npm run dev -- --port 3001`.
- **Football data is slow or missing:** the free football-data plan allows 10 requests per minute;
  use `NUXT_DATA_MODE=auto` or `snapshot` so the snapshot fills the gaps.
- **Local data looks stale or you want a clean start:** local KV and D1 live in `.wrangler/state/`;
  stop the server and delete that folder to reset caches, comments, posts and podcasts.

Every push to `main` deploys to Cloudflare Workers. Setup, deployment, scripts, architecture and the
API: [docs/development.md](docs/development.md). News coverage pipeline (publisher links, source
priorities, background monitoring): [docs/news-coverage.md](docs/news-coverage.md). Rules for AI
coding agents: [CLAUDE.md](CLAUDE.md).
