# Product Spec

## Vision
A personal trainer costs $50–100 per session. GymBro should give most of that value for the price of an app: a plan built around **your gym** and **your body**, coaching during each workout, and progress you can measure.

## Target users
| Persona | Need | Key features |
|---|---|---|
| **Beginner** (0–1 yr) | Doesn't know what to do or how to do it safely | Equipment scan → plan, form check, guided sessions |
| **Intermediate** (1–4 yrs) | Plateaued, has imbalances or nagging issues | Posture scan, progression engine, weak-point focus |
| **Traveler / multi-gym** | Different equipment at each gym | Multiple gym profiles, plans that swap exercises per gym |
| **Home gym owner** | Limited equipment | Equipment-constrained programming |

## User journeys

### 1. Onboarding (target: under 5 minutes)
1. Profile: age, sex, height, weight, training experience, injuries or limitations.
2. Goal: hypertrophy / strength / fat loss / general fitness / athletic / rehab-friendly.
3. Schedule: days per week, minutes per session.
4. Preferred intensity: Easy / Moderate / Hard / Max effort (maps to RPE targets and volume).
5. **Equipment scan** of the current gym (can be skipped: choose a preset such as "commercial gym", "home: dumbbells only", "bodyweight").
6. **Posture scan** (optional, recommended): front, side and back photos, plus an optional overhead squat video.
7. Plan generated → user reviews, swaps exercises, accepts.

### 2. Training day
1. Open today's workout → warm-up suggestions (tuned to posture findings).
2. For each exercise: target sets × reps @ suggested weight, demo video, cues.
3. Log each set: reps and weight are pre-filled from the suggestion; one tap to confirm or adjust. RPE/RIR is optional.
4. Rest timer starts automatically after each set.
5. Optional: record a set → form analysis after the set (or live cues).
6. Session summary: volume, PRs, form score, next-session weight suggestions.

### 3. Re-assessment (every 4–8 weeks)
- Re-run the posture scan → side-by-side comparison with the baseline.
- Plan auto-adapts its mesocycle based on progress and adherence.

## MVP scope (v1)
**In:**
- Equipment scan (photo-based) + manual edit of the equipment list
- Posture scan (static photos, 3 views) with rule-based findings
- Plan builder (rules engine + LLM explanation layer)
- Session tracker: timer, rest timer, set logging, progression suggestions
- Form check for **5 key lifts**, post-set analysis: squat, deadlift, bench press, overhead press, barbell row

**Out (later):**
- Live real-time form cues (v2)
- Overhead squat / movement-screen video (v1.5)
- Wearable integration (Apple Health, Google Fit, HR straps)
- Social features, coach marketplace
- Diet (see [features/06-diet.md](features/06-diet.md))

## Success metrics
| Metric | Target |
|---|---|
| Onboarding completion | > 70% |
| Equipment scan accuracy (top-level equipment) | > 90% precision, > 85% recall |
| Week-4 retention | > 40% |
| Sessions logged per active user per week | ≥ 2.5 |
| Users who accept a weight suggestion as-is | > 60% |
| Form-check "this was helpful" | > 75% |

## Monetization (draft)
- **Free:** equipment scan, basic plan, session tracker.
- **Pro (subscription):** posture scan + re-assessments, form check, adaptive progression, multiple gyms.
