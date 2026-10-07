# Feature 03: Personalised Training Plan Builder

## Goal
Generate a periodised plan (a 4–8 week mesocycle) from:
1. **Performable exercises** (equipment scan)
2. **Posture findings + weak points** (posture scan, strength ratios)
3. **Personal goal**
4. **Preferred intensity**
5. Schedule (days per week, minutes), experience, limitations

## Approach: rules engine + LLM explanation
The **rules engine** decides *what* goes in the plan, so the output is deterministic, testable and safe. The **LLM** explains *why* in plain language and handles free-text preferences ("I hate lunges", "I want bigger arms").

```
Inputs ─► 1. Split selection
       ─► 2. Weekly volume targets per muscle
       ─► 3. Slot templates per day (movement patterns)
       ─► 4. Exercise selection (score & pick from performable set)
       ─► 5. Corrective / weak-point insertion
       ─► 6. Sets × reps × RPE × rest from goal + intensity
       ─► 7. Session duration fit (trim/merge)
       ─► 8. Safety validation
       ─► 9. LLM rationale + user review
```

### 1. Split selection
| Days/week | Beginner | Intermediate+ |
|---|---|---|
| 2 | Full body A/B | Full body A/B |
| 3 | Full body A/B/C | Full body or Push/Pull/Legs |
| 4 | Upper/Lower ×2 | Upper/Lower ×2 |
| 5 | Upper/Lower + Full | PPL + Upper/Lower |
| 6 | PPL ×2 (only with "hard" or above) | PPL ×2 |

### 2. Weekly volume (hard sets per muscle group)
| Experience | Easy | Moderate | Hard | Max |
|---|---|---|---|---|
| Beginner | 6–8 | 8–10 | 10–12 | 10–12 (capped) |
| Intermediate | 8–10 | 10–14 | 14–18 | 16–20 |
| Advanced | 10–12 | 12–16 | 16–20 | 18–22 |

Weak-point muscles: **+20–30% volume**, and placed earlier in the session. Muscles the user wants to maintain only: ~60% of the base volume.

### 3. Goal → rep ranges & intensity
| Goal | Main lifts | Accessories | Rest | Notes |
|---|---|---|---|---|
| Strength | 3–6 reps @ RPE 7–9 | 6–10 | 2–4 min | Focus on the big lifts |
| Hypertrophy | 6–10 | 10–15 / 12–20 | 1.5–3 min / 60–90 s | Volume-driven |
| Fat loss | 6–10 | 10–15, supersets | 45–90 s | Keep strength, raise density, add a conditioning finisher |
| General fitness | 8–12 | 12–15 | 60–120 s | Balanced, includes cardio |
| Athletic | 3–6 + power (jumps, throws) | 8–12 | 2–3 min | Unilateral and power emphasis |

**Intensity preference** maps to: RPE target (Easy 6–7, Moderate 7–8, Hard 8–9, Max 9–10 on the last set), volume tier, and technique options (drop sets and rest-pause only on Hard/Max, for accessories).

### 4. Exercise selection scoring
For each slot (e.g. "Lower – squat pattern – primary"):
```
score(e) = w1·goal_fit + w2·pattern_match + w3·weak_point_coverage
         + w4·anthropometry_fit + w5·user_preference + w6·difficulty_match
         − penalty(contraindication) − penalty(recent_repetition)
```
- Contraindicated exercises are **hard-excluded**, not just penalised.
- Prefer variety across the week (no duplicate exercises within a microcycle unless it's a main lift).
- Each slot keeps 2–3 **ranked alternatives** for one-tap swaps (e.g. when equipment is busy).

### 5. Corrective / weak-point insertion
- From posture findings → **warm-up block** (mobility/activation, 5–8 min) + **1–2 corrective accessories** per session.
- Push:pull balance: if `rounded_shoulders` is flagged, enforce a horizontal pull:push set ratio ≥ 1.5:1.
- Asymmetry → unilateral variants, weaker side first, matched reps.

### 6. Periodisation
- **Beginner:** linear progression, same exercises for 6–8 weeks.
- **Intermediate+:** 4–6 week mesocycle with volume ramp (e.g. week 1: base sets, week 2: +1 set on key muscles, ...), then a **deload** week (−40% volume, same load).
- Auto-adjust when the progression engine detects stalls or under-recovery ([05-session-tracker.md](05-session-tracker.md)).

### 7. Duration fit
Estimate time = Σ(sets × (set duration + rest)) + warm-up + transitions. If it runs over → drop the lowest-priority accessory, superset non-competing accessories, then reduce sets.

### 8. Safety validation (hard checks)
- No contraindicated exercises
- Weekly volume within caps
- No more than two consecutive days of heavy spinal loading
- Beginner RPE cap

### 9. LLM layer
- **Input:** structured plan JSON + user profile + findings.
- **Output:** short rationale per day and per exercise ("Face pulls are here because your side photo suggests rounded shoulders, and they strengthen your rear delts and lower traps").
- **Free-text adjustments:** the LLM converts requests into structured constraints (`exclude: lunges`, `priority_muscle: biceps`). The rules engine then re-runs. The LLM never edits the plan directly.

## Example output (4 days, intermediate, hypertrophy, Moderate, rounded shoulders + weak glutes)
**Upper A:** Band pull-apart (warm-up) · Bench press 4×6–8 @RPE8 · Chest-supported row 4×8–10 · Seated DB press 3×8–10 · Lat pulldown 3×10–12 · Face pull 3×15 · Cable curl 2×12 · Triceps pushdown 2×12
**Lower A:** Glute bridge activation (warm-up) · Back squat 4×6–8 · Romanian deadlift 3×8–10 · Hip thrust 3×10–12 *(weak point)* · Leg curl 3×12 · Banded lateral walk 2×15/side · Calf raise 3×12

## Acceptance criteria
- [ ] Same inputs → same plan (deterministic, seedable)
- [ ] Every exercise is performable with the selected gym's equipment
- [ ] Every flagged finding is addressed by ≥ 1 exercise or warm-up item
- [ ] The session time estimate is within ±10% of the user's target
- [ ] The user can swap any exercise in ≤ 2 taps, choosing from alternatives
- [ ] Switching gym regenerates substitutions while keeping the plan structure
