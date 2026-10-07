# Feature 02: Posture Scan → Imbalances & Weak Points

## Goal
Photograph the user's posture and detect postural tendencies, left/right asymmetries, structural features (e.g. long femurs relative to torso) and under-developed areas. Each finding feeds the plan builder as corrective, mobility or weak-point priorities.

> ⚠️ This is a **screening** tool, not a diagnosis. See [SAFETY_PRIVACY.md](../SAFETY_PRIVACY.md).

## Capture protocol
Consistent capture is what makes the results usable. The app guides each shot:
- **Views:** front, left side, back (right side optional).
- **Clothing:** fitted clothing or shorts/sports bra; hair tied up so the neck is visible.
- **Setup:** phone at hip height, 2.5–3 m away, vertical, level (gyroscope check ±2°). Full body in frame, plain background.
- **Stance:** relaxed natural standing, feet hip-width, arms by sides, eyes forward. Take 3 breaths, then auto-capture.
- **Live overlay:** silhouette guide + checklist ("✅ level ✅ full body ✅ lighting ❌ step back").
- Self-timer or voice trigger so the user can take the photos alone.

## Analysis pipeline
```
Photo ─► quality check ─► MediaPipe Pose (33 landmarks) ─► metric calculation ─► thresholds ─► findings
                                                     └─► (opt-in) LLM visual review for muscle-development notes
```

### Metrics & findings (v1)
| Finding code | View | Metric | Flag threshold (mild / moderate / marked) |
|---|---|---|---|
| `forward_head` | Side | Craniovertebral angle (ear–C7 approximated via ear–shoulder vs horizontal) | < 50° / < 45° / < 40° |
| `rounded_shoulders` | Side | Acromion position anterior of plumb line through ear/hip | > 2 / 4 / 6 cm (scaled by height) |
| `thoracic_kyphosis_tendency` | Side | Upper back curvature from contour (v2) | — |
| `anterior_pelvic_tilt` | Side | ASIS–PSIS approximation from hip landmark + contour | > 10° / 15° / 20° |
| `posterior_pelvic_tilt` | Side | as above | < 0° |
| `knee_hyperextension` | Side | Hip–knee–ankle angle | > 185° |
| `shoulder_height_asymmetry` | Front/Back | Left vs right shoulder Y difference | > 1 / 2 / 3 cm |
| `pelvic_height_asymmetry` | Front/Back | Left vs right hip Y difference | > 1 / 1.5 / 2.5 cm |
| `lateral_trunk_shift` | Front/Back | Midpoint shoulders vs midpoint hips X offset | > 1.5 / 3 / 4.5 cm |
| `head_tilt` | Front | Ear line angle | > 3° / 5° / 8° |
| `knee_valgus_static` | Front | Hip–knee–ankle frontal angle | > 5° / 10° / 15° |
| `knee_varus_static` | Front | as above, opposite | — |
| `foot_turnout_asymmetry` | Front | Foot angle L vs R | > 10° diff |
| `scapular_winging` | Back | Contour/shadow analysis (LLM-assisted, low confidence) | qualitative |

Pixel to cm conversion uses the user's height and the head-to-ankle pixel distance.

### Proportions / "uniqueness" (informs exercise choice, not correction)
- Femur-to-torso ratio → long femurs: favour high-bar/front squat, wider stance, heel elevation
- Arm span vs height → long arms: deadlifts favoured, bench ROM longer
- Shoulder-to-hip width ratio

### Muscle development / lacking areas
Photos alone give only rough results here. Combine three signals:
1. **Visual (opt-in LLM review):** qualitative notes such as "upper chest less developed relative to lower chest" or "calves small relative to thighs". Low confidence, phrased as suggestions.
2. **Self-report:** "Which areas do you want to improve?" body map tap.
3. **Strength ratios from training logs** (more objective, available after a few weeks):
   - Bench : row ratio, squat : deadlift, quad : hamstring (leg ext vs leg curl)
   - Unilateral L vs R differences (e.g. single-arm DB press reps L 10 / R 8)
   - Weak-point flag when a ratio deviates > 15% from population norms

### Movement screen (v1.5)
Static posture is a weak predictor of how someone moves. Add an **overhead squat assessment** video (front + side, 5 reps), which detects knee valgus, heel rise, forward lean, arms falling, and asymmetric weight shift. It reuses the form-check pose pipeline.

## Finding → training response mapping (examples)
| Finding | Mobility / release | Strengthen | Avoid / modify |
|---|---|---|---|
| Forward head | Upper trap / levator stretch | Chin tucks, deep neck flexor holds | Cue neutral neck on pulls |
| Rounded shoulders | Pec doorway stretch, thoracic extension on foam roller | Face pulls, band pull-aparts, rear delt fly, lower trap Y-raise | Balance push:pull to ≥ 1:1.5 |
| Anterior pelvic tilt | Hip flexor stretch (couch stretch) | Glute bridges, dead bugs, RKC plank, hamstring curls | Cue ribs down on overhead press |
| Shoulder height asymmetry | — | Unilateral work, start with the weaker side, suitcase carries | — |
| Lateral trunk shift | Side-lying QL stretch | Side plank (weaker side +1 set), Copenhagen plank | ⚠️ marked → referral card |
| Knee valgus | Ankle dorsiflexion mobility | Glute med (banded walks, side-lying abduction), split squats | Cue "knees out"; monitor in form check |

## Output: Posture report
- Body silhouette with colour-coded markers (green / yellow / orange)
- Per finding: what it is, possible contributors, what the plan does about it
- "Your plan includes X corrective exercises, ~8 min per session"
- Re-scan reminder at 6 weeks → side-by-side overlay comparison with metric deltas

## Acceptance criteria
- [ ] The capture flow rejects bad photos (not level, partial body, too dark)
- [ ] Test–retest: the same person scanned twice within 10 minutes gives metric variance < 15%
- [ ] Every finding shows confidence; low-confidence findings are hidden or marked "possible"
- [ ] Referral rules trigger correctly (unit-tested)
- [ ] Raw photos deleted after processing unless the user opts to keep them
