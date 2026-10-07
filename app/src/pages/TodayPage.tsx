import { useLiveQuery } from 'dexie-react-hooks'
import { Link, Navigate, useNavigate } from 'react-router'
import { db } from '../db/db'
import { startSession } from '../db/repo'
import { formatDate, formatDuration, useActiveGym, useActiveSession, useNow, useSettings } from '../lib/hooks'
import { GOAL_LABELS } from '../lib/targets'
import { InstallHint } from '../components/InstallHint'
import { volumeKg } from '../lib/stats'

const WEEK = 7 * 24 * 3600 * 1000

export function TodayPage() {
  const settings = useSettings()
  const gym = useActiveGym()
  const active = useActiveSession()
  const navigate = useNavigate()
  const now = useNow(1000)
  const recent = useLiveQuery(async () => {
    const sessions = await db.sessions.orderBy('startedAt').reverse().filter((s) => !!s.endedAt).limit(20).toArray()
    return Promise.all(sessions.map(async (s) => ({ session: s, sets: await db.sets.where('sessionId').equals(s.id).toArray() })))
  }, [])

  if (!settings) return null
  if (!settings.onboarded) return <Navigate to="/welcome" replace />

  const thisWeek = recent?.filter((r) => now - r.session.startedAt < WEEK) ?? []
  const weekVolume = thisWeek.reduce((sum, r) => sum + volumeKg(r.sets), 0)

  return (
    <div className="page">
      <header className="page-head">
        <h1>Today</h1>
        <p className="muted">{GOAL_LABELS[settings.profile.goal]} · {gym?.name ?? 'No gym selected'}</p>
      </header>

      <InstallHint />

      {active ? (
        <Link to="/workout" className="card hero-card">
          <div className="muted small">Workout in progress</div>
          <div className="hero-number">{formatDuration(now - active.startedAt)}</div>
          <div>{active.entries.length} exercises · tap to continue</div>
        </Link>
      ) : (
        <section className="card hero-card">
          <p>Ready to train?</p>
          <button className="wide" onClick={async () => { await startSession(); navigate('/workout') }}>Start workout</button>
          <p className="muted small">Personalised plans come in the next phase. For now, add exercises as you go and GymBro suggests the weight.</p>
        </section>
      )}

      <section className="stat-row">
        <div className="card stat"><div className="stat-value">{thisWeek.length}</div><div className="muted small">workouts this week</div></div>
        <div className="card stat"><div className="stat-value">{Math.round(weekVolume).toLocaleString()}</div><div className="muted small">kg lifted this week</div></div>
      </section>

      {recent && recent.length > 0 && (
        <section className="stack">
          <h2>Recent</h2>
          {recent.slice(0, 3).map(({ session, sets }) => (
            <Link key={session.id} to={`/session/${session.id}`} className="card list-card">
              <div><strong>{formatDate(session.startedAt)}</strong></div>
              <div className="muted small">
                {session.entries.length} exercises · {sets.filter((s) => s.kind === 'working').length} sets · {formatDuration((session.endedAt ?? session.startedAt) - session.startedAt)}
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
