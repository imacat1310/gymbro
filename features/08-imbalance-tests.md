# Feature 08: Imbalance tests and corrective guidance

## Goal (user, 2026-10-11)
Track body and muscle imbalance **while posing and while moving**, work out which muscles are likely **tight or weak, per side**, and suggest **stretches and strengthening** (weaker side first) to reduce the imbalance. Scoliosis-type asymmetry is one example, not the focus.

> Screening, not diagnosis (SAFETY_PRIVACY.md). Links between findings and muscles are common patterns (Janda-style), phrased as "may help", with referral when thresholds are crossed.

## Tests
| Test | Measures | How | Status |
|---|---|---|---|
| Posture scan | Static left/right and front/back alignment | 3 photos, landmarks ([ADR-006](../decisions/ADR-006-posture-capture.md), [ADR-009](../decisions/ADR-009-posture-metrics.md)) | ✅ v0.5–0.8 |
| Trunk rotation | Rotation of the trunk in a forward bend (angle of trunk rotation) | Phone on the back as a scoliometer, with a helper ([ADR-010](../decisions/ADR-010-trunk-rotation-test.md)) | ✅ v0.9 |
| Single-leg squat L vs R | Knee caving, hip drop, trunk lean per side → weak glute med / hip on one side | Camera, front view | Next |
| Overhead squat | Knees in, heels rise, forward lean, arms fall, weight shift | Camera, front + side | Planned |
| Overhead reach L vs R | Shoulder flexion range per side → tight lats/pecs on one side | Camera, side or front | Planned |

## Imbalance engine (planned)
All findings → per-side "likely tight" and "likely weak" muscles (a cited JSON rule table) → stretches for the tight ones, strengthening for the weak ones (exercises from the in-app database; free-exercise-db, which is public domain, can extend it) → **weaker side first, +1 set on the weaker side** in unilateral work → plan builder v2 priorities. Re-test reminders track whether the gap closes.

## Acceptance criteria
- [x] Trunk rotation: correct angle and side whatever gravity sign the platform uses; calibration cancels a camera bump; ≥ 7° shows the referral card (E2E, simulated sensor)
- [ ] Movement tests: left and right compared from the same recording; results stable on re-test (± agreed tolerance)
- [ ] Engine: every suggested muscle is trainable with the user's gym; no side-specific advice where the evidence doesn't support it (e.g. trunk rotation)
