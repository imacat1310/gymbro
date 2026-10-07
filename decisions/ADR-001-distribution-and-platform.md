# ADR-001: Distribution & App Platform

- **Date:** 2026-10-08
- **Status:** Accepted (2026-10-08, confirmed by user). Native install over cable via Xcode was also considered; it remains possible later through the Capacitor wrap.
- **Roadmap item:** Phase 0: choose app framework

## Context
GymBro must run on iPhone and Android phones **without publishing to the App Store or Google Play**. It needs:
- Camera access for photos (equipment and posture scans) and video (form check)
- On-device pose estimation at about 30 fps (MediaPipe)
- Offline workout logging
- A rest timer that alerts the user
- Data sync to a backend

Android allows installing apps from outside the store (sideloading APK files). **iOS is the hard part**: outside the App Store, native apps need either Apple developer signing, which expires, or a web app.

## Options

### Option A: Progressive Web App (PWA)
A website that the user "installs" with *Add to Home Screen*. It then opens full-screen like an app, works offline through a service worker, and can use the camera.
- **Pros:**
  - No store, no Apple developer account, no signing. Share a link and it's installed.
  - One codebase for iOS, Android and desktop.
  - Updates go live instantly for everyone.
  - MediaPipe has an official web version (`@mediapipe/tasks-vision`, GPU via WebGL) that runs pose detection in real time on modern phones.
  - Camera (`getUserMedia`), video recording (`MediaRecorder`), offline storage (IndexedDB), keeping the screen awake (Wake Lock API) and push notifications (iOS 16.4+ for installed PWAs) are all available.
  - Can be wrapped with Capacitor later (Option D) without a rewrite.
- **Cons:**
  - **Background limits on iOS:** JavaScript pauses when the screen locks or the app is backgrounded. The rest timer stays correct (it's computed from timestamps), but a sound or vibration at the end of rest needs either the screen kept awake or a server-sent push notification.
  - No vibration API on iOS Safari.
  - No HealthKit / Health Connect access.
  - Pose detection is somewhat slower than native (about 20–30 fps vs 30–60 fps on mid-range phones).
  - On iOS, the user must open the site in Safari and use Share → Add to Home Screen, a one-time manual step.
- **Works without app store:** ✅ Fully, on both platforms
- **Effort / cost:** S–M. Free to host (Vercel, Netlify or Cloudflare Pages). HTTPS is required for the camera, and those hosts include it.

### Option B: Native app (React Native / Expo), sideloaded
Build a real native app and install it directly on devices.
- **Pros:**
  - Best performance: native camera frame processors, 60 fps pose detection.
  - Full background support: real alarms, live activities, HealthKit.
  - Same codebase could later go to the stores.
- **Cons:**
  - **iOS sideloading is painful:**
    - *Free Apple ID + Xcode:* the app expires every **7 days**, a Mac is required, maximum 3 apps.
    - *Paid developer account ($99/yr), ad hoc distribution:* up to 100 registered devices, and you must collect each device's ID.
    - *TestFlight:* builds expire after 90 days, external testers need Beta App Review, and it still goes through Apple.
  - Android is easy: share the APK, and users allow "install unknown apps".
  - Slower update cycle (rebuild and reinstall) unless you add over-the-air updates (EAS Update).
  - Expo Go alone can't be used, because MediaPipe and camera frame processors need custom native code.
- **Works without app store:** ✅ Android / ⚠️ iOS (expiring or device-limited)
- **Effort / cost:** M–L. $99/yr for usable iOS distribution. A Mac is needed for iOS builds (or EAS cloud builds).

### Option C: Flutter, sideloaded
Same distribution story as Option B, using Dart/Flutter instead of React Native.
- **Pros:** Very smooth UI and good camera plugins. Google ML Kit pose detection is available as a plugin.
- **Cons:** Same iOS sideloading pain as Option B. Uses Dart instead of JavaScript (a smaller ecosystem for web reuse). The web build of Flutter is heavy and weak for camera and ML work.
- **Works without app store:** ✅ Android / ⚠️ iOS
- **Effort / cost:** M–L, $99/yr for iOS

### Option D: PWA now, wrap with Capacitor later if needed
Start with Option A. If a native-only need appears (reliable rest alarms, HealthKit), wrap the same web code with **Capacitor** into native shells and sideload them like Option B.
- **Pros:** Get on phones fastest with zero distribution friction. Keeps a path to native features without a rewrite.
- **Cons:** Wrapped builds inherit Option B's iOS signing pain for those users. Pose detection still runs in a WebView, not native.
- **Works without app store:** ✅
- **Effort / cost:** S now, plus M later if the wrap is needed

## Comparison
| Need | A: PWA | B: RN sideload | C: Flutter sideload | D: PWA → Capacitor |
|---|---|---|---|---|
| Install on iPhone without store | ✅ Add to Home Screen | ⚠️ 7-day expiry or $99 + device list | ⚠️ same | ✅ (PWA) |
| Install on Android without store | ✅ | ✅ APK | ✅ APK | ✅ |
| Camera photos / video | ✅ | ✅ | ✅ | ✅ |
| Real-time pose detection | ✅ ~20–30 fps | ✅✅ 30–60 fps | ✅ | ✅ |
| Offline logging | ✅ IndexedDB | ✅ SQLite | ✅ | ✅ |
| Rest alarm with screen locked | ⚠️ push notification only | ✅ | ✅ | ⚠️ → ✅ when wrapped |
| Health data integration | ❌ | ✅ | ✅ | ❌ → ✅ when wrapped |
| Update speed | ✅ instant | ⚠️ reinstall / OTA | ⚠️ | ✅ |
| Cost | Free | $99/yr (iOS) | $99/yr (iOS) | Free → $99 if wrapped |

## Recommendation
**Option D: build a PWA, and keep Capacitor as the upgrade path.**

The deciding reason is that the hard constraint (no store) is fully met on iPhone only by a PWA. Every core feature works in the browser: camera, MediaPipe pose, video recording, offline logging. The one real gap, a rest alarm while the screen is locked, has workable mitigations: keep the screen awake during workouts (Wake Lock) and send a server-scheduled push notification as backup.

Proposed stack:
| Layer | Choice |
|---|---|
| UI framework | React + TypeScript + Vite (or SvelteKit, decided in a later ADR) |
| PWA tooling | `vite-plugin-pwa` (Workbox service worker, manifest) |
| Pose | `@mediapipe/tasks-vision` Pose Landmarker (GPU delegate) |
| Camera/video | `getUserMedia` + `MediaRecorder` |
| Local DB | IndexedDB via Dexie.js; call `navigator.storage.persist()` |
| Backend | Supabase (Auth, Postgres, Storage, Edge Functions) |
| Hosting | Vercel / Netlify / Cloudflare Pages (HTTPS) |
| Push | Web Push (VAPID) from Supabase Edge Function |

## Consequences
- "Live cues" (form check v2) become *easier*: pose already runs on the live camera stream. Post-set analysis can reuse the landmarks captured while recording instead of decoding the video again.
- The rest timer design changes: it's timestamp-based, uses the Wake Lock API, and sends a web push at the end of rest (see [features/05-session-tracker.md](../features/05-session-tracker.md)).
- Health platform integration moves behind the Capacitor wrap (Phase 5).
- Payments (if any) go through Stripe on the web, with no App Store in-app purchase rules.
- **Revisit if:** web pose detection is below about 15 fps on target phones, or users strongly need lock-screen alarms or HealthKit.
