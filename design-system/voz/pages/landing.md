# Landing (front page) — overrides MASTER.md

Editorial news front page, structure modelled on a classic sports-section layout (fixture strip,
big section title, category tabs, lead + side stories, card row, "Latest" list with sidebar).

## Overrides
- **Theme: light "paper"** (`[data-theme="paper"]`, set by `app/layouts/news.vue`). App screens stay dark.
  Contrast on #FFF: ink 18.7, ink-2 10.3, muted 6.2, control border 5.0, `--accent-ink` 6.3.
- Gold `#F5C518` is a **fill only** here (CTA, active-tab underline); never text on white (1.6:1).
- Editorial colours (tokens in `main.css`): headline `--headline` #333 (12.6), hover `--link-hover` #006BA0 (5.9),
  meta `--meta` #767676 (4.5), summary `--summary` #666 (5.7), dividers `--line` #EEE / `--line-strong` #DDD,
  section bar `--section-bar` orange→pink gradient (decoration only).
- Type scale: lead 28/1.29 centred · side 18/1.22 · card 16/1.4 · list 17–18/1.3 · summary 14/1.5 (lead 16/1.56)
  · kicker 11/16 uppercase · section title Inter 700 32 uppercase with 5 px skewed bar · widget title 20/24 with `#`.
- Width: content max 1100 px (`--page-max`); gutters 16 / 30 (≥768) / 50 (≥1280). Header 52 px.
- Spacing: featured block 66 / 34 with 1 px divider, side items 20 px apart; 4-up card row below a 20 px rule;
  50 px between blocks; Latest + 300 px sidebar, 30 px gap; sidebar boxes 24 px padding, 4 px radius.

## Fixture strip (`NewsFixtureTicker`)
- League picker (`NewsLeaguePicker`): button with emblem, "Sport · Country" eyebrow and full league name; opens a
  WAI-ARIA listbox grouped by sport (arrows/Home/End/Enter/Esc, click outside closes). Leagues without an
  official emblem get a gold-on-board monogram (`NewsLeagueBadge`); never borrow a team crest as a league logo.
- Fixture cards link to the match page; kick-off time bold, "Today"/"Tomorrow" in `--accent-ink`.
- Auto-advance one card every 5 s (JS timer). Stops for good when the reader takes over (arrows, drag, swipe,
  wheel, keys); pauses on hover, focus inside and hidden tab; off under `prefers-reduced-motion`.
  No visible pause button or progress line (product decision; hover/focus pause and take-over are the controls).
- Picker labels join only the fields present, so a partial API response never shows "undefined".
- Phones (<640 px): picker row on top, strip below.

## Section tabs
- Never a visible scrollbar. ≥768 px: tabs wrap and centre (8 px side padding up to 1199 px so all fit on one
  row from ~1000 px). Phones: one swipeable row, scrollbar hidden, 32 px fade on the right edge as the hint,
  with matching end padding so the last tab scrolls clear of the fade.
- Never combine `justify-content: center` with an overflowing row: the first items become unreachable.

## Imagery
- No photos. Each story's picture is `NewsMatchVisual`: team crests + score/kick-off on the dark scoreboard
  (`--board`). It is built from the same data as the text, so it cannot show something that did not happen.
- The board carries faint line art of the sport's field (football pitch with mowing stripes, hockey rink with
  red/blue lines), drawn as SVG at real proportions; `--board-line` / `--board-stripe` / `--board-rink-*` tokens.
- Reserve space with `aspect-ratio` (16:9 lead/cards, 4:3 list thumbnails at 33% width); 4 px radius to avoid layout shift.

## Podcasts (`NewsPodcastShelf`, `NewsPodcastPlayer`)
- Section after the 4-up card row: section title, players in a 1 / 2 (≥768) / 3 (≥1024) column grid; hidden when there are no episodes (loaded client-side, never blocks the page).
- Player: 48 px round gold play button (fill only; icon in `--on-accent`), kicker (kind · subject · league · time; newsroom also sees the "AI content" tag), title 17 px bold, native range seek bar (`accent-color: --stat-lead`) with tabular time, "Transcript" disclosure (the cited facts: newsroom only). Only one episode plays at a time; audio loads on first play.

## AI posts (SportWorld)
- Approved newsroom-agent posts are ordinary story cards linking to `/posts/:id`; the kicker adds a
  "Simulated data" tag for every reader (outlined, `--summary`), next to the newsroom-only "AI content" tag.
- `/posts/:id` (720 px column): simulated-data banner first (surface fill, 4 px `--accent` left border, flask
  icon), kicker, 26–36 px headline, byline, match graphic, 18/1.65 body, "Elsewhere on these teams" link list
  (headline + source line, opens in a new tab).

## Content rules
- Every story is generated from data (`server/utils/stories.ts`); the lead carries
  "Written automatically from official match data".
- Front-page order interleaves competitions round-robin so one league cannot take every top slot.
- Sponsored slot sits in the sidebar with a dashed border and "Ad" label.
