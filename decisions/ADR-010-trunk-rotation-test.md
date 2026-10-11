# ADR-010: Imbalance tests area and trunk rotation test

- **Date:** 2026-10-11
- **Status:** Accepted (user chose option A from the open-source research; small choices taken per the CLAUDE.md rule)
- **Roadmap item:** Phase 3: imbalance tests (user request, ideas #13)

## Context
The user's goal is to track body and muscle imbalance during posing *and* movement, work out tight and weak muscles per side, and suggest stretches and exercises to reduce the imbalance. Research (progress.md, 2026-10-11) found no reusable open-source scanner. It found that back-photo scoliosis screening is weak (about 75% accuracy even with 3,240 X-ray-labelled patients), while the forward-bend test with a smartphone scoliometer agrees well with a real scoliometer (agreement 0.92 on a 0–1 scale, with lay raters). It runs in the PWA via DeviceMotion, with no images.

## Decisions
1. **An "Imbalance tests" area** (More → Imbalance tests) groups the posture scan, the trunk rotation test and the movement tests that follow. Results are stored in a generic `assessments` table (DB v6) so new tests don't need new tables.
2. **Trunk rotation test protocol:** a helper lays the phone across the person's bent-forward back, screen up, **top of the phone pointing to the person's right**, and slides it along the upper, then the lower back. The app keeps the peak per region.
3. **Sign handling:** the phone lies screen up, so the gravity z-axis tells which sign convention the platform uses. The angle and the side are correct on both (tested with both signs).
4. **Calibration on a flat surface first**, because camera bumps tilt phones by a few degrees. Readings spreading more than 1° are rejected (phone moving), as are offsets over 6° (surface not flat).
5. **Smoothing:** a 300 ms median, so bumps and tremor don't create false peaks. Readings with the phone tilted over 50° along the spine are ignored (lifted or slid off).
6. **Thresholds** (common screening practice): under 5° common; 5–6.9° re-test; **7° or more → referral card** (added to SAFETY_PRIVACY.md).
7. **Advice:** symmetric core and upper-back mobility work only. Side-specific corrective work for a trunk rotation is left to a professional, because it's not evidence-based to prescribe it from a screening reading.

## Consequences
- Needs a second person. It can't be done alone, unlike the posture scan.
- Readings depend on technique (bend depth, sliding pressure). The app asks for re-tests in the borderline band.
- Next: camera movement tests comparing left and right, then the imbalance engine that turns all findings into per-side tight/weak muscles and exercises (features/08).
