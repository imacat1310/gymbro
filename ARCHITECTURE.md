# Architecture

## Guiding principles
1. **On-device first for body data.** Pose estimation runs on the phone. Raw body photos and videos stay local unless the user opts in.
2. **Deterministic core, AI at the edges.** Exercise mapping, plan structure and progression math are rule-based and testable. LLMs handle perception (recognising equipment) and language (explanations, coaching cues).
3. **Offline-capable sessions.** You can log a workout with no gym Wi-Fi; data syncs later.
4. **No app store.** The app must run on phones without App Store or Google Play publishing. See [ADR-001](decisions/ADR-001-distribution-and-platform.md).

## Tech stack (proposed: PWA, see ADR-001)

| Layer | Choice | Why |
|---|---|---|
| App type | **Progressive Web App**, installed with "Add to Home Screen" | No store or signing needed; one codebase for iOS and Android |
| UI | React + TypeScript + Vite, `vite-plugin-pwa` | Large ecosystem, fast builds, service worker + manifest |
| Camera / video | `getUserMedia` + `MediaRecorder` | Native browser APIs, supported on iOS Safari and Android Chrome |
| Pose estimation | **`@mediapipe/tasks-vision` Pose Landmarker** (33 landmarks, GPU delegate) | Runs on the phone in the browser in real time; free |
| Local DB | IndexedDB via Dexie.js + `navigator.storage.persist()` | Offline sessions, sync |
| Screen / alerts | Wake Lock API + Web Push (VAPID) | Keeps the screen on during workouts; rest-end notification |
| Hosting | **GitHub Pages** (public repo, auto-deploy via Actions, [ADR-003](decisions/ADR-003-hosting-and-repo.md)) | Free, HTTPS (required for camera), stable address |
| Upgrade path | Capacitor wrapper (sideloaded) | Only if native-only features become necessary |
| Backend | **Supabase** (Postgres + Auth + Storage + Edge Functions) or Firebase | Fast to build, row-level security |
| Vision/LLM API | A multimodal LLM, e.g. Claude (`claude-sonnet-5-5`) | Equipment recognition from photos, posture second opinion, plan explanations, coaching text |
| Exercise DB | Seed from open datasets (e.g. `free-exercise-db`, wger), then curate | Saves building 800+ exercises by hand |
| Analytics | PostHog | Funnels, feature flags |

## System components

```
┌──────────────── Web App (PWA, on the phone) ──────────────┐
│  UI ─ Onboarding ─ Scanner ─ Plan ─ Session ─ History      │
│                                                            │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ Pose Engine │ │ Rep Counter  │ │ Form Rules Engine    │ │
│  │ (MediaPipe) │→│ (angle FSM)  │→│ (per-exercise checks)│ │
│  └─────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────────────┐  ┌────────────────────────────┐  │
│  │ Progression Engine   │  │ IndexedDB + Sync Queue     │  │
│  └──────────────────────┘  └────────────────────────────┘  │
└──────────────────────────────┬─────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼─────────────────────────────┐
│ Backend (Supabase)                                         │
│  Auth │ Postgres │ Storage (opt-in media) │ Edge Functions │
│                                                            │
│  Edge Functions:                                           │
│   • /equipment/recognize   → Vision LLM → equipment JSON   │
│   • /posture/analyze       → landmark metrics (+LLM text)  │
│   • /plan/generate         → rules engine + LLM rationale  │
│   • /form/feedback         → metrics → coaching text       │
│   • /progression/recompute → nightly plan adjustments      │
└────────────────────────────────────────────────────────────┘
```

## AI/ML pipeline summary

| Feature | Input | Model | Output |
|---|---|---|---|
| Equipment scan | Photos / short video frames | Vision LLM with structured JSON output, constrained to an equipment taxonomy | `[{equipment_id, confidence, attributes}]` |
| Exercise mapping | Equipment list | **Deterministic** lookup: exercise ↔ required equipment | Performable exercise set |
| Posture scan | 3 photos | MediaPipe landmarks → geometric metrics; optional LLM review | Findings with severity + confidence |
| Plan builder | Exercises, findings, goal, intensity | **Rules engine** (templates + constraint solver); LLM writes the explanations | Mesocycle plan |
| Form check | Set video | MediaPipe per frame → angles, bar path, tempo → rule checks; LLM turns them into cues | Faults, form score, cues |
| Rep counting | Pose stream | Joint-angle state machine per exercise | Rep count, tempo per rep |
| Progression | Set logs (weight, reps, RPE) | e1RM + double progression / RPE autoregulation | Next weight, deload flags |

## Why not end-to-end LLM for everything?
- **Latency and cost:** form analysis needs about 30 fps. Sending video frames to an LLM is too slow and too expensive.
- **Reliability:** progression math must be reproducible and easy to explain.
- **Safety:** rule-based guardrails (e.g. never prescribe spinal loading for users who flagged a back injury) must be hard constraints, not prompts.

## Security
- Row-level security on all user tables.
- Media in private buckets, signed URLs only, auto-delete policy (see [SAFETY_PRIVACY.md](SAFETY_PRIVACY.md)).
- LLM calls go only through Edge Functions; API keys never ship in the app.
