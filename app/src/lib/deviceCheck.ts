// Checks the browser features GymBro depends on (see decisions/ADR-001).
export type CheckStatus = 'ok' | 'warn' | 'fail'

export interface CheckResult {
  id: string
  label: string
  status: CheckStatus
  detail: string
  neededFor: string
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function check(id: string, label: string, ok: boolean, neededFor: string, okDetail: string, failDetail: string, failStatus: CheckStatus = 'fail'): CheckResult {
  return { id, label, status: ok ? 'ok' : failStatus, detail: ok ? okDetail : failDetail, neededFor }
}

export async function runDeviceChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  results.push(check('secure', 'Secure context (HTTPS)', window.isSecureContext,
    'Camera, service worker', 'Served over HTTPS', 'Not HTTPS: camera and offline will not work'))

  results.push(check('standalone', 'Installed to home screen', isStandalone(),
    'Full-screen app, push notifications on iOS', 'Running as installed app',
    'Running in browser tab. Install for the full experience', 'warn'))

  // The service worker registers after window load, so wait for it instead of reading controller immediately.
  let swActive = false
  if ('serviceWorker' in navigator) {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    const reg = await Promise.race([navigator.serviceWorker.ready, timeout])
    swActive = !!reg?.active
  }
  results.push(check('sw', 'Offline support (service worker)', swActive,
    'Offline workouts',
    navigator.serviceWorker?.controller ? 'Active: app is cached for offline use' : 'Installed: app is cached for offline use',
    'Not ready yet. Close and reopen the app', 'warn'))

  results.push(check('camera', 'Camera API', !!navigator.mediaDevices?.getUserMedia,
    'Equipment scan, posture scan, form check', 'Available', 'Unavailable'))

  results.push(check('recorder', 'Video recording', typeof MediaRecorder !== 'undefined',
    'Form check', 'MediaRecorder available', 'Unavailable'))

  const gl = document.createElement('canvas').getContext('webgl2')
  results.push(check('webgl2', 'GPU (WebGL2)', !!gl,
    'Fast pose detection (MediaPipe GPU)', 'Available', 'Unavailable: pose detection will fall back to CPU (slow)', 'warn'))

  results.push(check('wakelock', 'Keep screen awake', 'wakeLock' in navigator,
    'Rest timer during workouts', 'Wake Lock API available', 'Unavailable: screen may sleep mid-session', 'warn'))

  let persisted = false
  if (navigator.storage?.persist) {
    persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist())
  }
  results.push(check('storage', 'Persistent storage', persisted,
    'Workout history not evicted', 'Granted', 'Not granted (usually granted once installed)', 'warn'))

  results.push(check('push', 'Push notifications', 'PushManager' in window,
    'Rest-end alert when phone locked',
    'Available', isIOS() ? 'Install to home screen first (iOS 16.4+)' : 'Unavailable', 'warn'))

  results.push(check('vibrate', 'Vibration', 'vibrate' in navigator,
    'Haptic rest-end alert', 'Available',
    isIOS() ? 'Not supported on iPhone (expected). Sound + screen flash are used instead' : 'Unavailable', 'warn'))

  return results
}
