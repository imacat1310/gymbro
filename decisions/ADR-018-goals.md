# ADR-018: Goals (lift and body targets)

- **Date:** 2026-10-12
- **Status:** Accepted (follows the Design.md "Goals and badges" plan; small choices taken per the CLAUDE.md rule)
- **Roadmap item:** Design pass: Today, goals

## Decision
- **Two kinds:**
  - **lift** (exercise + weight × reps)
  - **body** (InBody body weight, body fat %, skeletal muscle or fat mass)
  
  Both have an optional deadline. Stored (DB v7 `goals`): what the user set, plus the **starting value** (best e1RM so far, or latest InBody value) so progress has a baseline.
- **Derived, not stored:** current value, progress (start → target, either direction), achievement and its date, pace. Same approach as the level (ADR-017).
- **Lift goals use estimated one-rep max** (Epley), so any weight × reps that reaches it counts (95 × 3 ≈ 104.5 meets 100 × 1). A goal already met when set counts as reached that day.
- **Pace:** progress compared with a straight line from creation to deadline; within ±10 percentage points is on track, otherwise ahead or behind; past the deadline unmet is "missed".
- **Connections:**
  - Today's Status panel lists up to 3 active goals
  - a "Goal reached" coach insight for 3 days (priority after a deload, before a stalled lift)
  - a "Goal getter" badge
  - "What your coach sees" counts goals
  - "Why?" entries for lift goals, body goals and pace

## Consequences
- History can now say "goal reached or not" for a finished plan (next step).
- Body goals move only as often as InBody results are logged; the app says so.
