# ADR-010: Imbalance tests area and trunk rotation test

- **Date:** 2026-10-11
- **Status:** Accepted (user chose option A from the open-source research; small choices taken per the CLAUDE.md rule)
- **Roadmap item:** Phase 3: imbalance tests (user request, ideas #13)

## Context
The user's goal is to track body and muscle imbalance during posing *and* movement, work out tight and weak muscles per side, and suggest stretches and exercises to reduce the imbalance. Research (progress.md, 2026-10-11) found no reusable open-source scanner. It found that back-photo scoliosis screening is weak (about 75% accuracy even with 3,240 X-ray-labelled patients), while the forward-bend test with a smartphone inclinometer is reliable in non-professional hands (Beauséjour 2022: parents' repeat-measurement reliability φ = 0.92; agreement with a spine surgeon ICC 0.82–0.84; same refer/don't-refer decision in 83–90% of cases). It runs in the PWA via DeviceMotion, with no images.

## Decisions
1. **An "Imbalance tests" area** (More → Imbalance tests) groups the posture scan, the trunk rotation test and the movement tests that follow. Results are stored in a generic `assessments` table (DB v6) so new tests don't need new tables.
2. **Trunk rotation test protocol:** a helper lays the phone across the person's bent-forward back, screen up, **top of the phone pointing to the person's right**, and slides it along the upper, then the lower back. The app keeps the peak per region.
3. **Sign handling:** the phone lies screen up, so the gravity z-axis tells which sign convention the platform uses. The angle and the side are correct on both (tested with both signs).
4. **Calibration on a flat surface first**, because camera bumps tilt phones by a few degrees. Readings spreading more than 1° are rejected (phone moving), as are offsets over 6° (surface not flat).
5. **Smoothing:** a 300 ms median, so bumps and tremor don't create false peaks. Readings with the phone tilted over 50° along the spine are ignored (lifted or slid off).
6. **Thresholds:** under 5° common; 5–6.9° re-test; **7° or more → referral card** (added to SAFETY_PRIVACY.md). The 7° referral line follows Bunnell. Secondary sources give Bunnell's bands as 0–3° normal, 4–6° intermediate, ≥ 7° refer, so our "re-test" band starts 1° later than his. *Open question for the user: align to 4°?*
7. **Advice:** symmetric core and upper-back mobility work only. Side-specific corrective work for a trunk rotation is left to a professional, because it's not evidence-based to prescribe it from a screening reading.

## Consequences
- Needs a second person. It can't be done alone, unlike the posture scan.
- Readings depend on technique (bend depth, sliding pressure). The app asks for re-tests in the borderline band.
- Next: camera movement tests comparing left and right, then the imbalance engine that turns all findings into per-side tight/weak muscles and exercises (features/08).

## References
1. Bunnell WP. *An objective criterion for scoliosis screening.* J Bone Joint Surg Am. 1984;66(9):1381–1387. Introduced the scoliometer and angle of trunk rotation (ATR) to make the Adams forward-bend test objective. Cut-offs as cited by later papers: 0–3° normal, 4–6° intermediate, ≥ 7° refer. *Read via secondary sources, not the original.*
2. Hresko MT, Talwalkar V, Schwend R. *Early Detection of Idiopathic Scoliosis in Adolescents* (joint AAOS / SRS / POSNA / AAP position statement). J Bone Joint Surg Am. 2016. doi:10.2106/JBJS.16.00224. Supports screening with the forward-bend test (girls at 10 and 12, boys once at 13 or 14). *Exact ATR cut-offs not verified from the full text.*
3. Beauséjour M, et al. *Parents can reliably and accurately detect trunk asymmetry using an inclinometer smartphone app.* BMC Musculoskelet Disord. 2022;23. doi:10.1186/s12891-022-05611-3. 69 patients; parents trained by a 4-minute video.
4. Qiao J, et al. *Inter- and intraobserver reliability assessment of the axial trunk rotation: manual versus smartphone-aided measurement tools.* BMC Musculoskelet Disord. 2014;15:343. 64 patients with adolescent idiopathic scoliosis; ICC > 0.94 for both the scoliometer and the iPhone app.
5. Counterpoint: smartphone screening apps have shown only fair agreement with a scoliometer in unconfirmed cases (κ = 0.34) and more false positives (Scoliosis 2014, doi:10.1186/1748-7161-9-10).

**Limits that apply to GymBro:** all of this evidence comes from **adolescent** screening and clinic populations; the cut-offs are not validated for adults. Studies take repeated readings with a dedicated inclinometer or a phone in a holder; GymBro uses a hand-held phone and a single sweep per region. GymBro's own readings have **not** been compared with a scoliometer.
