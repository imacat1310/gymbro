# Progress Log

Track what's done, what's in progress, and decisions made during production. Newest entries go at the top of the log.

## Current status

| Phase | Status | Notes |
|---|---|---|
| 0: Foundations | 🟨 In progress | Live on GitHub Pages, iPhone checked; pose spike ✅ GO on iPhone; Supabase deferred |
| 1: Track it | 🟨 Nearly done | Tracker, progression, history, gyms shipped in v0.3.0; sync needs backend |
| 2: Plan it | 🟨 In progress | Plan builder (v0.4.0), plan library + editing (v0.6.0); equipment scan waits on AI provider |
| 3: See you | 🟨 In progress | Posture capture (v0.5), InBody (v0.7), posture report (v0.8), trunk rotation test (v0.9); movement tests next |
| 4: Coach you | ⬜ Not started | |
| 5: Beyond v1 | ⬜ Not started | |

Legend: ⬜ Not started · 🟨 In progress · ✅ Done · ⛔ Blocked

## Now / Next / Blocked

**Now**
- Developer review fixes, step 1 done (v0.24.0): data-loss bugs + data safety. Next: committed E2E test of the core loop, versioned pose/OCR caches, iPhone rest beep
- InBody: decide between quick manual entry, keeping OCR, or vision AI (options in the 2026-10-13 log)
- Faster manual gym setup (v0.23.0): gym tour, search, unlock badges. Design.md items all done except the camera scan
- Opt-in AI coach and camera scan parked on the AI-provider decision (ideas.md "Pending decision")

**Next**
- Movement tests, left vs right, then the imbalance engine (features/08)

**Waiting on you**
- Android device check (if you have one)
- Decision: backend for sync + rest push notifications (Supabase account?)
- Decision: vision AI provider + API key for the equipment scan (Phase 2), and whether to add an opt-in AI coach chat (same backend decision, ideas #15)
- A photo of a real InBody sheet (cover name/ID) to test OCR accuracy

**Known gaps**
- InBody trends don't adjust weekly volume yet; movement tests (left vs right under load) don't exist yet.

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
| 2026-10-12 | Faster manual gym setup: guided tour, hints, search, unlock badges ([ADR-021](decisions/ADR-021-faster-manual-gym-setup.md)) | Design.md Gym item while the camera scan waits | Search only; camera scan now |
| 2026-10-12 | Full body report: one derived page for posture, InBody, left/right, trunk test, with scan-to-scan trends and a combined training focus ([ADR-020](decisions/ADR-020-full-body-report.md)) | Design.md Profile item | Separate pages only |
| 2026-10-12 | Posture scan: optional right-side view, both sides averaged, tentative shoulder-depth finding (ADR-009 rev. 1) | User asked whether the right side is needed | Left only |
| 2026-10-12 | Plans have a length (default 8 weeks) or finish early; verdict by training goal from InBody, lifts, adherence and posture scans ([ADR-019](decisions/ADR-019-plan-length-and-report.md)) | Answers Design.md's "goal reached?" | Open-ended plans |
| 2026-10-12 | Goals: lift (e1RM) and body (InBody) targets, derived progress and pace ([ADR-018](decisions/ADR-018-goals.md)) | Fits Design.md; feeds History's "goal reached" | Stored progress |
| 2026-10-12 | Level/XP, rings, stats and badges derived from history, never stored ([ADR-017](decisions/ADR-017-level-stats-badges.md)) | Always consistent, re-tunable | Stored XP ledger |
| 2026-10-12 | Opt-in AI coach parked by the user; full proposal saved in ideas.md | Costs money and sends data off the phone | Build now |
| 2026-10-12 | Coach reasoning adapted from gymcoach (MIT): reason codes + sources, stall/deload signals, one Today insight, coach view; no AI ([ADR-016](decisions/ADR-016-coach-reasoning.md)) | User chose A and gymcoach as the model | LLM chat now (needs backend), on-device LLM |
| 2026-10-12 | Session focus: sport-specific gym days, 6 sports + 4 focuses, curated slots ([ADR-015](decisions/ADR-015-session-focus-sport-days.md)) | User's choice | Playing days (later), both |
| 2026-10-12 | Plan builder v2: body data → pause, correctives, strengthen, weaker side; rebuild prompts ([ADR-014](decisions/ADR-014-plan-builder-v2-body-data.md)) | User asked how the body report relates to the plan; it didn't | Live changes to existing plans |
| 2026-10-11 | Sci-fi HUD theme replaces Bonfire ([ADR-013](decisions/ADR-013-scifi-hud-theme.md)) | User asked for futuristic; chose HUD from three mockups | Cyberpunk neon, sleek glass |
| 2026-10-11 | Bonfire theme (souls + pixel, dark only), self-hosted OFL fonts, Profile tab replaces More ([ADR-012](decisions/ADR-012-bonfire-theme.md)) | User's choice from three mockups | Pure Souls, full pixel |
| 2026-10-11 | Design.md scope: level = character level + weekly activity goal; gym AI scan deferred | User's choices | Activity rings only, AI scan now |
| 2026-10-11 | InBody reader rev. 1: two OCR passes, position-aware parsing, the sheet's arithmetic as a check ([ADR-008](decisions/ADR-008-inbody-scan.md)) | Real 270 sheet: 3/14 with 2 wrong → 12/14 with none wrong | Vision AI (still possible later) |
| 2026-10-11 | App updates: check on resume + every 30 min, "Update" banner, never auto-reload ([ADR-011](decisions/ADR-011-app-updates.md)) | iPhone stayed on v0.5.0; a reload mid-capture would lose work | Auto-reload, browser default |
| 2026-10-11 | Imbalance tests area; trunk rotation via phone scoliometer, referral at ≥ 7° ([ADR-010](decisions/ADR-010-trunk-rotation-test.md)) | Best-evidenced phone screen; no images | Back-photo classifiers (weak, no open weights) |
| 2026-10-11 | Posture metrics computed on the fly from landmarks, tilt-corrected, confidence-gated, with referral rules and muscle focus ([ADR-009](decisions/ADR-009-posture-metrics.md)) | Deterministic, private, improves old scans | Storing findings, LLM review |
| 2026-10-11 | InBody scan: on-device OCR (Tesseract.js, self-hosted) + mandatory review; values only stored ([ADR-008](decisions/ADR-008-inbody-scan.md)) | User's choice; private, offline, free | Manual only, vision AI via backend |
| 2026-10-11 | Plan library + hand editing; rule breaks warn, never block ([ADR-007](decisions/ADR-007-plan-library-and-editing.md)) | User's choice; covers "change" and "different plans" | Library only, edit one plan, block injury conflicts |
| 2026-10-11 | Posture capture: front camera default, auto-capture, Full-model 5-frame median, landmarks only ([ADR-006](decisions/ADR-006-posture-capture.md)) | Works alone, steadier landmarks, no photos stored | Manual tap, self-timer, single frame, keeping photos |
| 2026-10-11 | Pose spike **GO** on iPhone (both models ~30 fps); Lite for live use, Full for stills and post-set analysis | Lite has frame-time headroom; Full is at the 33 ms budget but more accurate | Full everywhere, Heavy model |
| 2026-10-08 | *Autonomous:* plan builder = rules only (LLM later), rotation instead of weekdays, substitution at start ([ADR-005](decisions/ADR-005-plan-builder.md)) | Deterministic, offline, safe; missed days don't break the plan | LLM-written plans, fixed weekdays |
| 2026-10-08 | *Autonomous:* HashRouter, Dexie, hand-curated exercise DB, Vitest, kg storage ([ADR-004](decisions/ADR-004-phase1-app-structure.md)) | Small and reversible; recommendation taken per the rule | BrowserRouter, raw IndexedDB, free-exercise-db import |

## Log

### 2026-10-13 (developer review, step 1: bugs + data safety, v0.24.0)
- **Review:** four parallel reviews (correctness, architecture, PWA/UX/accessibility, security), top findings verified against the code. Baseline was healthy (types, lint, 272 tests, no runtime vulnerabilities); risks were data loss in the workout flow, local-only data safety, and scope ahead of the core loop.
- **Fixed (each verified, most with a test):**
  - double-tap Start created two active workouts → check + add in one transaction
  - Finish while sets were loading offered to delete a workout with sets
  - typed weight could be ignored on iPhone (field only saved on blur) → saves as you type; −/+ clear stale text
  - duplicating a finished plan gave an already-finished copy
  - plan swaps weren't marked as hand edits (lost on auto-rebuild; stale volume/minutes)
  - rebuilding a finished plan reopened it and changed its report goal
  - body goals set before any InBody result could never be reached
- **Data safety:** persistent storage requested at startup (not only on Device check); backup **restore** with validation (refuses non-GymBro or newer-version files; all-or-nothing); backup uses the share sheet on iPhone (download fallback) and warns it holds health data; "Delete all" is one transaction; export/import/reset iterate all tables so they can't drift; app-wide error screen with "Save a backup first".
- **Tests:** new `db/repo.test.ts` against fake-indexeddb (dev-only dependency) + goal tests: 284 tests ✅. Mutation check: undoing the start-session and duplicate fixes makes their tests fail. Lint ✅, build ✅. Browser smoke test 7/7 ✅ (double tap → 1 workout, bad backup rejected, data unchanged, no console errors).
- **Not verified on a real iPhone:** typing a weight then tapping Log; share-sheet backup; persistent-storage grant.

### 2026-10-12 (faster manual gym setup, v0.23.0)
- **Built** (ADR-021):
  - Gym tour (`#/gym/setup`) for new gyms and "Walk through the gym" on existing ones: name + gym type, one area per step with hints and All / None, review with exercise count and "did you miss" suggestions
  - Gym tab list: search (name or hint), "+N" unlock badges on missing items, biggest-unlocks line
  - "+ Add another gym" uses the tour; camera-scan note now says it waits on the AI service decision
- **Verified:** 272 unit tests ✅ (6 new: hints, unlock counts, top unlocks, search); lint ✅; build ✅; E2E 14/14 ✅ (search, badges, tour All/None, save as active gym, re-check, no console errors).

### 2026-10-12 (full body report, v0.22.0)
- **Built** (ADR-020): Profile → Full body report:
  - summary: Balance score, combined training focus with reasons, stretches
  - body composition: latest values, change since the first, 3 trend charts
  - left/right lean mass
  - posture findings vs the previous scan
  - trunk test, referral card, buttons for missing data
- **Fixed:** line-chart axis labels were clipped for values like "74.8 kg" (margin now sized to the labels; also helps exercise charts).
- **Verified:** 266 unit tests ✅ (7 new: missing data, composition change and series, limb gaps into focus, scan trends improved / new / resolved, trunk); lint ✅; build ✅; E2E 9/9 ✅ (all sections from seeded history; empty state; no console errors).

### 2026-10-12 (posture scan: optional right side, v0.21.0)
- **User asked** whether the scan needs the right side. Answer: front and back already compare left and right heights, but the side view sees only its near side. The right side adds sagittal left/right differences and steadier numbers. The user chose to add it.
- **Built** (ADR-009 rev. 1):
  - 4-view capture with Skip on the right side
  - both sides averaged (forward head, rounded shoulders), worse knee for lock-back
  - new tentative "one shoulder further forward" finding (2/3/4 cm convention, always "Possible") feeding correctives
  - report diagram with left and right side figures
  - old scans unchanged, with a note
- **Fixed during work:** forward head would have picked the better side; the new finding showed as definite (now always "Possible", as promised).
- **Verified:** 259 unit tests ✅ (6 new, using a right-side camera projection in the fixture); lint ✅; build ✅; E2E 7/7 ✅ (1/4 → 2/4 Left side; seeded 4-view report: three figures, "Possible: One shoulder further forward (right)", no one-side note, corrective reaches the plan input, no errors). Live capture of a real right side is still untested headless.

### 2026-10-12 (plan length + end-of-plan report, v0.20.0)
- **Built** (ADR-019):
  - plan length chips (4/6/8/12 weeks)
  - "Week n of N", finished banner and "Finish plan now" on the Plan tab
  - training goal saved with the plan
  - History → Plans tab with verdicts
  - plan report: verdict + basis + "Why?", workouts, main-lift e1RM changes, InBody before → after, posture findings, goals reached
  - 5 verdict "Why?" entries
- **Verified:** 253 unit tests ✅ (14 new: window and early finish, every goal's verdict, strength fallback, no-data cases, InBody pairing, posture, goals in window); lint ✅; build ✅; E2E 11/11 ✅ (6-week plan → simulated 7 weeks of training with InBody +0.7 kg muscle and scans 1 → 0 findings → finished banner → "Goal reached" in History → report sections → Why? → Finish plan now → "Not enough data"; no console errors).

### 2026-10-12 (goals, v0.19.0)
- **Built** (ADR-018):
  - Goals page: lift or body goal with an optional deadline; progress start → now → target; pace chip; reached list
  - goals on Today's Status panel
  - "Goal reached" coach insight, "Goal getter" badge, goals in "What your coach sees", 3 new "Why?" entries
  - DB v7 `goals`, in export and Delete all
- **Fixed during testing:** a goal already met when set but exceeded later got the later date; the "goal reached" insight guessed lift vs body from the title (now passes the goal's kind).
- **Verified:** 239 unit tests ✅ (15 new: e1RM targets, reps targets, both directions, dates, pace ahead / on track / behind / missed, insight priority); lint ✅; build ✅; E2E 8/8 ✅ (form → two goals with start values → pace label → bench 95×3 and InBody 14.8% → both reached → Today insight → Goal getter badge → coach view; no console errors).

### 2026-10-12 (Today: level, stats, rings, badges, v0.18.0)
- The opt-in AI coach decision is saved in ideas.md ("Pending decision") at the user's request.
- **Built** (ADR-017): Status panel on Today (level hexagon, XP bar, 2 weekly rings, Strength / Endurance / Power / Consistency / Balance with one "How stats work"), Badges page (15 badges with dates and progress), XP/stat "Why?" entries. Coach insight above the next workout, Status below it.
- **Fixed during testing:** records counted twice for one heavier lift (XP inflated: level 7 after 9 workouts → 6); zero-length rings drew dots; the panel pushed Start below the fold (reordered).
- **Verified:** 224 unit tests ✅ (11 new); lint ✅; build ✅; E2E 9/9 ✅ (level, rings legend, 5 stats incl. Balance 99−20−10 = 69 from body data, badge strip, stat formulas, Badges page unlocks and progress, no console errors).

### 2026-10-12 (coach reasoning, v0.17.0)
- **User:** option A (better explanations, no AI) using gymcoach (MIT) as the reasoning model. Read gymcoach's progression, deload, stall, home-insight and coach-context modules (read only, nothing run) and rewrote the design for GymBro (ADR-016; credited in THIRD_PARTY_NOTICES.md).
- **Built:**
  - 37 reason codes with rule, evidence level and sources; links only where checked (six references verified by search)
  - "Why?" panels on workout suggestions, plan exercises and the coach card
  - stall/deload/record/consistency signals
  - Coach card on Today with a priority selector
  - "What your coach sees" on Profile
- **Fixed during testing:** the main bundle crossed 500 KB (registry and coach card now load on demand: 485 KB); a "Why?" panel inside a paragraph was invalid HTML.
- **Verified:** 213 unit tests ✅ (13 new: stall test, deload, records, week start, insight priority, coach view); lint ✅; build ✅; E2E 6/6 ✅ (deload insight from 2 stalled lifts, Why? with rule/evidence/source, workout and plan Why?, coach view, no console errors).

### 2026-10-12 (session focus / sport days, v0.16.0)
- **User request:** change a plan session for another sport. Options were presented; the user chose sport-specific gym days for court sports, combat/swimming and general focuses (ADR-015).
- **Built:**
  - Focus button on every plan day → sheet with Standard / 6 sports / 4 general focuses
  - curated slot templates (power → movement → strength → injury prevention ordered by risk)
  - 28 new exercises with joint-stress tags
  - focus kept through rebuilds
- **Fixed during testing:** badminton's Achilles work was trimmed for time (now ordered by risk, three prevention slots protected); bodyweight-only gyms got thin power/martial-arts days (fallbacks added); the main bundle crossed 500 KB (body analysis now loads on demand: 487 KB).
- **Verified:** 200 unit tests ✅ (11 new: every listed exercise exists, every focus × every gym preset, knee limitation, safety pause, beginners, determinism); lint ✅; build ✅; E2E 10/10 ✅ (picker, badminton day contents and reasons, rebuild keeps focus, Today offers it, back to Standard, no errors).
- **AI coach research** (user asked about open-source AI fitness coaches, Arvo, Jotform): recorded in ideas #15; needs the backend/AI decision.

### 2026-10-12 (plan builder v2, v0.15.0)
- **Body data now drives the plan** (ADR-014):
  - safety pause on lower-back loading after an unacknowledged referral, in new plans and at workout start
  - corrective block (~8 min per session, rotating options, 2 easy sets, never trimmed or topped up, not counted as hard sets)
  - top-2 muscles to strengthen as protected accessories
  - InBody ≥ 5% lean-mass gap → "start with your weaker side, +1 set"
  - notes and reasons name each source; "Rebuild with my body data" when newer data exists or the pause is lifted
- Also fixed: the volume balancer could top up correctives, and stretches counted as chest volume.
- **Verified:** 189 unit tests ✅ (14 new); lint ✅; build ✅; E2E 14/14 ✅ (plan before body data → 8.2° trunk test → old plan's workout swaps the deadlift → pause card + rebuild prompt → rebuilt plan has no lower-back loading, correctives with reasons, symmetric core work, notes → acknowledge → squats/deadlifts back → new InBody → prompt → weaker left leg named; no console errors).

### 2026-10-11 (sci-fi HUD theme, v0.14.0)
- User asked for a futuristic theme instead of the souls theme; chose "Sci-fi HUD" from three mockups (ADR-013).
- Navy-black with a cyan grid and glow, corner-bracket panels, angled buttons, Orbitron / Exo 2 / Share Tech Mono (self-hosted OFL), segmented glowing gauges, "MISSION COMPLETE" banner with scan sweep.
- **Verified:** 175 unit tests ✅; lint ✅; build ✅; visual tour at iPhone size, no errors; E2E plans 22/22, trunk 15/15, report 20/20.
- **User asked how the body report relates to the plan:** answered honestly that body data doesn't feed the plan yet (only injuries and the priority muscles you pick); recorded as a known gap, plus the unimplemented referral pause.

### 2026-10-11 (design pass step 1: Bonfire theme + Profile, v0.13.0)
- **Design.md** (user): new features per tab plus a retro souls look. Presented the plan and 4 decisions; the user chose the Bonfire + pixel theme, both character level and activity goal, deferring the AI gym scan, and theme first.
- **Theme** (ADR-012):
  - stone/ember/gold, dark only
  - Cinzel / EB Garamond / VT323, self-hosted
  - framed panels with corner studs, ember buttons with pixel shadows, segmented bars, gold diamond title rule
  - "VICTORY ACHIEVED" banner after finishing a workout
- **Profile tab** replaces More (body tools first, with the latest InBody values); `/more/*` redirects to `/profile/*`.
- **Verified:** 175 unit tests ✅; lint ✅; build ✅. Visual tour of 10 screens at iPhone size, no errors. E2E regressions: plans 22/22, trunk 15/15, report 20/20 (tests updated for `/profile` paths and CSS-uppercased headings).

### 2026-10-11 (InBody 270 body figure, v0.12.0)
- The user confirmed the InBody 270 format. Added a close-up read of the grey body figure: crop, enlarge 2×, black and white at 3 cut-offs × 2 modes, then vote (rounded to printed precision; "from photo" needs 2+ agreeing reads and a 3:1 margin; otherwise "check" with the rival as an "or …?" button). Trunk/leg proportion check.
- **User's sheet: 13/14 exact**; trunk flagged "check" with the true value one tap away. 175 unit tests ✅; lint ✅; build ✅.
- Scan time about 15 s on a Mac; to be measured on the phone.

### 2026-10-11 (InBody reader on a real sheet, v0.11.0)
- **Test with the user's real InBody 270 photo** (kept out of the repo: it holds an ID, the gym's details and body data): the old line-based reader got **3/14 right and 2 wrong** (SMM from the impedance table, BMI from a chart tick).
- **Rebuilt the reader** (ADR-008 rev. 1): two OCR passes with one worker; label chaining and same-column, same-row value picking from word boxes; deskew from text-line baselines; chart-tick and range rejection; body-figure and labelled-table segmental reading; arithmetic checks (water + protein + minerals + fat = weight; PBF; BMI from the printed height; SMM vs fat-free mass); statuses from photo / check / calculated.
- **Result:** real 270 sheet **12/14, none wrong**; a 1.5°-tilted 570-style sheet **12/15, none wrong**. Missing values stay empty for the user to type.
- **Verified:** 168 unit tests ✅ (19 new, synthetic layouts only); lint ✅; build ✅; both sheets through the real Body composition screen, no errors.
- **Next for accuracy:** a full-resolution phone photo (the one tested was 1106 px wide); real 570/770 sheets.

### 2026-10-11 (app update fix, v0.10.0)
- **Bug (user):** the iPhone still showed v0.5.0 although v0.6–v0.9 had deployed (GitHub Pages served v0.9.0). The installed app resumes instead of reloading, so it never checked for updates, and nothing switched it over.
- **Fix (ADR-011):** update check on every return to the app and every 30 min; a "New version available · Update" banner; the new version waits for the tap.
- **Verified:** E2E across two real builds 6/6 ✅ (A installed → B deployed → banner on return → A still running → tap → B; banner gone; no errors). Lint, tests, build ✅.
- **Trunk test references** added to ADR-010 (Bunnell 1984; Hresko 2016 joint statement; Beauséjour 2022; Qiao 2014; a 2014 counterpoint). Corrected my earlier overstatement of the 2022 result. Open question: start the re-test band at 4° (Bunnell) instead of 5°.
- **One-time step for phones on ≤ v0.9:** close the app from the app switcher and reopen it, twice.

### 2026-10-11 (imbalance tests + trunk rotation, v0.9.0)
- **Research** (user request: reuse open-source biomechanics scanners): no drop-in project. SMPL/SHAPY-family are non-commercial and heavy; scoliosis photo models have no weights or licence and reach only about 75% clinical accuracy; DigitalScale estimates BMI only; no open data on scapular winging. Worth using: phone scoliometer (well supported), Navy tape formula, free-exercise-db (public domain), our own cited finding → muscle table, MediaPipe segmentation (experimental).
- **User's goal clarified:** per-side imbalance in posing *and* movement → tight/weak muscles → stretches and strengthening, weaker side first. Captured in features/08 and the roadmap.
- **Built:** More → Imbalance tests (posture scan, trunk rotation, history). Trunk rotation: intro → flat-surface calibration → upper back → lower back (live angle, side, peak, reset) → result with grade, referral card at 7° or more, symmetric core advice. DB v6 `assessments`, export v6. Motion permission code shared with the posture scan (`lib/motion.ts`).
- **Verified:** 149 unit tests ✅ (17 new); lint ✅; build ✅. E2E with simulated motion sensor 15/15 ✅: calibration cancels a 1.5° camera bump, 8.0° right / 3.0° left read exactly with **both gravity sign conventions**, referral card, no condition named, saved with offset, no-sensor message.
- **Not verified:** on a real iPhone with a real back.

### 2026-10-11 (posture report, v0.8.0)
- **Posture report** (More → Posture scan → a scan, or straight after saving one):
  - referral card when the rules trigger
  - front and side diagram with severity-coloured markers
  - findings, worst first: what it is, measured value, confidence, "Possible:" when unsure, training response
  - "Focus for your training": muscles to strengthen, ranked; areas to stretch
  - normal-range list, thigh-to-torso proportion, what isn't measured yet, delete
- **Maths** (`lib/posture.ts`, ADR-009): phone tilt corrected; sides from image position; front and back averaged; spec thresholds; confidence from reliability, visibility, steadiness and level data.
- **Bundle:** the main chunk passed 500 KB, so rarely used screens (posture, report, body composition, phone checks) now load on demand: 510 → 459 KB.
- **Verified:** 132 unit tests ✅ (28 new: each metric on a synthetic 175 cm person, tilt correction for both cameras, referral rules, confidence, muscle focus); lint ✅; build ✅. Report E2E light + dark 20/20 ✅.
- **Learned:** the spec's forward-head measure (ear–shoulder angle with C7 thresholds) under-detects; noted in ADR-009 for tuning on real scans.
- **Not verified:** real people on a phone; the tilt-correction direction on a real device.

### 2026-10-11 (InBody body composition, v0.7.0)
- **User request:** scan InBody results into personal info. Options presented; the user chose on-device OCR with manual review (ADR-008).
- **More → Body composition:** Scan InBody sheet (camera or library) → OCR on the phone → review form (15 values; tags "from photo" / "check" / empty) → Save; Enter manually; latest card with change since the previous entry; history with details and delete. DB v5 `bodyComps`, export v5.
- **OCR:** Tesseract.js 7 self-hosted (`public/ocr`, copied at build, service-worker cached on first use, about 7 MB once; install precache unchanged). Photo preprocessing: upright, 2400 px, grayscale, contrast stretch.
- **First E2E run found real OCR patterns:** dropped decimal points ("311kg"), garbled chart ticks that put BMI at 15, "ECWITBW". Fixed: inferred decimals are marked "check", lines with 5+ numbers are read backwards, slash look-alikes accepted. 10/15 with one wrong value → **15/15, none wrong**.
- **Verified:** 104 unit tests ✅ (17 new for the parser); lint ✅; build ✅. E2E with a synthetic InBody-570-style sheet degraded like a phone photo (tilt, blur, dim, grey paper): OCR 2.3 s on this Mac, 15/15 correct, 2 flagged "check", date read, out-of-range edit blocks Save, saved entry has no image, manual entry + change since previous, **no third-party requests**, no console errors (11/11).
- **Not verified:** real InBody sheets and real phone photos (glare, curl, other models and languages); OCR speed on iPhone.

### 2026-10-11 (plan library + editing, v0.6.0)
- **User request:** change plans and keep several. Options were presented; the user chose a library with full editing, with rule breaks warned rather than blocked (ADR-007).
- **Plan tab:** Plans sheet (switch, + New plan), new plan = "Build it for me" or "Start empty", Manage plan (edit, change preferences and rebuild in place, duplicate, delete). Editor: plan name, day name / move / delete, exercise add (picker filtered by the plan's gym) / move / remove, steppers for sets, reps and rest. Today shows the plan's name.
- **Plan check:** injury conflicts in red on the exercise (always); exercises the gym can't do (info); on edited plans: empty day, too long, under or over volume, push > pull.
- **DB v4 migration:** invisible leftover copies from earlier rebuilds are removed unless workouts used them (kept as "(earlier)"); plans get a name, schedule and priorities.
- **Verified:** 87 unit tests ✅ (12 new: edits + checks); lint ✅; build ✅. E2E (headless Edge, phone size) 22/22 ✅: v3→v4 migration (4 checks), build named plan, editor add / sets / remove / reorder / rename, red injury warning, duplicate, Plans sheet, empty plan + empty-day warning, switch, Today label, rebuild in place, delete fallback, no console errors.
- **InBody scan request** logged (ideas #12); it needs a decision (health data) before building.

### 2026-10-11 (Phase 3 posture capture, v0.5.0)
- **More → Posture scan (beta):** intro (setup tips, privacy note, height, camera, spoken guidance) → front, side, back. A live Lite skeleton drives an 8-item checklist: body found, phone level (motion sensor), light, turned correctly, head to feet in view, distance, centred, arms down. The top fix is shown and spoken. Everything passes + still → 3 s beep countdown → 5 frames through Full → median landmarks → review (Retake / Next) → saved.
- **Stored:** landmarks only (DB v3 `postureScans`, export v3, included in Delete all). Photos stay in memory and are dropped after review.
- **Bug caught in E2E:** a check right at its threshold (hand resting at hip height) flickered and restarted the countdown endlessly. Added a 0.5 s grace period, and capture only fires on a passing frame.
- **Verified:** 75 unit tests ✅ (23 new for capture guidance); lint ✅; build ✅. Headless Edge E2E with a fake camera showing 1900s studio photos: checklist, fix hints, tilt hint, countdown, Full-model capture in ~4.5 s (5/5 frames, steady), review, retake, side-view turn hint, no console errors (12/13). Storage: save/export/delete/reset in real IndexedDB ✅.
- **Not verified:** a full side-view capture (no usable public-domain profile photo; the detector found no body in those tried), a real person on a phone, spoken cues on iOS, motion permission on iOS.

### 2026-10-11 (pose speed test on iPhone: GO)
- iPhone, iOS 26 Safari (installed PWA), back camera 480×640, GPU delegate:
  - **Lite:** 30.1 fps, median 27 ms, p95 28 ms, pose found 100%, visibility 0.90, load 252 ms
  - **Full:** 30 fps, median 31 ms, p95 34 ms, pose found 100%, visibility 0.93, load 2454 ms
- 30 fps is the camera's frame rate, so both models keep up with it. Far above the ADR-001 revisit line (15 fps): **the PWA approach is confirmed**.
- Full sits at the 33 ms per-frame budget (p95 34 ms), so it will drop frames under load. Lite has ~6 ms headroom.
- Model choice (small, reversible): **Lite** for live use (capture guidance, rep counting, live cues); **Full** for posture-scan stills and post-set form analysis, where speed doesn't matter and accuracy does.
- Not tested yet: long sessions (heat throttling, the benchmark runs 10 s), an older or Android phone.

### 2026-10-08 (Phase 2 plan builder, v0.4.0, autonomous)
- **Planner** (`lib/planner.ts`, ADR-005): split table, 10 day templates, deterministic scoring, priority muscles, pattern fallbacks, push/pull balancer, session-length fitting, weekly volume floors/ceilings with set reallocation, conservative contraindications (`data/stress.ts`), gym substitution.
- **Coach review of generated plans caught 6 problems the tests didn't:** band-assisted pull-ups as an intermediate's main lift, bodyweight calf raise beating the machine, the only row dropped in a 45-min plan, a full-body day with no pulling, an over-strong variety penalty, chest at 6 sets/week. All fixed and re-checked; chest now reaches the floor where time allows, and the notes say when it can't.
- **UI:** Plan tab (setup: days, minutes, up to 3 priority muscles, injuries → plan with reasons, swap alternatives, weekly sets per muscle, notes), Today shows the next plan day with one-tap start (exercises pre-filled with targets), rotation after each finished plan workout, DB v2 (`plans` table; export includes plans).
- **Verified:** 52 unit tests ✅ (planner: determinism, gym-feasibility for all presets, contraindications, time fit, main lifts kept, priority volume, push ≤ pull for 2–6 days, beginner RPE cap, excludes, alternatives, substitution); lint ✅; build ✅; E2E plan flow light + dark 12/12 ✅; Phase 1 E2E regression 13/13 ✅.

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
