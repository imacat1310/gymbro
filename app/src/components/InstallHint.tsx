import { useEffect, useState } from 'react'
import { isIOS, isStandalone } from '../lib/deviceCheck'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

export function InstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (isStandalone()) return null

  if (deferred) {
    return (
      <div className="card hint">
        <p>Install GymBro on your home screen for full-screen use and offline workouts.</p>
        <button onClick={() => deferred.prompt().then(() => setDeferred(null))}>Install app</button>
      </div>
    )
  }

  if (isIOS()) {
    return (
      <div className="card hint">
        <p><strong>Install on iPhone:</strong> open this page in <strong>Safari</strong>, tap the <strong>Share</strong> button, then <strong>Add to Home Screen</strong>.</p>
      </div>
    )
  }

  return (
    <div className="card hint">
      <p><strong>Install:</strong> open the browser menu (⋮) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
    </div>
  )
}
