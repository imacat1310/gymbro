import { useEffect, useRef } from 'react'
import type { Session } from '../db/db'
import { clearRest, extendRest } from '../db/repo'
import { beep } from '../lib/alerts'
import { formatDuration, useNow } from '../lib/hooks'

/** Rest countdown computed from the stored end timestamp, so it stays correct after backgrounding. */
export function RestBar({ session }: { session: Session }) {
  const now = useNow(250)
  const alertedFor = useRef<number | undefined>(undefined)
  const endsAt = session.restEndsAt
  const remaining = endsAt ? endsAt - now : 0

  useEffect(() => {
    if (!endsAt || remaining > 0 || alertedFor.current === endsAt) return
    alertedFor.current = endsAt
    // Back from a long background: skip the alarm, just clear it.
    if (remaining > -60_000) beep()
    // Not cancelled on re-render: this effect re-runs every tick, and clearing a finished rest is harmless.
    setTimeout(() => void clearRest(session.id, endsAt), remaining > -60_000 ? 3000 : 0)
  }, [endsAt, remaining, session.id])

  if (!endsAt) return null
  const total = (session.restTotalSec ?? 1) * 1000
  const flash = remaining <= 0 && remaining > -1500
  const pct = Math.min(100, Math.max(0, (1 - remaining / total) * 100))

  return (
    <div className={`restbar ${flash ? 'flash' : ''} ${remaining <= 0 ? 'done' : ''}`} role="timer" aria-live="polite">
      <div className="restbar-fill" style={{ width: `${pct}%` }} />
      <div className="restbar-content">
        <span className="restbar-label">{remaining > 0 ? 'Rest' : 'Go!'}</span>
        <span className="restbar-time">{remaining > 0 ? formatDuration(remaining + 999) : '0:00'}</span>
        <button className="ghost" onClick={() => void extendRest(session.id, 30)}>+30s</button>
        <button className="ghost" onClick={() => void clearRest(session.id)}>Skip</button>
      </div>
    </div>
  )
}
