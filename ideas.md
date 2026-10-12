# Ideas

A parking lot for ideas that come up during production. Capture fast and evaluate later. When an idea is accepted, move it into the relevant feature spec or [ROADMAP.md](ROADMAP.md), then mark it here.

Status: 💡 New · 🔍 Evaluating · ✅ Accepted (→ where) · ❌ Rejected (why) · ⏸ Later

## Inbox

| # | Date | Idea | Area | Status | Notes |
|---|---|---|---|---|---|
| 1 | 2026-10-08 | Auto-detect which gym you're at from location and load that gym's equipment | Equipment / Plan | ⏸ Later | Already in Phase 5 |
| 2 | 2026-10-08 | Count reps with voice ("done", "eight") so you don't touch the phone | Session tracker | 💡 New | |
| 3 | 2026-10-08 | Apple Watch / Wear OS companion app to log sets and see the rest timer | Session tracker | 💡 New | |
| 4 | 2026-10-08 | Busy-equipment swap: suggest the best alternative when a machine is taken | Plan | 💡 New | Partly covered by ranked alternatives |
| 5 | 2026-10-08 | Monthly progress video: posture scan overlays stitched over time | Posture scan | 💡 New | Needs opt-in media retention |
| 6 | 2026-10-08 | Pounds (lb) display option | UX | 💡 New | Storage is already kg; display-layer only (ADR-004 §5) |
| 7 | 2026-10-08 | Edit an exercise's target (sets/reps/RPE/rest) inside a workout | Session tracker | 💡 New | The plan builder will set these; manual override still useful |
| 8 | 2026-10-08 | Exercise demo images/GIFs from free-exercise-db (public domain) | Exercise DB | 💡 New | Hybrid plan in ADR-004 §3 |
| 9 | 2026-10-08 | Repeat a past workout with one tap ("Do this again") | Session tracker | 💡 New | Cheap bridge until the plan builder ships |
| 10 | 2026-10-08 | Import from Strong / Hevy CSV exports | Data | 💡 New | Fast onboarding for existing lifters |
| 11 | 2026-10-11 | Change a plan, or create and keep several different plans and switch between them | Plan | ✅ Accepted (user request) | In progress (ADR-007) |
| 13 | 2026-10-11 | Reuse open-source biomechanics scanners: body composition from photos; scapular winging, scoliosis-type asymmetry → muscles to strengthen | Posture scan / Body | 🔍 Evaluating (user request) | Researched 2026-10-11: no drop-in open project (non-commercial licences, no weights, weak validation). Candidates: cited finding→muscle table + free-exercise-db (Unlicense), phone scoliometer (Adams test via motion sensor), Navy tape body-fat estimate, CVA/landmark-tap improvements, experimental segmentation contours. User picked A (trunk rotation, v0.9.0) and set the goal: per-side imbalance in posing *and movement* → tight/weak muscles → corrective work (features/08) |
| 18 | 2026-10-12 | Per-gym dumbbell range and plate increments, so weight suggestions round to what the gym actually has | Gym / Plan | 💡 New | Came up during the gym-setup step (ADR-021) |
| 17 | 2026-10-12 | Readiness check-in (sleep, soreness 1–5) that can hold or lower today's load, never raise it (from gymcoach) | Session tracker | 💡 New | |
| 16 | 2026-10-12 | Sport playing days: mark a day as a game/practice; plan avoids heavy legs the day before | Plan | 💡 New | Option B in ADR-015 |
| 15 | 2026-10-12 | AI coach (user asked: open-source "AI fitness coach", Arvo AI Muscle Coach, Jotform Personal Trainer agent) | Coach | ⏸ Later: step 1 done; opt-in chat parked, see "Pending decision: opt-in AI coach" below | Step 1 = v0.17.0 (ADR-016): explanations, signals, coach view, no AI |
| 14 | 2026-10-11 | Design.md: Today level + goals & badges; Plan day goals + references; Gym scan + manual; History plan outcome; Profile body scan + InBody + full report; retro souls theme | All tabs | ✅ Accepted → ROADMAP "Design pass" | Theme + Profile shipped v0.13.0 |
| 12 | 2026-10-11 | Scan an InBody result sheet with the camera to fill in body composition (weight, muscle mass, body fat, segmental lean mass) | Profile / Data | ✅ Accepted (user request) | Built in v0.7.0 (ADR-008): on-device OCR + manual review/fallback |

<!-- Template row:
| N | YYYY-MM-DD | Idea | Area | 💡 New | |
-->

## Pending decision: opt-in AI coach (ideas #15, saved 2026-10-12)
The user chose to park this; it costs money and sends data off the phone, so the user decides when.

**Proposal (option B from the 2026-10-12 research):** an **"Ask the coach"** chat, **off by default**.
- **Where it runs:** Claude via a small serverless proxy (Cloudflare Worker or Supabase Edge Function) that holds the API key. The key never goes in the public repo or the app.
- **What is sent:** only the "What your coach sees" summary (Profile) plus the question. No photos, InBody sheets or raw landmarks. The screen shows exactly what will be sent before the first message.
- **What the AI may do:** explain and answer only. Numbers (loads, sets, plans) come from the rules engine. Any change it suggests comes back as typed JSON, is re-checked by the rules, and needs the user's confirmation (gymcoach pattern).
- **Safety:** a fixed system prompt with screening language and referral rules; a filter that blocks load numbers the engine didn't produce.
- **Cost:** about $0.02/user/month on Haiku (30 chats × ~4.5k tokens); about $0.40 on Sonnet. The Worker free tier is 100k requests/day.
- **Needs from the user:**
  1. pick the backend (Cloudflare Worker / Supabase)
  2. create an Anthropic API key and spending limit
  3. approve a privacy-note update
  4. per-user rate limits / sign-in
- **Alternatives considered:** an on-device LLM (WebLLM): only iOS 26+ phones, a 0.3–0.7 GB download, weak small models. Revisit in ~12 months. Closed products (Arvo, Jotform): not usable.
- **Effort:** M, plus an ADR when the user decides.

## Areas
Equipment · Posture scan · Plan · Form check · Session tracker · Diet · Social · Monetization · UX · Infra

## Rejected / archived
| # | Idea | Reason |
|---|---|---|
