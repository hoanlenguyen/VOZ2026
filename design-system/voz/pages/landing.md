# Landing (front page) — overrides MASTER.md

Editorial news front page, structure modelled on a classic sports-section layout (fixture strip,
big section title, category tabs, lead + side stories, card row, "Latest" list with sidebar).

## Overrides
- **Theme: light "paper"** (`[data-theme="paper"]`, set by `app/layouts/news.vue`). App screens stay dark.
  Contrast on #FFF: ink 18.7, ink-2 10.3, muted 6.2, control border 5.0, `--accent-ink` 6.3.
- Gold `#F5C518` is a **fill only** here (CTA, active-tab underline, section bar); never text on white (1.6:1).
- Headlines: Inter 700, -0.01em; section titles and scores: Barlow Condensed 700 uppercase.
- Width: content max 1200 px, 16 px gutters; grid 2fr/1fr from 1024 px.

## Imagery
- No photos. Each story's picture is `NewsMatchVisual`: team crests + score/kick-off on the dark scoreboard
  (`--board`). It is built from the same data as the text, so it cannot show something that did not happen.
- Reserve space with `aspect-ratio` (16:9 lead/cards, 4:3 list thumbnails) to avoid layout shift.

## Content rules
- Every story is generated from data (`server/utils/stories.ts`); the lead carries
  "Written automatically from official match data".
- Front-page order interleaves competitions round-robin so one league cannot take every top slot.
- Sponsored slot sits in the sidebar with a dashed border and "Ad" label.
