# ADR-015: Session focus: sport-specific and general gym days

- **Date:** 2026-10-12
- **Status:** Accepted (the user chose sport-specific gym days and the first sports and focuses)
- **Roadmap item:** Design pass: Plan, "choose a goal for a workout day"

## Options
| | A: Sport-specific gym session ✅ | B: Sport activity day | C: Both |
|---|---|---|---|
| What | A plan day rebuilt for a sport: power, change of direction, single-leg strength, injury prevention | Mark a day as playing; the plan avoids heavy legs the day before | Both |
| Pros | Directly trains for the sport; same rules engine and safety checks | Simple, protects game-day legs | Complete |
| Cons | Needs new exercises | Doesn't build sport qualities | Largest |
| Works without app store? | ✅ | ✅ | ✅ |
| Effort / cost | M, free | S, free | M–L, free |

Scope chosen by the user:
- court sports: basketball, badminton, volleyball, tennis/pickleball
- combat and swimming: martial arts/boxing, swimming
- general focuses: explosive power, speed and agility, endurance, mobility

Football and running were left out for now.

## Decision
- **Focus per day** (`StoredPlan.dayFocus`), chosen from a sheet on the Plan tab. It's kept through rebuilds; "Standard" goes back to the split's template. Other days keep their templates.
- **Curated slot lists** (`lib/focus.ts`): power and movement first (while fresh), then strength, then injury prevention for the joints that sport loads most. The prevention work is ordered by injury risk:
  - badminton: Achilles/calf, rotator cuff, wrist
  - basketball: Achilles, hamstrings, groin
  - swimming: rotator cuff
  
  Each slot lists exercises in order of preference, ending with bodyweight fallbacks. The first one that's performable, not ruled out by a limitation (including the safety pause), and not advanced-only for beginners is used.
- **Loading by slot kind:**
  - jumps 3×3–5 (beginners 2 sets), 90 s rest
  - power 3×3–5, 120 s
  - main strength 4×4–6 (beginners 3×6–8 @ RPE 7)
  - prevention 2×10–15
  - conditioning in rounds
  - mobility easy
  
  Focus items are `fixed` (no volume top-ups). Power work and the first three prevention slots survive time-trimming.
- **28 new exercises** in new patterns (power, agility, prehab, conditioning), plus 3 mobility drills, all tagged with joint stress (jumps → knee; push press and slams → lower back and shoulder; burpees → wrist and knee; lateral moves → hip). The standard templates don't use these patterns, so existing plans are unchanged.

## Consequences
- Body data still applies on focus days (corrective block, safety pause).
- Hypertrophy volume notes can look low on a mostly-sport week; they're informational.
- Not yet: playing days (option B), football and running, and per-sport seasons (in-season vs off-season volume).
