# Feature 06: Diet & Nutrition (Future)

> Status: **Not in v1.** This placeholder records design hooks so the v1 data model doesn't block it.

## Planned scope
- Calorie and macro targets from profile + goal + training load (Mifflin-St Jeor BMR × activity factor, goal adjustment)
- Protein target tied to training goal (e.g. 1.6–2.2 g/kg for hypertrophy)
- Food logging: search, barcode scan, **photo-based meal estimation** (vision LLM, reusing the equipment-scan pipeline)
- Training-day vs rest-day targets
- Weekly adaptive adjustment from body-weight trend (smoothed) vs goal rate
- Pre/post-workout suggestions linked to session times

## Hooks to keep in v1
- `profile.weight_kg` history table (body weight log) → add `body_metric` table early
- Goal enum already includes `fat_loss`
- Session calendar + estimated energy expenditure per session (store it now)
- Keep the vision LLM Edge Function generic (`/vision/recognize` with a taxonomy parameter)

## Safety
- No very-low-calorie recommendations (floor ~1,200 kcal women / 1,500 kcal men, or BMR)
- Eating disorder sensitivity: optional "hide numbers" mode, no shaming language, screening question at diet onboarding
