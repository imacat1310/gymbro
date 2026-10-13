# ADR-022: Form Check, Personalised by Body Data

- **Date:** 2026-10-13
- **Status:** Accepted (user approved the three recommendations)
- **Roadmap item:** Phase 4: Coach you, form check v1 (squat)

## Context
GymBro should evaluate exercise form like a trainer and give tips. Most form apps judge everyone against one textbook rep. GymBro already knows the user's body:
- **Posture scan:** femur-to-torso ratio, shoulder-to-hip ratio, findings such as knee valgus, forward head and asymmetries.
- **InBody:** segmental lean mass per limb, so the weaker side.
- **Trunk rotation test.**
- **Injury areas.**

Pose detection runs on the iPhone at about 30 fps (pose spike: GO).

## Decision 1: where the evaluation runs
| | **A: On-device rules** | B: Vision AI judges the video | C: On-device metrics, AI writes the tips |
|---|---|---|---|
| How | Landmarks per frame → angles per rep → fault rules → templated tips | Video frames sent to a vision LLM | A, plus an LLM phrases the tips from the numbers |
| Pros | Private, offline, free, instant; consistent; testable | Flexible | A's accuracy plus coach-like wording; no video leaves the phone |
| Cons | Rules per exercise; 2D from one camera | Slow, paid, video leaves the phone, inconsistent, weak on angles and timing | Needs the AI-provider decision (#15, #19) |

**Chosen: A now, C later** (ARCHITECTURE principle 2: rules decide, AI explains).

## Decision 2: when feedback is given
| | **Post-set analysis** | Live spoken cues |
|---|---|---|
| Pros | Prop the phone, lift, then a report with the faulty reps marked; one focused tip | Corrects mid-set |
| Cons | Feedback after the set | Hard to hear in a gym; distracting under load |

**Chosen: post-set.** Live elements are limited to rep counting (spoken) and setup guidance.

## Decision 3: how body data changes the evaluation
Body data changes **what counts as a fault**, **what is watched closely** and **which tip is given**. Every tip names its reason ("Why?").

| Body data | Effect (squat v1) |
|---|---|
| Femur-to-torso ratio | Allowed torso lean at the bottom scales with it: long femurs must lean more to keep balance over mid-foot, so lean is not flagged as a fault, and the tip is stance width or heel elevation, not "chest up" |
| Static knee valgus (posture finding) | Knee cave is checked more strictly (front view), and the tip links to the finding and to banded lateral walks |
| Weaker leg (InBody segmental lean ≥5%) | Side-to-side hip shift is tied to it: "you shift away from your weaker left leg → start single-leg work with the left" |
| Knee limitation | No push for more depth: "squat to a comfortable depth" |
| Lower-back limitation | Lean limit 5° stricter; excessive lean becomes a **safety** fault |
| Own reps in the set | Last reps are compared with the first ones: depth or lean breakdown means fatigue, so hold the weight next time |

The heuristic coefficients (lean limit vs femur ratio, thresholds) are **starting assumptions** in `lib/form/`. They get tuned against labelled recordings before any fault is treated as reliable.

## v1 scope (squat)
- **Side view:** reps (knee-angle state machine), depth (thigh angle vs horizontal), torso lean vs personal limit, heel rise, descent tempo, fatigue breakdown.
- **Front view:** reps, knee cave relative to the user's own standing knee alignment (so a static valgus isn't double counted), side-to-side hip shift.
- **Not measured:** lumbar flexion / "butt wink" (three 2D points can't see spinal curvature reliably), bar path (no bar detection). The UI says so rather than guessing.
- **Score** 0–100 = 100 − Σ (weight × severity × share of reps affected); safety faults weigh 3×. A safety fault or score < 60 sets `blockIncrease` (progression hook from Phase 1; wiring it to the tracker is a later rollout step).
- **Stored:** only the report (score, per-rep metrics, faults). No video and no landmarks by default. A "save recording for tuning" export (landmarks only, via the share sheet) helps tuning with the user's consent.

## Tuning loop (2026-10-13)
- **Labels:** in-app "label this set" (per rep, unlabelled start so labels are the user's own judgement) → a shared **sample** (`lib/form/sample.ts`: body points, profile, labels, what the app said; no video).
- **Converter:** `npm run form-convert` turns videos into samples with the same runtime, Lite model and 30 fps as the app, on the Mac GPU. Measured: about 2× the video length on an M1 Pro.
- **Evaluator:** `FORM_EVAL_DATA=… npm run form-eval` re-runs the analysis with any thresholds (`SquatThresholds`, defaults unchanged) and reports per-fault caught / missed / false alarms, precision, recall and F1, rep-count accuracy, and a sweep of each fault's boundary. A change is suggested only with 5+ labelled reps each way.
- **Data** (real people's body points, research datasets) stays outside the repository. Threshold changes are recorded here.

## Consequences
- Each new exercise needs its own rules and labelled samples. The architecture (`lib/form/`: profile → reps → metrics → faults → tips) is shared.
- Accuracy is unproven until tested on the user's real sets. Faults ship as "beta" until each reaches the spec's ~0.8 F1 on labelled recordings.
- **Revisit if:** 2D side-view lean or depth proves unreliable at typical gym distances, or users need live cues.
