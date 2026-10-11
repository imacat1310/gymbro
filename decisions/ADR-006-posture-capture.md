# ADR-006: Posture capture flow

- **Date:** 2026-10-11
- **Status:** Accepted (small, reversible choices taken per the CLAUDE.md rule; the privacy default follows SAFETY_PRIVACY.md)
- **Roadmap item:** Phase 3: pose engine integration + capture guidance overlay

## Context
The posture scan ([features/02-posture-scan.md](../features/02-posture-scan.md)) needs three consistent photos (front, side, back) that a user can take alone. The pose spike passed on iPhone (ADR-001 Validation): Lite and Full both run at about 30 fps. Must run in the PWA with no app store.

## Decisions

### 1. Which camera by default
| | Front camera | Back camera |
|---|---|---|
| Pros | You can see the overlay and checklist | Sharper image, better landmarks |
| Cons | Lower image quality | You can't see the screen; relies on voice |
| Works without app store? | ✅ | ✅ |
| Effort | S | S |

**Chosen:** front by default, back selectable. Spoken cues cover both.

### 2. How the photo is triggered
Options: manual tap (needs a helper), self-timer (fires even if you're out of position), **auto-capture when every check passes and you hold still** (spec). **Chosen:** auto-capture. A 3 s countdown with beeps follows 0.8 s of stillness. A failing check only cancels it if it lasts more than 0.5 s, so a check flickering at its threshold doesn't restart it endlessly (found in E2E testing).

### 3. Models and landmark quality
Lite (VIDEO mode) drives the live checklist. When the countdown ends, 5 frames about 120 ms apart are analysed with **Full** (IMAGE mode), and the per-landmark **median** is stored. That removes single-frame jitter and helps the spec's test–retest target (< 15% variance). The frame-to-frame spread is stored as a quality signal.

### 4. Level check
The phone's tilt comes from `DeviceMotionEvent.accelerationIncludingGravity`, using ratios to the y axis so it reads the same whatever gravity sign the platform uses. iOS asks for permission from the Start tap. **Roll ≤ 2°** (it skews left/right height comparisons directly). **Pitch ≤ 5°** (it only changes proportions slightly, and propped phones lean). If there's no motion data, the check shows "can't check" and doesn't block. Tilt is stored so the analysis can correct for it.

### 5. What is stored
Only landmarks: 33 normalized + 33 world landmarks per view, plus frame size, tilt, frame count, spread and (side view) which side faced the camera. **No image is ever written to storage.** The captured frame lives in memory for review and is dropped. Stored in IndexedDB (`postureScans`, DB v3), included in the JSON export and in "Delete all data".

## Consequences
- The next roadmap item (landmark metrics → findings) can run on stored scans without any new capture.
- Side-view and real-person accuracy can only be judged on a phone with a real person. Headless tests used 1900s studio photos.
- Revisit 1 if users find the front camera too blurry in gym lighting. Revisit 4 if 2° roll proves too fiddly to hit with a propped phone (the alternative is to correct roll mathematically and loosen the gate).
