# Progress Log

Track what's done, what's in progress, and decisions made during production. Newest entries go at the top of the log.

## Current status

| Phase | Status | Notes |
|---|---|---|
| 0: Foundations | 🟨 In progress | PWA shell built; next: HTTPS + install on phones |
| 1: Track it | ⬜ Not started | |
| 2: Plan it | ⬜ Not started | |
| 3: See you | ⬜ Not started | |
| 4: Coach you | ⬜ Not started | |
| 5: Beyond v1 | ⬜ Not started | |

Legend: ⬜ Not started · 🟨 In progress · ✅ Done · ⛔ Blocked

## Now / Next / Blocked

**Now**
- Push to GitHub, enable Pages, first deploy

**Next**
- Install on iPhone + Android, run the device check
- Spike: MediaPipe pose fps in the phone browser
- Start the exercise and equipment database

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

## Log

### 2026-10-08 (GitHub Pages setup)
- Done: installed `gh`; added the Pages deploy workflow; made the Vite `base` configurable (`/gymbro/` on Pages); verified the build under `/gymbro/` (asset paths, manifest scope, service worker scope); `git init` on `main`.
- Pending: `gh auth login` (user), create repo, push, enable Pages, then test on phones.

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
