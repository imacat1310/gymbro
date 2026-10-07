# ADR-004: Phase 1 App Structure (routing, local data, exercise DB, tests)

- **Date:** 2026-10-08
- **Status:** Accepted. Made autonomously under the CLAUDE.md rule (small, reversible choices; the recommendation was taken). The user can override at the recap.
- **Roadmap item:** Phase 1: Track it

## 1. Routing
| | React Router (HashRouter) | React Router (BrowserRouter) | Hand-rolled tab state |
|---|---|---|---|
| Pros | Standard; deep links work on GitHub Pages without server config | Clean URLs | Zero deps |
| Cons | `#/` in URLs | GitHub Pages returns 404 on refresh of deep links (needs a 404.html hack) | Doesn't scale past a few screens; no back button |
| Works without app store | ✅ | ✅ | ✅ |

**Chosen:** React Router with **HashRouter**. Reliable on static hosting, and URLs are invisible in an installed PWA anyway.

## 2. Local data
| | Dexie (IndexedDB) + `useLiveQuery` | Raw IndexedDB | localStorage |
|---|---|---|---|
| Pros | Typed tables, indexes, migrations, reactive queries | No dependency | Simple |
| Cons | ~30 KB gzip | Verbose, error-prone | 5 MB cap, sync, no indexes, can be evicted |

**Chosen:** **Dexie** (already named in ARCHITECTURE). All data stays on the phone. Sync to a backend comes later (Supabase needs an account, so that decision is deferred to the user).

## 3. Exercise database
| | Import `free-exercise-db` (800+, public domain) | Hand-curated core list | Hybrid |
|---|---|---|---|
| Pros | Large, has images | Matches our equipment taxonomy, requirement groups, movement patterns, cues | Quality now, breadth later |
| Cons | Coarse equipment tags ("machine", "cable") don't map to our taxonomy; noisy | Smaller (~75 exercises) | Two sources to reconcile later |

**Chosen:** **Hybrid.** Hand-curated ~75 core exercises now (`app/src/data/exercises.ts`) covering every movement pattern plus posture correctives. Import images and extra exercises later.

Equipment "implies" rules make matching realistic: e.g. an adjustable bench counts as a flat bench, a power rack counts as squat stands, and a functional trainer counts as a cable station plus a crossover.

## 4. Tests
**Chosen:** **Vitest** for pure logic (progression engine, equipment → exercise mapping), run in CI before build. Same config as Vite, zero setup.

## 5. Units
**Chosen:** store everything in **kg**; display in kg for now. Pounds support is in ideas.md (it's a display-layer change because storage is kg).

## Deferred to the user (need accounts, money, or privacy choices)
- Backend / sync (Supabase account)
- Rest-end push notifications when locked (needs a backend to send Web Push)
- Vision AI provider + API key for the equipment scan (Phase 2)
