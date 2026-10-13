# Form-check evaluation (ADR-022)

Measures how often each form-check warning is right, and finds better thresholds, from **labelled body points**.
Data never goes in this repository (real people's body points). Keep it in a private folder.

## 1. Get samples
- **From the app:** after a form check, *Help tune GymBro: label this set* → tick what really happened per rep →
  *Share labelled sample*. Each file is a sample with labels.
- **From videos** (your own, or research datasets you have permission to use, e.g. Fitness-AQA / EC3D for
  non-commercial use):
  ```
  npm run form-convert -- --exercise barbell_back_squat --view side --out ~/gymbro-data/side videos/*.mp4
  ```
  Same MediaPipe runtime and **Lite** model as the app (`--model full` to compare), 30 fps, Mac GPU (Metal).
  Measured on an M1 Pro: about 2× the video length.

## 2. Labels for converted videos
Add `labels.csv` next to the samples:
```
file,rep,faults
clip01.json,1,shallow;heel_rise
clip01.json,2,
clip02.json,clip,knee_cave
clip02.json,count,5
```
`rep` = a rep number (faults on that rep; empty = good), `clip` (faults anywhere in the clip), or `count` (true rep
count). Fault codes: `shallow`, `forward_lean`, `heel_rise`, `fast_descent` (side), `knee_cave`, `hip_shift` (front).

## 3. Evaluate
```
FORM_EVAL_DATA=~/gymbro-data/side npm run form-eval
```
Prints and writes `form-eval-report.md` in that folder: rep-count accuracy, per-fault caught / missed / false
alarms, precision, recall and F1, and a threshold sweep with a suggested value where there's enough data
(5+ labelled reps each way). Apply changes to `DEFAULT_SQUAT_THRESHOLDS` (`src/lib/form/squat.ts`) and record
them in ADR-022; the spec bar to leave beta is F1 ≈ 0.8 per fault.
