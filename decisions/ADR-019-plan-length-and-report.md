# ADR-019: Plan length, finishing, and the end-of-plan report

- **Date:** 2026-10-12
- **Status:** Accepted (small, reversible choices per the CLAUDE.md rule)
- **Roadmap item:** Design pass: History, "finished plan → goal reached or not (judged by InBody and photos)"

## Decision
- **When a plan finishes:** plans get a **length** (4 / 6 / 8 / 12 weeks, default 8; `schedule.weeks`, chosen in plan setup and kept on rebuild) and can be ended early with **"Finish plan now"** (`finishedAt`). The window runs from creation to the earlier of the two. The Plan tab shows "Week n of N · ends …" and, once finished, a banner linking to the report and to "Next plan".
- **The training goal is saved with the plan** (`goal`), so a later profile change doesn't re-judge old plans.
- **Verdict by training goal** (thresholds are GymBro conventions, each with a "Why?"):

  | Goal | Reached | Partly | Measured by |
  |---|---|---|---|
  | Build muscle | skeletal muscle ≥ +0.5 kg | any gain | InBody; falls back to strength (main lifts +5%) |
  | Lose fat | body fat ≤ −1 point | any drop | InBody only, otherwise "not enough data" |
  | Strength | main lifts ≥ +5% e1RM | any gain | first vs last session in the plan |
  | Athletic | lifts ≥ +3% and ≥ 70% of sessions | either | |
  | General | ≥ 75% of planned workouts | ≥ 50% | |

- **"Before" and "after" body data:** the InBody result nearest the start (±14 days) and the last one by the end + 14 days, at least a week apart. **"Photos" means posture scans:** confident findings, first scan vs last. Photos themselves are never stored (ADR-006).
- **Report contents:**
  - verdict, basis and "Why?"
  - workouts done vs planned
  - main lifts before → after (e1RM)
  - InBody before → after (good direction in green)
  - posture findings
  - goals reached during the plan
- **History → Plans** lists every plan with its verdict, or "Week n of N" while running.

## Consequences
- Everything is derived from logged data, so a late InBody result updates the verdict.
- Not yet: a side-by-side posture-scan diagram comparison, and per-plan notes or reflections.
