# ADR-016: Coach reasoning: explained decisions, signals and one insight (no AI)

- **Date:** 2026-10-12
- **Status:** Accepted (the user chose option A, "richer explanations, no AI", and asked to use gymcoach as the reasoning model)
- **Roadmap item:** Design pass: Plan "references behind the plan"; AI coach groundwork (ideas #15)

## Context
Research (ideas #15) found gymcoach (MIT) closest to GymBro's rule: the rules decide, AI only explains. The user chose to improve deterministic explanations first. A future opt-in AI coach (option B) needs a backend and key decision.

## Decision: adopt gymcoach's reasoning design, rewritten for GymBro
1. **Reason codes, rendered separately.** Every weight suggestion (`Suggestion.why`) and every plan item (`PlanItem.why[]`) carries codes from `lib/coach/why.ts`. Each code has the rule in plain words, an **evidence level** (strong / moderate / coaching convention), and **sources**. Links are included only where they were checked:
   - Schoenfeld 2017 volume dose-response
   - Lauersen 2014 injury-prevention meta-analysis
   - Harøy 2019 Copenhagen adduction
   - van der Horst 2015 Nordic curls
   - Ellenbecker & Cools 2010 rotator cuff
   - McGuine & Keene 2006 balance training
   - Zourdos 2016 RIR-based RPE, NSCA Essentials, the Janda approach, Bunnell 1984, Epley
2. **"Why?" panels** on workout suggestions, plan exercises and the coach card. The registry loads on first tap, keeping it out of the first download.
3. **Signals** (`lib/coach/signals.ts`):
   - stalled lift = no estimated-1RM gain above 0.5% for 3 sessions (lifts trained in the last 6 weeks only)
   - deload recommended at 2+ stalled lifts
   - records in the latest session (≤ 3 days old)
   - workouts this week (Monday start) vs plan days
   - safety pause and new body data
4. **One insight on Today**, by priority: safety pause > deload > stalled lift > new record > new body data > consistency.
5. **"What your coach sees"** on Profile: every signal in plain lines, computed on the phone. It's also the exact, minimal input a future opt-in AI coach would receive, so the user knows what would be shared.
6. **Attribution:** THIRD_PARTY_NOTICES.md carries gymcoach's MIT notice. The code was written fresh; no files were copied.

## Consequences
- Every number the app suggests can be traced to a rule and, where one exists, a study. Rules without research behind them are labelled "coaching convention".
- Not adopted (yet): gymcoach's readiness check-in (sleep, soreness) auto-regulation; an LLM debrief that proposes adjustments validated by the rules and confirmed by the user. That's option B, waiting on the backend decision.
