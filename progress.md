# Progress Log

Track what's done, what's in progress, and decisions made during production. Newest entries go at the top of the log.

## Current status

| Phase | Status | Notes |
|---|---|---|
| 0: Foundations | 🟨 In progress | Live on GitHub Pages, iPhone checked; waiting on pose results; Supabase deferred |
| 1: Track it | 🟨 Nearly done | Tracker, progression, history, gyms shipped in v0.3.0; sync needs backend |
| 2: Plan it | ⬜ Not started | |
| 3: See you | ⬜ Not started | |
| 4: Coach you | ⬜ Not started | |
| 5: Beyond v1 | ⬜ Not started | |

Legend: ⬜ Not started · 🟨 In progress · ✅ Done · ⛔ Blocked

## Now / Next / Blocked

**Now**
- Dogfood v0.3.0: log real workouts on iPhone and collect issues

**Next**
- Phase 2 plan builder (rules engine, no accounts needed)
- Exercise contraindications + limitations in the profile (needed by the plan builder's safety filter)

**Waiting on you**
- Pose speed test results on iPhone (More → Pose speed test → Lite/GPU and Full/GPU → Copy results)
- Android device check (if you have one)
- Decision: backend for sync + rest push notifications (Supabase account?)
- Decision: vision AI provider + API key for the equipment scan (Phase 2)

**Blocked**
-

## Decisions

Record decisions that would be hard to reverse, so the reasoning isn't lost.

| Date | Decision | Why | Alternatives considered |
|---|---|---|---|
| 2026-10-08 | Rules engine decides plans and progression; AI only for perception and explanations | Deterministic, testable, safe | End-to-end LLM planning |
| 2026-10-08 | Pose estimation on-device; raw body media not uploaded by default | Privacy, latency, cost | Server-side video analysis |
| 2026-10-08 | **Accepted:** PWA, with a Capacitor wrap as upgrade path ([ADR-001](decisions/ADR-001-distribution-and-platform.md)) | Only option that fully avoids app stores on iOS | RN/Expo sideload, Flutter sideload, native install over cable via Xcode |
| 2026-10-08 | React + TS + Vite + vite-plugin-pwa ([ADR-002](decisions/ADR-002-ui-framework.md)) | Best ecosystem for MediaPipe, Supabase, Capacitor | Svelte 5, Vue 3 |
| 2026-10-08 | Node via Homebrew; app code in `app/` | Simplest; Homebrew already present | fnm, official installer |
| 2026-10-08 | Public GitHub repo + GitHub Pages ([ADR-003](decisions/ADR-003-hosting-and-repo.md)) | One account, free, stable HTTPS | Private repo + Netlify, Pages with GitHub Pro, Cloudflare tunnel, mkcert |
| 2026-10-08 | *Autonomous:* HashRouter, Dexie, hand-curated exercise DB, Vitest, kg storage ([ADR-004](decisions/ADR-004-phase1-app-structure.md)) | Small and reversible; recommendation taken per the rule | BrowserRouter, raw IndexedDB, free-exercise-db import |

## Log

### 2026-10-08 (Phase 1 "Track it", v0.3.0, built autonomously at the user's request)
- **App structure:** bottom nav (Today / Gym / History / More), HashRouter, an "active workout" banner on every screen, 3-step onboarding (profile → gym equipment → safety disclaimer).
- **Data:** 94 hand-curated exercises (patterns, muscles, cues, equipment requirement groups incl. posture correctives) + 41 equipment items + 5 gym presets + "implies" rules. Dexie DB: gyms, settings, sessions, sets. JSON export and "delete all data".
- **Progression engine:** Epley e1RM with RPE → RIR, per-equipment increments (5 kg lower barbell, 2.5 kg upper, 2 kg DB…), double progression, hold on high RPE, deload −10% after two missed sessions, within-session adjustment, form-gating hook, warm-up ramps, plate calculator. Default targets from goal/intensity/experience; beginners capped at RPE 8.
- **Tracker:** add exercises from what your gym allows, suggestion card with the reason, pre-filled steppers, RPE chips ("How did it feel?" for beginners), one-tap logging, warm-up checklist, extra sets, timestamp-based rest timer (sound + flash; vibration on Android), screen kept awake.
- **History:** workout summaries (duration, sets, volume, PRs, feel rating, next-time suggestions), per-exercise page with an e1RM chart (tap for values) and full history, exercise library for the active gym.
- **Bugs caught before shipping:** the rest-timer cleanup would have cancelled its own auto-clear; a delayed clear could wipe a newly started rest (now conditional on `restEndsAt`); two lint purity warnings fixed.
- **Verified:** 38 unit tests ✅ (now also run in CI before deploy), lint ✅, build ✅, headless Edge E2E at iPhone size in light + dark: onboarding → log 3×10 @ 60 kg → summary → next workout suggests **62.5 kg × 6** → chart + tooltip, 13/13 checks, no console errors. Screenshots reviewed.
- **Not verified:** real-phone feel (rest beep after the screen dims, Wake Lock on iOS), real pose accuracy.

### 2026-10-08 (pose speed test, v0.2.0)
- Decisions (small, reversible, per the CLAUDE.md rule): test MediaPipe **Lite + Full** (skip Heavy and MoveNet); **self-host** models + WASM (offline, no third-party requests). WASM is copied from node_modules at build time (not committed); models are committed (~15 MB).
- Built a **Pose test** tab: model/processor/camera selectors, live skeleton overlay, HUD (fps, ms/frame, delegate, knee angle), 10 s benchmark with median/p95 and a "Copy results" button. GPU → CPU automatic fallback. Pose assets are cached on first use (Workbox CacheFirst `pose-assets`), not at install.
- Verified: lint ✅, build ✅; headless Edge smoke test with a fake camera on this Mac: model loads, **58 fps, 17 ms/frame, GPU**. The fake camera shows no person, so detection accuracy is untested.
- Pending (user): run the benchmark on iPhone (Lite/GPU and Full/GPU, back camera, full body in view) → go/no-go for ADR-001.

### 2026-10-08 (device check on iPhone)
- ✅ v0.1.1 confirmed on iPhone: Offline support ✅, airplane-mode launch works. Only Vibration ⚠️ (expected).
- iPhone result: everything ✅ except **Offline support ⚠️** and **Vibration ⚠️**.
- Vibration: expected, since iOS Safari has no Vibration API (known limit, ADR-001). The rest timer will use sound + screen flash on iPhone.
- Offline support: **false warning**. The check ran before the service worker registered (it registers on window load), and the installed iOS app has no reload button. Fixed in v0.1.1: the check waits for `serviceWorker.ready` and re-runs on `controllerchange`.
- Pending: confirm v0.1.1 on iPhone; Android results.

### 2026-10-08 (GitHub Pages setup)
- Done: installed `gh`; added the Pages deploy workflow; made the Vite `base` configurable (`/gymbro/` on Pages); verified the build under `/gymbro/` (asset paths, manifest scope, service worker scope); `git init` on `main`.
- Fixed: `~/.config` was owned by root (user ran `sudo chown`); the `gh` token needed the `workflow` scope; ran `gh auth setup-git`.
- Repo: https://github.com/imacat1310/gymbro (public; commits use the GitHub noreply email).
- **Live:** https://imacat1310.github.io/gymbro/. First deploy succeeded in about 1m40s; page, manifest, sw.js and icons return 200.
- Follow-up: the Actions run warns that `configure-pages@v5` / `upload-artifact` target Node 20 (deprecated); bump them when new majors are available.
- Pending: device check results on iPhone and Android.

### 2026-10-08 (build: PWA shell)
- Done: installed Node 26 (Homebrew); scaffolded `app/` (React 19, TS, Vite 8, vite-plugin-pwa 2); generated icons; manifest + auto-updating service worker; install hint (iOS Safari instructions / Android install prompt); **device check screen** (HTTPS, installed mode, service worker, camera + live preview, MediaRecorder, WebGL2, Wake Lock, persistent storage, push, vibration).
- Verified: `npm run build` ✅, `npm run lint` ✅, preview serves manifest / sw.js / icons (HTTP 200).
- Not yet verified: on a real phone (needs HTTPS → ADR-003).
- Next: choose an HTTPS serving method, install on phones, record device check results here.

### 2026-10-08
- Added production rules (CLAUDE.md): no-app-store constraint, options with pros and cons for every decision, step-by-step workflow.
- Wrote ADR-001 (distribution & platform) and updated ARCHITECTURE, DATA_MODEL, ROADMAP, session tracker and SAFETY docs for the PWA approach.
- Created the planning docs: README, PRODUCT, ARCHITECTURE, DATA_MODEL, ROADMAP, SAFETY_PRIVACY, and feature specs 01–06.

<!-- Template:
### YYYY-MM-DD
- Done:
- In progress:
- Problems / learnings:
- Next:
-->
