# Roadmap

Build order follows dependencies: tracker data feeds progression, the exercise DB feeds everything, and pose infrastructure is shared by the posture scan and form check.

**Constraint:** runs on smartphones without App Store / Google Play. Production follows the rules in [CLAUDE.md](CLAUDE.md): explain the options with pros and cons at each decision, and work one step at a time.

## Phase 0: Foundations (weeks 1–3)
- [x] Confirm platform ([ADR-001](decisions/ADR-001-distribution-and-platform.md): PWA accepted)
- [x] Choose UI framework ([ADR-002](decisions/ADR-002-ui-framework.md): React + TS + Vite); scaffold PWA shell with device check screen
- [x] Serve over HTTPS ([ADR-003](decisions/ADR-003-hosting-and-repo.md): GitHub Pages) and install on a real iPhone (✅ device check passed). Android still to test
- [x] Spike: MediaPipe pose in the browser on target phones (measure fps), the go/no-go check for the PWA approach. *✅ GO: iPhone runs Lite and Full at ~30 fps (GPU). Android still to test.*
- [ ] Supabase project: auth (Apple, Google, email), RLS policies. *Deferred: needs the user's account (see progress.md → Waiting on you)*
- [~] **Exercise and equipment database**: ✅ hand-curated 94 exercises + 41 equipment items + 5 gym presets ([ADR-004](decisions/ADR-004-phase1-app-structure.md)). To do: contraindications, import extra exercises/images
- [x] Design system and core navigation (Today / Gym / History / More; light + dark)
- [~] Legal: ✅ in-app disclaimer at onboarding + About. To do: privacy policy draft ([SAFETY_PRIVACY.md](SAFETY_PRIVACY.md))

## Phase 1: Track it (weeks 4–6) → *usable app*
- [x] Session tracker: workout timer, auto rest timer (sound + screen flash, keeps the screen awake), set logging (weight/reps/RPE), warm-up sets, plate calculator
- [~] Offline storage (IndexedDB) ✅ + JSON export ✅. Sync deferred (needs backend)
- [x] History, PRs, e1RM charts per exercise
- [x] Progression engine v1 (double progression, RPE gating, deload after 2 misses, within-session adjustment): 38 unit tests
- [x] Manual equipment selection + gym presets + multiple gyms
- **Milestone:** internal dogfooding; the team logs real workouts

## Phase 2: Plan it (weeks 7–10)
- [ ] Equipment scan: camera flow → Edge Function → vision LLM → review screen. *Waiting on you: AI provider + backend*
- [x] Exercise mapping (equipment → performable exercises): deterministic, unit-tested (done early in Phase 1)
- [x] Plan builder v1: splits, volume landmarks, intensity mapping, exercise selection, substitutions, limitations, priority muscles, push/pull balance, session-length fit ([ADR-005](decisions/ADR-005-plan-builder.md)); Plan tab with swaps and day rotation
- [x] Plan library + hand editing: several named plans, switch / duplicate / delete, edit exercises and days, rule warnings ([ADR-007](decisions/ADR-007-plan-library-and-editing.md))
- [~] Plan rationale: ✅ templated reasons per exercise. LLM wording deferred (needs AI provider decision)
- **Milestone:** closed beta (~50 users)

## Design pass (Design.md, 2026-10-11)
User decisions: Bonfire + pixel theme, dark only; "active level" = character level + weekly activity goal; gym AI scan deferred (manual picking improved instead); theme first.
- [x] Theme + Profile tab replaces More: souls theme ([ADR-012](decisions/ADR-012-bonfire-theme.md)), replaced by the sci-fi HUD theme ([ADR-013](decisions/ADR-013-scifi-hud-theme.md))
- [x] Today: level, stats, weekly activity rings and badges ([ADR-017](decisions/ADR-017-level-stats-badges.md)); lift and body goals ([ADR-018](decisions/ADR-018-goals.md))
- [x] Plan: choose a goal per workout day ([ADR-015](decisions/ADR-015-session-focus-sport-days.md): 6 sports + 4 focuses); references behind the plan: "Why?" panels with sources ([ADR-016](decisions/ADR-016-coach-reasoning.md))
- [x] History: finished plan → goal reached or not (InBody and body scans, start vs end) ([ADR-019](decisions/ADR-019-plan-length-and-report.md))
- [x] Profile: full body report (body scan + InBody + imbalance tests) ([ADR-020](decisions/ADR-020-full-body-report.md))
- [x] Gym: faster manual equipment picking: guided gym tour, search, unlock badges ([ADR-021](decisions/ADR-021-faster-manual-gym-setup.md)); camera scan still waits on the AI-provider decision

## Phase 3: See you (weeks 11–15)
- [x] Pose engine integration (MediaPipe) + capture guidance overlay ([ADR-006](decisions/ADR-006-posture-capture.md)): More → Posture scan, live checklist + spoken cues, auto-capture, landmarks only stored
- [x] Body composition: InBody sheet scan (on-device OCR) + manual entry, history ([ADR-008](decisions/ADR-008-inbody-scan.md), [features/07](features/07-body-composition.md))
- [x] Posture scan: 3-view capture, landmark metrics, findings, report ([ADR-009](decisions/ADR-009-posture-metrics.md)): tilt-corrected metrics, confidence, referral rules, muscle focus
- [x] Imbalance tests area + trunk rotation test (forward bend, phone as scoliometer) ([ADR-010](decisions/ADR-010-trunk-rotation-test.md), [features/08](features/08-imbalance-tests.md))
- [ ] Movement tests, left vs right: single-leg squat, then overhead squat and overhead reach
- [ ] Imbalance engine: all findings → per-side tight/weak muscles → stretches + strengthening, weaker side first
- [x] Plan builder v2: corrective / weak-point blocks driven by findings, safety pause, rebuild on new data ([ADR-014](decisions/ADR-014-plan-builder-v2-body-data.md)). *Movement-test input follows once those tests exist.*
- [ ] Re-scan comparison view
- **Milestone:** public beta

## Phase 4: Coach you (weeks 16–22)
- [ ] Form check post-set analysis for 5 key lifts
- [ ] Pose-based rep counting (auto-fills rep count in the tracker)
- [ ] LLM coaching cues from fault metrics
- [ ] Form-aware progression (don't increase load while form faults are significant)
- **Milestone:** v1.0 launch, Pro subscription

## Phase 5: Beyond v1
- [ ] Real-time audio cues during a set
- [ ] Overhead squat / movement screen video
- [ ] Expand form check to 20+ exercises
- [ ] Wearables (HealthKit / Health Connect), HR-based rest (needs Capacitor wrapper)
- [ ] Multi-gym auto-swap using location
- [ ] **Diet module** ([features/06-diet.md](features/06-diet.md))

## Key risks
| Risk | Mitigation |
|---|---|
| Pose accuracy in crowded gyms or with loose clothing | Capture guidance, confidence thresholds, refuse to analyse low-quality clips |
| Posture "diagnosis" perceived as medical | Wellness framing, screening language, referral prompts |
| Equipment scan misses or hallucinations | Constrained taxonomy, confidence threshold, mandatory user review |
| Users ignore weight suggestions | Show the reasoning ("you hit 3×10 @ RPE 7 → +2.5 kg"), learn from overrides |
| Phone placement friction for video | Tripod/lean guide, angle presets per exercise |
| iOS PWA limits (JS pauses when locked, no vibration) | Timestamp-based timers, Wake Lock, web push; Capacitor wrap as fallback |
| Users unfamiliar with "Add to Home Screen" | Install guide screen with per-platform instructions |
