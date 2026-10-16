# ADR-023: Pelvic Tilt from Two Stickers, and Corrective Coverage

- **Date:** 2026-10-16
- **Status:** Accepted (user chose the sticker method)
- **Roadmap item:** Phase 3: posture scan, sagittal pelvis (planned in features/02, not built in ADR-009)

## Context
Sagittal pelvic tilt is the angle of the line from the ASIS (bony point at the front of the hip) to the PSIS (the dimple at the back) against horizontal. MediaPipe gives only the hip **joint centre**, which can't show tilt. The user also asked to check the plan's exercise pool. Several existing posture findings recommend stretches or muscles that had no exercise behind them.

## Options
| | **A: Two stickers + tap** | B: Silhouette only | C: Vision AI on the photo |
|---|---|---|---|
| How | Stickers on ASIS and PSIS before the side photo; on the review screen the user taps them on a zoomed crop; the angle is measured from those two points | Lumbar curve from the side body outline (segmentation) | LLM estimates tilt from the photo |
| Accuracy | Standard photogrammetry approach; error mostly from sticker placement (palpation) | Poor: clothing, glutes and abdomen change the outline | Unreliable, no number |
| Privacy | Two points saved; photo still discarded | Same | Photo leaves the phone |
| Effort | M | M | Blocked on the AI-provider decision |

**Chosen: A.** Tapping instead of automatic colour detection works with any sticker or tape, in any light. Tapping on a zoomed crop keeps the error to about ±2° (about 1 mm of tap error over about 15 cm between the points).

## Measurement
- **Stored:** `ViewCapture.pelvis = { front, back }`, normalized raw-frame coordinates, side views only. No image.
- **Angle:** both points rotated upright with the phone's roll (same correction as the landmarks), then `atan2(front lower than back, horizontal distance)`. **Positive = anterior.** If both side views have markers, the angles are averaged. Agreement within 4° raises confidence; disagreement lowers it.
- **Grading:**
  - Most people tilt forward about 5–15°, so **0–16° is not flagged**.
  - Anterior: mild > 16°, moderate > 20°, marked > 25°.
  - Posterior (front higher than back): mild > 0°, moderate > 5°, marked > 10°.
  - These are GymBro conventions from the typical-range literature, not diagnostic cut-offs.
- **Reliability 0.7** (marker based; placement is the main error), × 0.6 without a level reading from the phone.
- **Wording:** a *tendency*. Standing tilt is only weakly related to pain. No referral rule.

## Training response
| Finding | Correctives (first available is used) | Strengthen |
|---|---|---|
| Anterior tilt | couch stretch, pelvic tilt drill, dead bug, glute bridge | glutes, abs |
| Posterior tilt | hamstring stretch, pelvic tilt drill, bird dog | hip flexors, lower back |

## Exercise pool audit (same change)
Every finding's advice now has an exercise, and a test enforces at least one **equipment-free** corrective per finding:
- **New:** hamstring stretch, pelvic tilt drill, upper trap stretch, adductor rock-back, standing side stretch.
- **Filled:** knee varus had no corrective (now Copenhagen plank, side-lying abduction). Knee valgus gets ankle mobility and the adductor rock-back. Knee hyperextension gets hamstring curls and balance work. Forward head / head tilt get the upper trap stretch. Hip height / trunk shift get the side stretch.

## Consequences
- Pelvic tilt is optional: without markers the scan works as before and says tilt wasn't measured.
- Needs a helper (or careful self-palpation) for the back point.
- **Revisit** if real scans show poor test–retest agreement (> 5° between same-day scans).
