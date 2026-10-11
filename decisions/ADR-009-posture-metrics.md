# ADR-009: Posture metrics, findings and report

- **Date:** 2026-10-11
- **Status:** Accepted (follows the spec; small choices taken per the CLAUDE.md rule)
- **Roadmap item:** Phase 3: posture scan landmark metrics, findings, report

## Context
ADR-006 stores 33 landmarks per view (front, side, back), with no photos. This step turns them into findings with severity and confidence, a report, and referral cards (SAFETY_PRIVACY.md). Everything runs on the phone.

## Decisions
1. **Computed on the fly, not stored.** `analyzeScan()` is deterministic and fast, so improved maths re-analyses old scans automatically. Nothing new is stored.
2. **Phone tilt is corrected** before measuring. The stored roll (device axes) is mapped to the image (front camera: image x = −device x; back camera: image x = device x) and the landmarks are rotated so true vertical is vertical. At 3° of roll this removes about 2 cm of fake shoulder-height difference. *This is derived and unit-tested for internal consistency, not yet confirmed on a phone.*
3. **Left/right comes from image position, not MediaPipe's labels.** Labels can swap on back views; a raw frame of a person facing the camera has their left side at higher x.
4. **Front and back are averaged** for frontal metrics. Agreement raises confidence; disagreement in direction lowers it.
5. **Confidence** = metric reliability (2D landmark limits: e.g. shoulders 0.85, hips 0.65, forward head 0.55) × landmark visibility × steadiness × level data. Below 0.5 the report says "Possible"; below 0.3 it hides the finding. Referrals need ≥ 0.5.
6. **Measured (v1):** shoulder and hip height difference, lateral trunk shift, head tilt, knee valgus/varus (front); forward head (ear–shoulder angle), rounded shoulders, knee hyperextension (side). Spec thresholds; knee hyperextension uses 185/190/195°.
7. **Not measured (v1), and the report says so:** pelvic tilt, upper-back curvature, scapular winging, foot turnout. These need the body outline or more than 2D landmarks (see the research in progress.md, 2026-10-11).
8. **Muscle focus:** each finding maps to muscles to strengthen (exercise-database muscle ids) and areas to stretch (spec table, Janda-style patterns). These are ranked by severity across findings and shown as "Focus for your training", ready for plan builder v2.
9. **Referral (SAFETY_PRIVACY.md):** shoulder difference > 2.5 cm together with any trunk shift, or a marked trunk shift on its own. Screening wording only; it never names a condition.

## Consequences
- **Forward head is under-detected.** The spec's shoulder-based angle with clinical C7 thresholds (50/45/40°) needs the ear about 17 cm in front of the shoulder before flagging. Revisit the thresholds after real scans, or estimate C7.
- The femur:torso ratio uses joint centres. The "long/short thigh" cut-offs (0.9/0.7) are approximate and only inform exercise choice.
- Accuracy on real people (test–retest < 15%) is unverified until scans exist from a phone.
