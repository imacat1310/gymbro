# ADR-007: Plan library and manual editing

- **Date:** 2026-10-11
- **Status:** Accepted (user chose option A and "warn, allow")
- **Roadmap item:** Phase 2: plan builder (user request, ideas #11)

## Context
Before v0.6.0 the app kept one active plan. Rebuilding replaced it, and you could only swap single exercises for planner-approved alternatives. The user asked to change plans and to keep several different plans. Must run in the PWA with no app store (this is local data only).

## Options
| | A: Library + full editing | B: Library only | C: Edit one plan |
|---|---|---|---|
| What | Several named plans, each with its own gym, days, minutes and priorities. Add, remove and reorder exercises; edit sets, reps and rest; add, remove, rename and reorder days | Several plans; contents only via rebuild or swap | One plan, fully editable |
| Pros | Covers both requests | Plans stay rule-checked | Simple |
| Cons | Edits can leave the planner's safe ranges | Can't fine-tune | No second plan |
| Works without app store? | ✅ | ✅ | ✅ |
| Effort / cost | M, free | S, free | S–M, free |

Second choice: when hand edits break the planner's rules, **warn** / block injury conflicts / no checks.

## Decision
**A, with warnings that never block** (the user's choice).
- **Per plan:** name, gym, schedule, priority muscles, an `edited` flag. **Global:** injuries/limitations (they describe the body, not a plan), profile.
- **New plan:** "Build it for me" (rules engine) or "Start empty". Also duplicate, rename, delete, and switch from a Plans sheet.
- **Rebuild** happens in place: same id and name, so the day rotation and history continue. It asks first if the plan was edited by hand.
- **Checks** (`lib/planEdit.ts → checkPlan`):
  - Injury conflicts are red and shown on the exercise, always.
  - Exercises the plan's gym can't do are info (they're swapped automatically at start).
  - On edited plans only: empty day, day longer than the session (+10 min), muscle group under its weekly floor or a muscle over ceiling+2, more push than pull sets.
  - Unedited generated plans already explain shortfalls in their notes, so these checks are skipped to avoid duplicates.
- **Migration (DB v4):** every earlier rebuild left an invisible copy behind. Copies with no workouts are deleted. The active plan is named after its split. Older plans with workouts are kept as "<split> (earlier)".

## Consequences
- The planner's guarantees (contraindications excluded, volume and balance) now hold only for unedited plans. Edited plans rely on the warnings. SAFETY_PRIVACY.md's hard contraindication filter still applies to everything the planner generates and to automatic substitutions.
- Revisit if users ignore red warnings: the fallback is "block injury conflicts" (the second option offered).
