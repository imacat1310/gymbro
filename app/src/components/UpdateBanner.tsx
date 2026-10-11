// App updates (ADR-011). An installed iPhone app usually resumes instead of reloading, so it never asks the server
// for a new version by itself: check when the app comes back to the foreground and every 30 minutes. A new version
// waits until the user taps Update, so a reload never interrupts a posture capture or a trunk test.
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_EVERY_MS = 30 * 60 * 1000

export function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => { if (navigator.onLine) void registration.update().catch(() => {}) }
      setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
    },
  })

  // Expose the state for the E2E test and for support questions ("which version am I on?").
  useEffect(() => { document.documentElement.dataset.updateReady = String(needRefresh) }, [needRefresh])

  if (!needRefresh) return null
  return (
    <div className="update-banner" role="status">
      <span>New version available</span>
      <button onClick={() => void updateServiceWorker(true)}>Update</button>
    </div>
  )
}
