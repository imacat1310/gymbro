# ADR-020: Full body report

- **Date:** 2026-10-12
- **Status:** Accepted (small, reversible choices per the CLAUDE.md rule)
- **Roadmap item:** Design pass: Profile, "body scan, InBody measurement, body full report"

## Decision
One page (Profile → **Full body report**) that combines every body measurement, all derived on the phone (`lib/progress/bodyReport.ts`):
- **Summary:**
  - the Balance score (ADR-017)
  - a ranked **"focus for your training"**: muscles from posture findings (muscle focus) plus the weaker InBody limb (≥ 5% lean-mass gap → its leg or arm muscles), each with its reasons
  - areas to stretch
  - a link to the plan, which applies them on rebuild (ADR-014)
- **Body composition:** latest InBody values and change since the first measurement, coloured by whether the direction is good (muscle up, fat down), plus trend charts for weight, skeletal muscle and body fat.
- **Left/right balance:** arms and legs lean mass with % gap; ≥ 5% names the weaker side.
- **Posture:** confident findings from the latest scan, each compared with the **previous scan** (improved / worse / same / new / resolved), thigh-to-torso ratio, link to the full scan report. Tentative findings stay "Possible:".
- **Trunk rotation:** the latest result and its band.
- **Safety:** the referral card, when the latest scan triggers it.
- **Missing data** gets a button (log InBody / do a posture scan / do the trunk test) instead of an empty section.

Also: the line chart now sizes its left margin to its longest axis label (values like "74.8 kg" were clipped).

## Consequences
- Severity, not raw values, drives the scan-to-scan trend: small measurement noise within a band reads as "same".
