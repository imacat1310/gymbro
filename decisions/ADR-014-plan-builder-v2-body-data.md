# ADR-014: Plan builder v2: body data drives the plan, with a safety pause

- **Date:** 2026-10-12
- **Status:** Accepted (user: body report → plan next; small rule choices taken per the CLAUDE.md rule)
- **Roadmap item:** Phase 3: plan builder v2

## Context
The posture report, trunk test and InBody results were computed and shown, but **nothing reached the plan**. Only injuries and hand-picked priority muscles did. SAFETY_PRIVACY.md also required that a referral pause related heavy exercises until acknowledged, and that wasn't implemented.

## Decisions
1. **One pure translation step** (`lib/bodyInput.ts`) turns the *latest* posture scan, trunk test and InBody result into plan input. Each item carries the reason shown to the user. The planner takes it as an optional `body` input; without body data plans are identical to v1 (all v1 tests unchanged).
2. **Safety pause:** an unacknowledged referral (posture scan: uneven shoulders with trunk shift, or marked shift; trunk test ≥ 7°) is applied exactly like a lower-back limitation, removing squats, deadlifts, rows and overhead presses that load the spine. It appears:
   - as a red card on the Plan tab, with the reason and a link to the report
   - in the plan notes
   - as a **safety net at workout start**: plans built before the referral still get those exercises swapped out
   
   The user lifts it with "I've had it checked: include them again" (confirmed). Unedited plans then rebuild automatically.
3. **Corrective block:** confident findings (confidence ≥ 0.5, severity ≥ mild) map to correctives, following the spec's table:
   - rounded shoulders → pec stretch, wall slide, Y-raise, thoracic extension
   - forward head → chin tuck
   - shoulder or trunk asymmetry → side plank, suitcase carry
   - knees in → banded walk, glute bridge
   - trunk test 5–6.9° → Pallof press, bird dog, side plank (symmetric only, per ADR-010)
   
   Options rotate across days, about 2 per session (~8 min), 2 easy sets each. They're never trimmed for time and never given volume top-ups, and they don't count as hard sets.
4. **Muscles to strengthen** (top 2 from the posture report's muscle focus) become extra accessory slots after the user's own priorities, protected from time-trimming like priorities.
5. **Weaker side:** an InBody segmental lean-mass gap of **≥ 5%** (our cut-off) adds "start with your left leg and add 1 set on it" to one-sided exercises for that limb. If the plan has none, a note suggests swapping one in.
6. **Traceability:** the plan notes start with the pause (if any), "Built with your posture scan (date), trunk rotation test (date), InBody (date)" and the corrective block. Every added exercise's reason names its finding.
7. **Freshness:** plans store the newest body data they used (`bodyDataAt`) and whether they were built under a pause. The Plan tab offers "Rebuild with my body data" when newer data exists or a pause has been lifted.

## Consequences
- Body data is applied **on rebuild**, not live; this keeps hand edits safe. The workout-start safety net covers the one case that can't wait.
- The finding → muscle/corrective links follow common patterns (Janda-style) with modest evidence. Wording stays "may help".
- Still to come: movement tests (left vs right under load) for side-specific strengthening beyond InBody; InBody trends adjusting weekly volume.
