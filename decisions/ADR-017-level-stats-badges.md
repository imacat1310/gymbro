# ADR-017: Level, stats, weekly activity and badges (Today)

- **Date:** 2026-10-12
- **Status:** Accepted (the user chose "both": character level + activity goal, ADR-012 discussion; formulas are small reversible choices per the CLAUDE.md rule)
- **Roadmap item:** Design pass: Today

## Decision
Everything is **derived, not stored** (`lib/progress/level.ts`), so it always matches the logged history and can be re-tuned without migrations. Every number has a "Why?" entry with its formula.
- **XP:**
  - +100 per finished workout (with ≥ 1 working set)
  - +2 per working set (cap 30)
  - +50 per personal record, **one per exercise per workout** (a heavier weight usually also raises the e1RM; counting both doubled the XP in testing)
  - +150 for each week the plan's workout count is met
- **Level curve:** level *L* needs 50·L·(L−1) XP (2 at 100, 5 at 1,000, 10 at 4,500, 20 at 19,000). Early levels come fast; at 3 workouts a week, level 10 takes about 2–3 months and level 20 about a year.
- **Weekly activity rings:** workouts and minutes this week (Monday start) against the active plan (days × session minutes).
- **Stats (0–99):**

  | Stat | Formula |
  |---|---|
  | Strength | best e1RM (squat + hinge + press compounds) ÷ bodyweight (InBody weight, else 75 kg); 5× = 99 |
  | Endurance | working sets per week over 4 weeks × 2 |
  | Power | sessions with power/agility work in 4 weeks × 12 |
  | Consistency | workouts in 4 weeks ÷ (plan days × 4) |
  | Balance | 99 − 12/20/30 per mild/moderate/marked confident posture finding − 15/30 trunk test re-test/refer − 10 per InBody weak limb; blank without body data |

- **15 badges:**
  - workouts 1/10/50/100
  - records 1/10
  - plan streaks 4/12 weeks
  - 10 t / 100 t lifted
  - athlete (finished a sport/focus day)
  - self-aware (posture scan)
  - measured (InBody)
  - balanced (Balance ≥ 85)
  - level 10
  
  Unlock dates come from replaying history in order. Locked badges show progress.
- **Layout:** the Coach insight sits above the next-workout card and the Status panel below it, so starting a workout stays one tap away. Status and coach load after the page.

## Consequences
- Balance is a screening score built from screening signals, worded as such.
- Next: **goals** (user-set targets such as "bench 100 kg" or "body fat 15%", tracked against e1RM and InBody), the rest of Design.md's "Goals and badges".
