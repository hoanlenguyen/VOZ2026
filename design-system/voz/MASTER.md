# VOZ – Design System (Master)

Global source of truth for VOZ UI. When building a page, check `design-system/voz/pages/<page>.md`
first; rules there override this file. Tokens live in `app/assets/css/main.css` — components use
the CSS variables, never raw hex.

Generated with the **ui-ux-pro-max** skill (`--design-system --persist -p VOZ`), then reconciled with
the approved design canvas (https://claude.ai/artifact/A1nRicxGkCjpDDK4VZbfE5). The skill's generic
"news" palette (light red) and serif fonts were rejected in favour of the canvas look; its style,
rules and checklist were kept.

## Style
- **Dark Mode (OLED)**, dark only for the hackathon. Content-first sports media, scoreboard energy.
- One accent (gold) for the user's team and primary actions; blue marks the opponent.
- Flat surfaces, no gradients, glows or glassmorphism. Depth comes from surface steps, not shadows.

## Colour tokens (contrast measured against `--bg` / `--surface`)
| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--bg` | #0E0F11 | page background | — |
| `--surface` | #17191C | cards | — |
| `--surface-2` | #202329 | nested tiles | — |
| `--text` | #F2F2F0 | primary text | 17.1 / 15.7 |
| `--text-3` | #C9CCD2 | secondary text | 11.9 / 11.0 |
| `--muted` | #A3A6AD | labels, meta | 7.9 / 7.2 |
| `--dim` | #6B7079 | large text, decoration only | 3.9 / 3.5 |
| `--accent` | #F5C518 | my team, primary CTA, focus ring | 11.8 / 10.8 |
| `--on-accent` | #0E0F11 | text on gold | 11.8 |
| `--away` | #6EA8FE | opponent | 7.9 / 7.3 |
| `--line` / `--line-soft` | #2A2E35 / #22252A | dividers (decorative) | — |
| `--border` | #3A3F47 | decorative card outlines only | 1.7 ✗ for controls |
| `--border-control` | #6B7079 | input / outline-button borders | 3.5 ✓ (WCAG 1.4.11) |

Team colour is never the only signal: goals also carry the team name or abbreviation.

## Typography
- Display: **Barlow Condensed** 500–700 — scores, team codes, big numbers, screen titles.
- Body: **Inter** 400–600.
- Scale (px): 11 · 12 · 13 · 14 · 15 · 17 · 22 · 26 · 34 · 44 · 72. Body 15 px, line-height 1.45–1.6.
- Form inputs are 16 px (prevents iOS zoom).
- Scores, clocks and stat columns use `font-variant-numeric: tabular-nums`.
- Eyebrow labels: 12 px, 600, uppercase, 0.06em tracking, `--muted`.

## Spacing, radius, layers
- 4/8 rhythm: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48. Card padding 20, page gutter 16.
- Radius: 8 (chips, tiles) · 12 (buttons) · 16 (cards) · 999 (pills).
- z-index: 0 content · 10 sticky header · 20 bottom nav · 40 sheet · 100 toast.
- App column max-width 480 px, centred on desktop; `min-height: 100dvh`; respect safe-area insets.

## Interaction
- Touch targets ≥ 44×44 px, ≥ 8 px apart. One primary (gold) CTA per screen.
- Press feedback within 100 ms (opacity / background change, no layout shift).
- Motion 150–250 ms ease-out (enter), ~70 % of that for exit; only transform/opacity.
- `prefers-reduced-motion`: disable non-essential motion.
- Loading > 300 ms: skeletons sized like the final content (no CLS).
- Offline / snapshot data: show a visible "Offline data" badge, never silently stale.

## Icons
- Inline SVG, stroke 2 px, round caps/joins (Lucide style), 14/16/20/22 px. No emoji as icons.
- Icon-only buttons need `aria-label`.

## AI & trust UI (product-specific)
- Every AI-written block carries the **"AI · verified from Liiga data"** badge, which opens the facts behind it.
- Text that failed validation is never shown; the block falls back to the deterministic template.
- Sponsored slots use a dashed border and an "Ad" eyebrow label, visually distinct from editorial.

## Anti-patterns
- Gradients, neon glows, glass blur as decoration; emoji icons.
- Grey-on-grey text below 4.5:1 for body copy; `--dim` for body text.
- Hover-only interactions; horizontal page scroll (horizontal story rail is the single exception).
- Raw hex in components.

## Pre-delivery checklist
- [ ] Tokens only, no raw hex in components
- [ ] Text ≥ 4.5:1, control borders ≥ 3:1, visible focus ring
- [ ] Touch targets ≥ 44 px, labels on all inputs, aria-labels on icon buttons
- [ ] Tabular numbers for scores/stats
- [ ] Reduced-motion respected; no layout shift on load
- [ ] Checked at 375 px and 1440 px; safe areas respected
