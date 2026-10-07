# GymBro — AI Personal Trainer in Your Pocket

GymBro looks at **your gym** and **your body**, then builds a training plan for both. It coaches each session the way a personal trainer would: it watches your form, counts your reps and tells you what weight to lift next.

## Core loop

```
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │ Equipment    │   │ Posture /    │   │ Goals &      │
 │ Scan         │   │ Body Scan    │   │ Intensity    │
 └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
        │ performable       │ imbalances,      │ goal, days/week,
        │ exercises         │ weak points      │ intensity, experience
        └─────────┬─────────┴─────────┬────────┘
                  ▼                   │
          ┌───────────────┐           │
          │ Plan Builder  │◄──────────┘
          └───────┬───────┘
                  ▼
          ┌───────────────┐      ┌────────────────┐
          │ Live Session  │─────►│ Form Check     │
          │ timer/reps/kg │      │ (video + pose) │
          └───────┬───────┘      └───────┬────────┘
                  │ logs                 │ form score, faults
                  ▼                      ▼
          ┌──────────────────────────────────────┐
          │ Progression Engine → next weights,   │
          │ deloads, plan adjustments            │
          └──────────────────────────────────────┘
```

## Production rules
- **Constraint:** runs on smartphones **without App Store / Google Play** (planned as an installable web app, see [ADR-001](decisions/ADR-001-distribution-and-platform.md)).
- **Every decision gets options with pros and cons** and a recommendation before implementation; significant ones are recorded in [decisions/](decisions/).
- **Step by step:** one roadmap item at a time, logged in [progress.md](progress.md).
- Full rules: [CLAUDE.md](CLAUDE.md).

## Documents

| Doc | Purpose |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Vision, target users, user journeys, MVP scope |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Tech stack, system components, AI/ML pipeline |
| [DATA_MODEL.md](DATA_MODEL.md) | Entities, schemas, relationships |
| [ROADMAP.md](ROADMAP.md) | Phased milestones and build order |
| [SAFETY_PRIVACY.md](SAFETY_PRIVACY.md) | Medical disclaimers, body-image data privacy, consent |
| [features/01-equipment-scan.md](features/01-equipment-scan.md) | Scan gym equipment, get the list of exercises you can do |
| [features/02-posture-scan.md](features/02-posture-scan.md) | Posture photos, imbalance and weak-point detection |
| [features/03-training-plan.md](features/03-training-plan.md) | Personalised plan generation |
| [features/04-form-check.md](features/04-form-check.md) | Video form analysis and coaching cues |
| [features/05-session-tracker.md](features/05-session-tracker.md) | Timer, rep/weight logging, progression advice |
| [features/06-diet.md](features/06-diet.md) | Future: nutrition (placeholder) |
| [progress.md](progress.md) | Production log: phase status, decisions, dated entries |
| [ideas.md](ideas.md) | Idea inbox to capture and evaluate during production |

## Status

Planning stage. Start with [ROADMAP.md](ROADMAP.md).
