# ADR-011: How the installed app picks up new versions

- **Date:** 2026-10-11
- **Status:** Accepted (small and reversible; prompted by a bug report)
- **Roadmap item:** Infra (ADR-001 PWA distribution)

## Context
The user's iPhone still ran v0.5.0 after v0.6–0.9 had deployed. Two causes:
- **No update check:** an installed iOS web app usually *resumes* rather than reloading, so the browser never re-checked `sw.js`.
- **No switch-over:** even when an update installed (auto-update mode, skipWaiting), nothing reloaded the open app onto it.

This is a core cost of the no-app-store approach: updates only arrive if the app asks for them.

## Options
| | A: Auto-reload | B: Check on resume + "Update" banner | C: Leave it to the browser |
|---|---|---|---|
| What | Check often; reload as soon as a new version is ready | Check on resume and every 30 min; a banner offers the update | Default behaviour |
| Pros | Always current | Current within minutes; never interrupts | No work |
| Cons | Can wipe a posture capture or trunk test in progress | One tap needed | Stuck for days or weeks on iOS |
| Works without app store? | ✅ | ✅ | ⚠️ |
| Effort | S | S | – |

## Decision
**B.** vite-plugin-pwa runs in `prompt` mode with registration done in `components/UpdateBanner.tsx`. It calls `registration.update()` on every return to the foreground and every 30 minutes (when online). A waiting version activates only on tap (a `SKIP_WAITING` message, then reload). Workout state survives a reload (IndexedDB, timestamp-based rest timer).

## Consequences
- **One-time transition:** phones on ≤ v0.9 run the old auto-update service worker and have no banner. They need the app closed and reopened (twice) once; from v0.10 on, the banner handles it.
- Verified end to end: version A installed → B deployed → banner on return → A keeps running → tap → B.
