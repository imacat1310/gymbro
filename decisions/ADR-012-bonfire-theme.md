# ADR-012: Bonfire theme (retro souls look) and Profile tab

- **Date:** 2026-10-11
- **Status:** Visual design superseded by [ADR-013](ADR-013-scifi-hud-theme.md) (sci-fi HUD), same day. The Profile tab and dark-only decision still stand.
- **Roadmap item:** Design pass (Design.md), step 1

## Context
Design.md asks for new features on every tab and a "more robust, retro souls-game" look. The user chose between three directions:
- Bonfire + pixel ✅
- pure Souls
- full 16-bit pixel

## Options
| | A: Bonfire + pixel | B: Pure Souls | C: Full pixel |
|---|---|---|---|
| What | Dark-fantasy stone/ember/gold, gothic serif titles, plus pixel numerals, segmented gauges and souls banners | Same mood, no pixel elements | Pixel font and 8-bit panels everywhere |
| Pros | Strong identity; long text stays readable | Most elegant | Most playful |
| Cons | Two type voices to balance | Less "retro" | Poor readability for reports and notes |
| Works without app store? | ✅ | ✅ | ✅ |
| Effort / cost | M, free | M, free | M, free |

## Decision
**A.**
- **Palette (dark only):** stone `#0e0c0a`, parchment text `#e8dcc4`, ember accent `#e8742a`, gold frames `#c9a24a`, moss/gold/ember/blood for severities. The bonfire glow is a radial gradient at the foot of the screen.
- **Type:** Cinzel (titles, buttons, nav), EB Garamond (body, 17 px), VT323 (numbers: timers, stats, angles). All OFL, **self-hosted** via @fontsource, Latin subsets only (about 15 KB per weight), precached for offline use. No third-party requests.
- **Components:** framed panels (inner gold rule plus corner studs), ember buttons with a hard 3 px pixel shadow, segmented "stamina" bars, a gold diamond rule under page titles, and a "VICTORY ACHIEVED" banner after a workout (honours reduced motion).
- **Profile tab** replaces More: body tools first (body composition with the latest values, posture scan, imbalance tests), then training profile, phone checks, data, about. Old `/more/*` links redirect to `/profile/*`.
- Implemented as `src/theme.css` layered over the existing styles plus new tokens in `index.css`, so screens didn't need rewriting.

## Consequences
- The light theme is gone (the user asked for dark only); `color-scheme: dark`.
- The install download grows from about 692 to 831 KB (fonts).
- Headings are uppercased with CSS: text in the DOM keeps its normal case (screen readers and E2E selectors are unaffected; `innerText` returns uppercase).
