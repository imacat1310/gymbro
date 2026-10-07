import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { EntryCard } from '../components/EntryCard'
import { ExercisePicker } from '../components/ExercisePicker'
import { RestBar } from '../components/RestBar'
import { db } from '../db/db'
import { addEntry, discardSession, finishSession } from '../db/repo'
import { formatDuration, useActiveSession, useNow, useSettings, useWakeLock } from '../lib/hooks'

export function WorkoutPage() {
  const session = useActiveSession()
  const settings = useSettings()
  const navigate = useNavigate()
  const now = useNow(1000)
  const [picking, setPicking] = useState(false)
  const sets = useLiveQuery(() => (session ? db.sets.where('sessionId').equals(session.id).sortBy('completedAt') : []), [session?.id])
  const gym = useLiveQuery(() => (session?.gymId ? db.gyms.get(session.gymId) : undefined), [session?.gymId])
  useWakeLock(!!session)

  if (session === undefined || settings === undefined) return null
  if (session === null) return <Navigate to="/" replace />

  const workingCount = sets?.filter((s) => s.kind === 'working').length ?? 0

  async function finish() {
    if (!session) return
    if (!sets?.length) {
      if (confirm('No sets logged. Discard this workout?')) {
        await discardSession(session.id)
        navigate('/')
      }
      return
    }
    if (!confirm('Finish this workout?')) return
    await finishSession(session.id)
    navigate(`/session/${session.id}`, { replace: true })
  }

  return (
    <div className="page workout">
      <header className="workout-head">
        <div>
          <div className="muted small">{gym?.name ?? 'Workout'}</div>
          <div className="elapsed">{formatDuration(now - session.startedAt)}</div>
        </div>
        <div className="muted small">{workingCount} sets</div>
        <button onClick={finish}>Finish</button>
      </header>

      {session.entries.length === 0 && (
        <div className="card empty">
          <p>Add your first exercise to start logging.</p>
        </div>
      )}

      {session.entries.map((entry) => (
        <EntryCard
          key={entry.key}
          sessionId={session.id}
          entry={entry}
          sets={sets?.filter((s) => s.entryKey === entry.key) ?? []}
          experience={settings.profile.experience}
        />
      ))}

      <button className="secondary wide" onClick={() => setPicking(true)}>+ Add exercise</button>

      {picking && (
        <ExercisePicker
          equipment={gym?.equipment ?? []}
          onClose={() => setPicking(false)}
          onPick={(id) => { void addEntry(session.id, id); setPicking(false) }}
        />
      )}
      <RestBar session={session} />
    </div>
  )
}
