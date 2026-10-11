# Feature 07: Body composition (InBody)

## Goal
Keep the user's body-composition results (InBody or similar) in the app, entered by photographing the printed sheet or typing it in, so progress can be tracked alongside training. See [ADR-008](../decisions/ADR-008-inbody-scan.md).

## Values
Weight, skeletal muscle mass, body fat mass, body fat %, BMI, visceral fat level, basal metabolic rate, InBody score, total body water, ECW/TBW, segmental lean mass (arms, trunk, legs). All optional; masses stored in kg.

## Flow
More → Body composition → **Scan InBody sheet** (camera or photo library) → on-device OCR → **review form** (each value tagged "from photo", "check" or empty) → Save. Or **Enter manually**. The latest card shows weight, muscle and body fat with the change since the previous entry; the history list shows every entry with delete.

## Privacy
Body composition is health data. The photo is read on the phone, kept in memory only for comparison during review, and never stored or uploaded. Only the values are saved, locally. They're included in the JSON export and in "Delete all data".

## Acceptance criteria
- [x] No third-party requests during a scan (self-hosted OCR): E2E checked
- [x] Wrong numbers are worse than missing ones: values outside human ranges are dropped, and inferred decimals are flagged: unit tested
- [x] Every value is reviewable before saving; out-of-range edits block Save
- [~] Real InBody sheets (270 / 570 / 770): at least 12 of 15 values correct from a decent phone photo. *InBody 270: 12/14 correct, 0 wrong (v0.11.0, ADR-008 rev. 1). 570/770 tested only with a synthetic sheet.*
- [ ] Use the data: e.g. feed lean-mass asymmetry or body-fat trend into plan notes (later)
