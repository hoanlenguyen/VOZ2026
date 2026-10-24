# VOZ – My Sports World

AI-powered, personalised multi-sport news, built for the Kaleva Media hackathon
**"Beyond the Scoreboard – Reinventing local sports coverage with AI"**.

VOZ turns official match data into news people want to read and hear: match stories, headlines and
short podcasts, in English and Finnish, for ice hockey and football. The rule behind every feature:
**write only from verified facts**. Every number and name an AI writes is checked against the match
data before a reader sees it, and nothing is published that the data does not support.

**Live site:** https://voz.lenguyenhanhoan.workers.dev · demo accounts (password `demo`):
`free@demo.com`, `subscription@demo.com`, `newsroom@demo.com`

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
- **Discussion:** comment totals and likes are public, with a preview of the newest comments.

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
- **Hosting:** Cloudflare Workers, with Workers KV (cache), D1 (news and posts), Queues and cron
  triggers for the daily podcasts and the newsroom agent.
- **AI:** OpenAI GPT-6 Luna writes stories, headlines, podcast scripts and translations from a
  numbered fact list; a checker verifies every sentence; a text-to-speech model reads the podcasts.
- **Data:** Liiga stats API, football-data.org, GNews and trusted publishers' feeds.

## Run it

```bash
npm install
cp .env.example .env   # add the API keys
npm run dev            # http://localhost:3000
```

Every push to `main` deploys to Cloudflare Workers. Setup, deployment, scripts, architecture and the
API: [docs/development.md](docs/development.md). News coverage pipeline (publisher links, source
priorities, background monitoring): [docs/news-coverage.md](docs/news-coverage.md). Rules for AI
coding agents: [CLAUDE.md](CLAUDE.md).
