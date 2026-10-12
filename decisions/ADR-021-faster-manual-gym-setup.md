# ADR-021: Faster manual gym setup

- **Date:** 2026-10-12
- **Status:** Accepted
- **Roadmap item:** Design pass / Gym: faster manual equipment picking

## Context
Design.md asks for an easier way to tell GymBro what a gym has. The camera scan (features/01) needs a vision AI service, which waits on the user's AI-provider and backend decision. Until then, manual picking is the only way in, and it was a long list of chips plus a bare name prompt for new gyms. Must keep working on a phone with no app store and no network.

## Options

### Option A: Guided gym tour + smarter list
A step-by-step walk through the gym, one area per screen, starting from the closest gym type, with a one-line "what it looks like" hint for each item. The Gym tab list gains search, "+N exercises" badges on missing items, and a "biggest unlocks" line.
- **Pros:** fast for new gyms; hints help people who don't know equipment names; works offline; no cost
- **Cons:** more UI to maintain
- **Works without app store:** ✅
- **Effort / cost:** S–M, free

### Option B: Search and badges only
Keep the single list, add search and unlock badges.
- **Pros:** smallest change
- **Cons:** new gyms still start from a wall of chips; no help with names
- **Works without app store:** ✅
- **Effort / cost:** S, free

### Option C: Camera scan now
Build the vision-AI scan from features/01.
- **Pros:** fastest for the user
- **Cons:** needs an AI provider, API key and backend, costs money and sends photos off the phone; the user deferred it
- **Works without app store:** ✅ (PWA camera), but blocked on the decision
- **Effort / cost:** L, paid per scan

## Decision
Option A, because it removes most of the setup effort with no cost or privacy trade-off, and the tour's review step is the same screen a future camera scan would feed into.

Details:
- Every equipment item has a `hint`. Unlock counts are computed live: for each missing item, how many more exercises become possible (`lib/gymSetup.ts`).
- Tour at `#/gym/setup` (new gym) and `#/gym/setup?id=…` (re-check): name + gym type, one step per area with "All of these" / "None of these", then a review with the exercise count and the top 3 items that would unlock the most.
- "+ Add another gym" uses the tour instead of a name prompt; a new gym becomes the active gym.

## Consequences
- Adding equipment items now needs a hint (unit test enforces it).
- Per-gym details such as dumbbell range and plate increments are not covered; logged as an idea.
- When the camera scan arrives, it can prefill the tour's review step.
