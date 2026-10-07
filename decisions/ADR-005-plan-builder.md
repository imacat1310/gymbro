# ADR-005: Plan Builder v1 Design

- **Date:** 2026-10-08
- **Status:** Accepted. Made autonomously under the CLAUDE.md rule (reversible; the recommendation was taken). Open for the user to override at the recap.
- **Roadmap item:** Phase 2: Plan builder v1

## 1. Who decides the plan
| | Rules engine only | Rules engine + LLM explanations | LLM writes the plan |
|---|---|---|---|
| Pros | Deterministic, testable, offline, free | Friendlier "why" text, free-text requests | Most flexible |
| Cons | Template-ish reasons | Needs an API key + backend (cost, privacy) | Unpredictable, unsafe, untestable (ARCHITECTURE principle 2) |

**Chosen:** **rules engine only, for now.** Reasons are templated ("Main squat lift of the day", "Priority: glutes", "Balances your pushing…"). The LLM layer is deferred to the user's AI-provider decision. `PlanItem.reason` is the hook it will fill.

## 2. Which day is "today"
| | Fixed weekdays (Mon/Wed/Fri) | Rotation (next day after the last one finished) |
|---|---|---|
| Pros | Predictable calendar | A missed day never breaks the plan; works with irregular schedules |
| Cons | Missed days pile up or get skipped | No calendar view |

**Chosen:** **rotation.** Today shows the day after the last finished plan workout.

## 3. Changing gyms
**Chosen:** the plan stores exercise IDs plus ranked alternatives. When a workout starts, anything the current gym can't do is swapped for the best possible alternative in the same movement pattern (`substituteForGym`). The Plan screen offers "rebuild for this gym".

## 4. Algorithm (features/03-training-plan.md)
1. Split from days/week and experience (beginners capped at 5 days unless Hard/Max).
2. Day templates of movement-pattern slots (main / secondary / accessory), plus one accessory per priority muscle (max 3).
3. Deterministic scoring: role fit, load type, priority muscles, beginner technique penalty, variety penalty by role (main 1, secondary 2, accessory 4), penalties for regressions and plain bodyweight moves when equipment exists, and pattern fallbacks when a gym can't do a pattern.
4. Push/pull balancer added **before** trimming; pulling exercises are protected from trimming.
5. Fit to session length: drop non-priority accessories → non-priority secondaries → accessories; then shave sets (minimum 2). Main lifts are never dropped.
6. Weekly volume: top up chest/back/quads/hamstrings/glutes (and priorities ×1.3) to the spec's floor, moving a set from a muscle with slack when time is full; trim isolation work above the ceiling; re-balance push/pull; note any remaining shortfall.
7. Contraindications: a conservative stress-area list (`data/stress.ts`) hard-excludes exercises for limitations (lower back, knee, shoulder, wrist, elbow, hip), with a "see a physiotherapist" note.

## Consequences
- Time estimates are conservative (full rest periods). Short sessions trim accessories, and the notes say what was dropped.
- Changing the training profile doesn't silently change an existing plan; the user rebuilds it.
- Posture findings (Phase 3) plug in as extra priorities, limitations and corrective warm-ups through the same inputs.
