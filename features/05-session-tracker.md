# Feature 05: Session Tracker & Progression Engine

## Goal
Make logging a set take about one second. Time the session and rest periods. Use the logged data to **suggest the right weight** for each next set and session.

## Session screen
```
┌─────────────────────────────────────────┐
│ Upper A            ⏱ 00:42:17   [End]   │
├─────────────────────────────────────────┤
│ ▶ Bench Press           4 × 6–8 @ RPE 8 │
│   Last time: 80 kg × 8, 8, 7, 7         │
│   Suggested: 82.5 kg                    │
│                                         │
│   Set  kg      reps  RPE                │
│   W    40      10    –    ✓             │
│   W    60      5     –    ✓             │
│   1    82.5    8     7.5  ✓             │
│   2    82.5    [7]   [ ]  ✓ ◄ tap       │
│   3    82.5    –     –                  │
│                                         │
│   [🎥 Record set]  [⇄ Swap]  [📝 Note]  │
├─────────────────────────────────────────┤
│        REST  01:47 / 02:30   [+30s][Skip]│
└─────────────────────────────────────────┘
```

## Features
### Timing
- **Session timer:** starts on the first set (or "Start workout"), continues in the background.
- **Rest timer:** auto-starts when a set is checked; duration from the plan (goal-based), adjustable. The PWA approach (see [ADR-001](../decisions/ADR-001-distribution-and-platform.md)) shapes how it works:
  - Store `rest_ends_at` as a timestamp, never a countdown, so the timer is correct after the app resumes.
  - Keep the screen awake during a session (Wake Lock API, toggleable) → sound + on-screen flash when rest ends.
  - Backup: schedule a Web Push from the backend for `rest_ends_at` so the user is notified if the phone is locked (iOS 16.4+ installed PWA, Android Chrome).
  - Vibration on Android only (no Vibration API on iOS).
- **Set timer:** for timed exercises (plank, carries) with a countdown.
- **Interval mode:** EMOM / AMRAP / Tabata for finishers and conditioning.

### Logging
- Weight and reps are **pre-filled** with suggested values; checking the set confirms them.
- Steppers sized by equipment (e.g. ±2.5 kg barbell, ±2 kg dumbbells based on gym attributes, machine stack increments).
- Optional **RPE / RIR** after each working set (a quick 6–10 slider). Recommended for intermediates; hidden by default for beginners and replaced with "Easy / Good / Hard / Failed".
- Set types: warm-up, working, drop set, AMRAP, failure.
- Auto-generated **warm-up sets** for main lifts (e.g. bar×10, 50%×5, 70%×3, 85%×1).
- **Plate calculator:** "82.5 kg = bar + 20 + 5 + 1.25 per side".
- Unilateral exercises: log left and right separately.
- Rep count can be auto-filled from the form check ([04-form-check.md](04-form-check.md)).
- Superset and circuit grouping.
- Mid-session swap (equipment busy) → pick from ranked alternatives; the weight suggestion is converted when history allows.

### Session summary
- Duration, total volume (kg), sets per muscle group
- PRs (weight, reps at weight, e1RM, volume)
- Form scores, if recorded
- Next-session suggestions preview
- "How did you feel?" (1–5) + optional soreness and sleep → recovery signal

## Progression engine
### Estimated 1RM
Epley for reps ≤ 10: `e1RM = w × (1 + reps/30)`. With RPE: use an RPE chart (e.g. 8 reps @ RPE 8 ≈ 10RM effort → %1RM lookup) for better accuracy.

### Next-session weight (per exercise)
**A. Double progression** (default for hypertrophy and beginners):
```
if all working sets hit rep_max at RPE ≤ target:
    next_weight = weight + increment        # increment: 2.5 kg upper / 5 kg lower barbell; next DB pair
    target reps reset to rep_min
elif all sets ≥ rep_min:
    same weight, aim for +1 rep on some sets
else:
    same weight; if missed twice in a row → stall_count++
```

**B. RPE autoregulation** (intermediate+, strength):
```
target_e1RM = recent e1RM trend (EWMA of last 3 sessions)
next_weight = target_e1RM × pct(rep_target, rpe_target)   # from RPE chart
round to available increment
```

**C. Within-session adjustment** (next set):
- Set RPE > target + 1 → drop 5–10% for the remaining sets
- Set RPE < target − 1.5 and reps ≥ rep_max → +2.5–5% next set

### Stall & deload logic
- `stall_count ≥ 2` → options: reduce weight 10% and rebuild, change rep range, or swap the variant.
- Global fatigue signals (e1RM down across ≥ 3 lifts, feel score ≤ 2 for 2 sessions, missed sessions) → suggest a deload week.
- **Form gating:** a safety fault or form score < 60 in the last session → **no load increase**; suggest a reduced load plus a technique focus.

### Learning from the user
- Track how often the user overrides suggestions (higher or lower). Apply a per-user, per-exercise bias, e.g. if a user consistently adds +2.5 kg and hits the reps, become more aggressive.
- New exercise with no history → estimate from related lifts (e.g. incline DB press ≈ 0.35 × bench e1RM per hand), or run a calibration set: "pick a weight you can lift ~12 times".

## Explainability
Each suggestion has a "why" line:
> **82.5 kg** ↑ You hit 8, 8, 8, 8 at RPE 7.5 last time, all at the top of your 6–8 range.

## Acceptance criteria
- [ ] Log a pre-filled set in 1 tap; edit and log in ≤ 3 taps
- [ ] Rest timer shows the correct remaining time after backgrounding or locking; a push notification arrives at rest end when locked
- [ ] Works fully offline; syncs without data loss
- [ ] Progression logic covered by unit tests over scripted multi-week scenarios
- [ ] Suggestions always round to weights possible with the gym's equipment
