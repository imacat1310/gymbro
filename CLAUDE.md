# GymBro: Production Rules

These rules apply to every step of building GymBro. Follow them in every session.

## Hard constraint
**The app must run on a smartphone (iOS and Android) without being published to the App Store or Google Play.** Every technology, library and feature choice must stay compatible with this. If a feature can't work under it, say so and propose a workaround. Never quietly assume store distribution.

Current platform decision: [decisions/ADR-001-distribution-and-platform.md](decisions/ADR-001-distribution-and-platform.md).

## Rule 1: Explain options before every decision
At each decision point (framework, library, architecture, data storage, algorithm, UX approach, third-party service), **before implementing**:

1. List **2–4 realistic options**. Skip options that can't meet the hard constraint, or name them and say why they're out.
2. For each option give:
   - **What it is**: 1–2 plain sentences
   - **Pros**
   - **Cons**
   - **Fit with the hard constraint** (works on phone without a store?)
   - **Effort / cost** (rough: S / M / L, and any money cost)
3. Give **one recommendation** and the deciding reason.
4. **Wait for the user's choice** if the decision is hard to reverse, costs money, or affects privacy or safety. For small, easily reversible choices, follow the recommendation, state it in one line, and continue.
5. Record significant decisions as an ADR in `decisions/` (copy `decisions/TEMPLATE.md`) and add a row to the Decisions table in `progress.md`.

Use this format when presenting options in chat:

```
### Decision: <what we're choosing>
| | Option A | Option B | Option C |
|---|---|---|---|
| What | ... | ... | ... |
| Pros | ... | ... | ... |
| Cons | ... | ... | ... |
| Works without app store? | ✅/⚠️/❌ | ... | ... |
| Effort / cost | ... | ... | ... |

**Recommendation:** Option X, because ...
```

## Rule 2: Build step by step
- Work through [ROADMAP.md](ROADMAP.md) **one item at a time**. Finish an item, show how to test it on a phone, then move to the next.
- Before starting a step, say which roadmap item it is and what "done" looks like.
- After each step, update [progress.md](progress.md): phase status, Now/Next/Blocked, and a dated log entry.
- Ideas that come up along the way go into [ideas.md](ideas.md), not straight into the code.

## Dev environment
- App code: `app/` (React + TS + Vite PWA, [ADR-002](decisions/ADR-002-ui-framework.md)). Commands are in `app/README.md`.
- Node is installed via Homebrew and isn't on the default shell PATH. Prefix commands with `export PATH=/opt/homebrew/bin:$PATH;`.
- Run `npm run build` and `npm run lint` in `app/` before reporting a step as done.
- Deploy: pushing to `main` publishes to GitHub Pages under `/gymbro/` ([ADR-003](decisions/ADR-003-hosting-and-repo.md)). Reference public assets with `import.meta.env.BASE_URL`, never a leading `/`.
- **The repo is public: never commit secrets, API keys or personal data.**

## Rule 3: Keep docs in sync
If a decision changes something already written in ARCHITECTURE.md, DATA_MODEL.md, ROADMAP.md or a feature spec, update that doc in the same step.
