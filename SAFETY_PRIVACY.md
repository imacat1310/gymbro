# Safety & Privacy

## Health positioning
GymBro is a **fitness and wellness** app, **not a medical device**. Every posture and form output must follow these rules:
- Use screening language: "appears", "may indicate", "common pattern". Never "you have scoliosis" or "diagnosis".
- Never name diseases or conditions as a conclusion. Detected patterns are *postural tendencies*.
- **Referral triggers:** any of the following shows a "consider seeing a physiotherapist/doctor" card and excludes related loaded exercises until the user acknowledges:
  - Marked asymmetry beyond thresholds (e.g. shoulder height difference > 2.5 cm with trunk lateral shift, which may suggest scoliosis)
  - User-reported pain ≥ 4/10, numbness, tingling, or pain that worsens with training
  - Post-surgery or pregnancy flags
- PAR-Q+ style readiness questionnaire at onboarding.
- The terms of service state that this is not medical advice and that users train at their own risk.

> Regulatory note: if the app ever claims to diagnose or treat conditions, it may be classified as Software as a Medical Device (FDA/EU MDR). Keep claims in the wellness category.

## Training safety guardrails (hard rules in the plan engine)
- Contraindication filter: exercise `contraindications` ∩ user `limitations` → excluded.
- Weekly load increase cap (e.g. ≤ 10% volume, ≤ 5% load on main lifts).
- No 1RM testing for beginners; use e1RM from submaximal sets.
- Beginners: RPE cap of 8 in the first 4 weeks regardless of chosen intensity.
- Form-check safety faults (e.g. lumbar flexion under load) → block load increases and show a prominent cue.

## Body media privacy
Posture photos and training videos are **highly sensitive** (partial undress, biometric data).

| Principle | Implementation |
|---|---|
| On-device by default | Pose landmarks computed locally; only landmark coordinates (not images) sent to the server |
| Explicit opt-in for upload | Separate consent toggle for cloud backup and for LLM review of images |
| Minimise | Default: delete raw posture images after landmark extraction; keep a blurred/silhouette thumbnail |
| Face blurring | Auto-blur the face before any upload |
| Retention | Uploaded media auto-deleted after 30 days unless pinned |
| Encryption | At rest (storage) + in transit (TLS); private buckets, short-lived signed URLs |
| Third-party AI | Use API providers that don't train on submitted data; disclose in the privacy policy |
| User control | Export all data, delete account → hard delete within 30 days |

## Compliance checklist
- [ ] GDPR (health data = special category → explicit consent, DPA with vendors)
- [ ] CCPA/CPRA
- [ ] App Store / Google Play health policies: N/A while distributed as a PWA; revisit if ever published to a store
- [ ] Age gate (16+, or 13+ with parental consent depending on region)
