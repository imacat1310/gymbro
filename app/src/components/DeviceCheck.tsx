import { useEffect, useRef, useState } from 'react'
import { runDeviceChecks, type CheckResult } from '../lib/deviceCheck'

const ICON = { ok: '✅', warn: '⚠️', fail: '❌' } as const

export function DeviceCheck() {
  const [results, setResults] = useState<CheckResult[] | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const rerun = () => runDeviceChecks().then(setResults)
    rerun()
    // Re-check once the service worker takes control (first launch of the installed app).
    navigator.serviceWorker?.addEventListener('controllerchange', rerun)
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', rerun)
  }, [])

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [stream])

  async function toggleCamera() {
    if (stream) {
      setStream(null)
      return
    }
    setCameraError(null)
    try {
      setStream(await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      }))
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section className="card">
      <h2>Device check</h2>
      <p className="muted">Confirms this phone supports everything GymBro needs.</p>
      {!results && <p>Checking…</p>}
      {results && (
        <ul className="checks">
          {results.map((r) => (
            <li key={r.id} className={r.status}>
              <span className="icon">{ICON[r.status]}</span>
              <div>
                <div className="label">{r.label}</div>
                <div className="muted small">{r.detail} · <em>{r.neededFor}</em></div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button onClick={toggleCamera}>{stream ? 'Stop camera' : 'Test camera'}</button>
      {cameraError && <p className="error">Camera error: {cameraError}</p>}
      {stream && <video ref={videoRef} className="preview" autoPlay playsInline muted />}
    </section>
  )
}
