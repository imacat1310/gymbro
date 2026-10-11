# ADR-013: Sci-fi HUD theme (replaces the Bonfire theme)

- **Date:** 2026-10-11
- **Status:** Accepted (user asked for a futuristic theme and chose "Sci-fi HUD" from three mockups). Supersedes [ADR-012](ADR-012-bonfire-theme.md)'s visual design; the Profile tab from ADR-012 stays.
- **Roadmap item:** Design pass (Design.md), step 1

## Options
| | A: Sci-fi HUD | B: Cyberpunk neon | C: Sleek glass |
|---|---|---|---|
| What | Starship display: navy-black, cyan glow, corner brackets, monospace readouts, grid | Night-city neon: magenta/yellow/cyan, glitch accents | Frosted-glass cards, violet glow, rounded and minimal |
| Pros | Readable; suits stats, scans and body reports | Energetic | Calm, premium |
| Cons | Cyan-heavy; warnings need other hues | Tiring to read; contrast issues | Blur is costly on older phones; less "futuristic" |
| Works without app store? | ✅ | ✅ | ✅ |
| Effort / cost | S (re-skin), free | S, free | S, free |

## Decision
**A.**
- **Palette (dark only):** `#05080f` navy-black, `#22d3ee` cyan accent/frames, icy text `#d8f1fb`. Severities stay distinct from the accent (green / yellow / orange / rose).
- **Type:** Orbitron (titles, buttons, nav), Exo 2 (body), Share Tech Mono (numbers). OFL, self-hosted, Latin only, precached.
- **Components:** panels with cyan corner brackets and a top light strip; angled (clipped) buttons; a ◢ marker and tick rail under titles; segmented glowing gauges; a 32 px grid background; a "MISSION COMPLETE" banner with a scan-line sweep after workouts (honours reduced motion).
- Same structure as ADR-012: tokens in `index.css`, skin in `theme.css`; screens unchanged.

## Consequences
- Install download about 796 KB (fonts swapped; slightly smaller than the Bonfire theme).
- Switching the theme again is a small change to `index.css` and `theme.css` only.
