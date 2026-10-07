# Roadmap

Build order follows dependencies: tracker data feeds progression, the exercise DB feeds everything, and pose infrastructure is shared by the posture scan and form check.

**Constraint:** runs on smartphones without App Store / Google Play. Production follows the rules in [CLAUDE.md](CLAUDE.md): explain the options with pros and cons at each decision, and work one step at a time.

## Phase 0: Foundations (weeks 1–3)
- [x] Confirm platform ([ADR-001](decisions/ADR-001-distribution-and-platform.md): PWA accepted)
- [x] Choose UI framework ([ADR-002](decisions/ADR-002-ui-framework.md): React + TS + Vite); scaffold PWA shell with device check screen
- [x] Serve over HTTPS ([ADR-003](decisions/ADR-003-hosting-and-repo.md): GitHub Pages) and install on a real iPhone (✅ device check passed). Android still to test
- [~] Spike: MediaPipe pose in the browser on target phones (measure fps), the go/no-go check for the PWA approach. *Pose test built (More → Pose speed test); awaiting iPhone results.*
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
- [ ] Equipment scan: camera flow → Edge Function → vision LLM → review screen
- [x] Exercise mapping (equipment → performable exercises): deterministic, unit-tested (done early in Phase 1)
- [ ] Plan builder v1: splits, volume landmarks, intensity mapping, exercise selection, substitutions
- [ ] LLM-generated plan rationale ("why this exercise")
- **Milestone:** closed beta (~50 users)

## Phase 3: See you (weeks 11–15)
- [ ] Pose engine integration (MediaPipe) + capture guidance overlay
- [ ] Posture scan: 3-view capture, landmark metrics, findings, report
- [ ] Plan builder v2: corrective / weak-point blocks driven by findings
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
