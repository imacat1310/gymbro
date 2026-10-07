# Feature 04: Form Check (AI Personal Trainer Video Analysis)

## Goal
The user records a set. GymBro analyses each rep the way a trainer would: it finds technique faults, scores the form, and gives a few short corrective cues with a visual overlay.

## Modes
| Mode | Release | Description |
|---|---|---|
| **Post-set analysis** | v1 | Record → stop → analysis in ~5–10 s → annotated replay |
| **Live cues** | v2 | Real-time audio cues during the set ("hips up", "slow down") |
| **Upload** | v1 | Analyse an existing video from the camera roll |

## Capture guidance
Each exercise defines its **best camera angle**:
| Exercise | Angle | Why |
|---|---|---|
| Squat | Side (45° optional) | Depth, torso angle, bar path |
| Deadlift / RDL | Side | Back angle, hip hinge, bar path |
| Bench press | Side, low at bench height | Bar path, elbow angle, touch point |
| Overhead press | Side | Bar path, lumbar extension |
| Barbell row | Side | Torso angle, ROM |
| Squat (valgus check) | Front | Knee tracking |
| Lunge / split squat | Front + Side | Knee tracking, balance |

Pre-record overlay: "Place phone ~3 m away at hip height, full body + bar visible." Live validation runs before recording starts (body fully visible, landmark confidence above 0.6).

## Pipeline
```
Video ─► frame sampling (30 fps) ─► MediaPipe Pose per frame (on-device)
      ─► smoothing (One Euro filter) ─► joint angle time series
      ─► rep segmentation (angle-based state machine)
      ─► per-rep metrics ─► fault rules ─► form score
      ─► (optional) bar tracking (plate/bar detector or wrist proxy)
      ─► LLM: metrics + faults → 1–3 coaching cues in a trainer's voice
      ─► annotated replay (skeleton overlay, highlighted fault frames)
```

### Rep segmentation (shared with rep counting)
Example (squat): use the knee angle θ.
```
STANDING (θ > 160°) → DESCENDING (θ falling) → BOTTOM (θ min, velocity ≈ 0)
→ ASCENDING (θ rising) → STANDING  ⇒ rep++
```
Hysteresis and minimum duration filters reject noise and half reps (counted separately as "partial").

### Per-rep metrics
- Range of motion (min/max joint angles)
- Tempo: eccentric / pause / concentric seconds
- Torso angle, hip vs shoulder rise rate
- Knee tracking (frontal: knee X vs ankle/hip line)
- Bar path deviation from vertical (if the bar is tracked) or wrist path as a proxy
- Left/right symmetry (angle differences)
- Rep-to-rep velocity drop → proxy for proximity to failure (estimates RIR)

## Fault library (v1: 5 lifts)
| Exercise | Fault code | Detection rule (simplified) | Cue |
|---|---|---|---|
| Squat | `insufficient_depth` | Hip crease not below knee (hip Y > knee Y at bottom) | "Sit a bit deeper, hips below knees" |
| Squat | `knee_valgus` | Frontal: knee moves medially > 10% of hip width during ascent | "Push your knees out over your toes" |
| Squat | `heel_rise` | Heel landmark lifts > 2 cm | "Keep weight mid-foot, heels down" |
| Squat | `excessive_forward_lean` | Torso angle < 40° from horizontal at bottom (adjusted for femur length) | "Chest up, brace harder" |
| Squat | `butt_wink` | Pelvis posterior rotation > 15° at the bottom | "Stop just above the depth where your lower back rounds" |
| Deadlift | `lumbar_flexion` ⚠️ | Back curvature change > threshold under load | "Brace and keep your back neutral, chest proud" |
| Deadlift | `hips_shoot_up` | Hip angle velocity ≫ knee angle velocity off the floor | "Push the floor away, chest and hips rise together" |
| Deadlift | `bar_drift` | Bar/wrist X deviates > 5 cm from mid-foot | "Keep the bar close, drag it up your legs" |
| Deadlift | `hyperextension_lockout` | Trunk extension past vertical > 10° | "Finish tall with glutes, don't lean back" |
| Bench | `elbow_flare` | Upper-arm/torso angle > 75° | "Tuck your elbows about 45–60°" |
| Bench | `uneven_press` | L/R wrist height diff > 3 cm | "Press evenly; your left side lags" |
| Bench | `bounce` | Velocity reversal with no pause + sharp spike | "Control the bar down, touch, then press" |
| OHP | `lumbar_hyperextension` | Rib/pelvis angle increases > 15° | "Squeeze glutes, ribs down" |
| OHP | `bar_path_forward` | Bar ends forward of the mid-foot line | "Head through at the top, bar over mid-foot" |
| Row | `torso_rising` | Torso angle increases > 15° during the set | "Stay bent over; lower the weight if needed" |
| Row | `short_rom` | Elbow doesn't pass the torso line | "Pull to your belly, squeeze shoulder blades" |

⚠️ = **safety fault**: highlighted in red, blocks load increase in the progression engine.

## Form score
```
form_score = 100 − Σ (fault_weight × severity × fraction_of_reps_affected)
```
Safety faults weigh 3×. Shown as a badge: 90+ Excellent, 75–89 Good, 60–74 Needs work, < 60 Reduce load.

## Coaching output (LLM)
- **Input:** exercise, user level, per-rep metrics, faults (with rep numbers), posture findings (e.g. a known `knee_valgus_static` tendency), last session's faults.
- **Rules for the response:** at most 3 cues, the most important first, simple language, one external cue where possible, and praise what's good. Never diagnose injuries.
- **Example:**
  > **Good set: 82/100.** Depth was solid on all 8 reps 👍
  > 1. **Knees caved in on reps 6–8** as you fatigued. Think "spread the floor" on the way up. Your posture scan showed the same tendency, so we've added banded lateral walks to your warm-up.
  > 2. **Slightly fast descent** (0.8 s). Aim for a 2-second lowering.

## Integration with other features
- Rep count → auto-fills `set_log.reps` (`rep_source = pose_counted`), user-confirmable.
- Velocity loss → estimated RIR → informs the progression engine.
- Recurring faults → plan builder adds a targeted accessory or regresses the exercise variant.

## Accuracy & limitations
- 2D pose from one camera can't measure everything. Rules must be **angle-specific**, and the app shows "can't assess from this angle".
- Loose clothing, occlusion by plates or the rack, and crowded backgrounds → the confidence gate refuses analysis instead of guessing.
- Validate against expert-labelled videos (target: fault detection F1 ≥ 0.8 per fault before shipping that fault).

## Acceptance criteria
- [ ] Rep count accuracy ≥ 95% on the test set for the 5 lifts
- [ ] Post-set analysis in < 10 s on a mid-range phone (e.g. iPhone 13 / Pixel 7)
- [ ] Each shipped fault has F1 ≥ 0.8 against coach labels
- [ ] Videos are processed on-device; upload only with opt-in
- [ ] Annotated replay jumps to the fault frames
