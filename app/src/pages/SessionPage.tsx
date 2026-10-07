import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router'
import { EXERCISE_BY_ID } from '../data/exercises'
import { db } from '../db/db'
import { discardSession, exerciseHistory, toLogged } from '../db/repo'
import { formatDate, formatDuration, useNow } from '../lib/hooks'
import { fmtKg, suggestNext } from '../lib/progression'
import { findPRs, volumeKg } from '../lib/stats'

const FEELS = ['😫', '😕', '🙂', '😀', '🔥']

export function SessionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const now = useNow(1000)
  const data = useLiveQuery(async () => {
    const session = await db.sessions.get(id)
    if (!session) return null
    const sets = await db.sets.where('sessionId').equals(id).sortBy('completedAt')
    const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))]
    const earlier = (await db.sets.where('completedAt').below(session.startedAt).toArray()).filter((s) => exerciseIds.includes(s.exerciseId))
    const next = await Promise.all(session.entries.map(async (entry) => {
      const ex = EXERCISE_BY_ID.get(entry.exerciseId)
      if (!ex) return null
      const history = await exerciseHistory(ex.id)
      if (!history.length) return null
      return { name: ex.name, suggestion: suggestNext(ex, entry.target, history.map((h) => h.sets.map(toLogged))) }
    }))
    return { session, sets, prs: findPRs(sets, earlier), next: next.filter((n) => n !== null) }
  }, [id])

  if (data === undefined) return null
  if (data === null) return <div className="page"><p>Workout not found.</p><Link to="/history">Back to history</Link></div>

  const { session, sets, prs, next } = data
  const working = sets.filter((s) => s.kind === 'working')
  const duration = (session.endedAt ?? now) - session.startedAt

  return (
    <div className="page">
      <header className="page-head">
        <h1>{session.endedAt ? 'Workout summary' : 'Workout'}</h1>
        <p className="muted">{formatDate(session.startedAt)}</p>
      </header>

      <section className="stat-row three">
        <div className="card stat"><div className="stat-value">{formatDuration(duration)}</div><div className="muted small">duration</div></div>
        <div className="card stat"><div className="stat-value">{working.length}</div><div className="muted small">sets</div></div>
        <div className="card stat"><div className="stat-value">{Math.round(volumeKg(sets)).toLocaleString()}</div><div className="muted small">kg volume</div></div>
      </section>

      {prs.length > 0 && (
        <section className="card stack">
          <h2>🏆 Personal records</h2>
          <ul className="bullets">
            {prs.map((p, i) => (
              <li key={i}>
                <strong>{EXERCISE_BY_ID.get(p.exerciseId)?.name}</strong>: {p.kind === 'e1rm' ? 'estimated 1RM' : 'heaviest weight'} {fmtKg(Math.round(p.value * 10) / 10)}
                <span className="muted"> (was {fmtKg(Math.round(p.previous * 10) / 10)})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {session.endedAt && (
        <section className="card stack">
          <h2>How did it feel?</h2>
          <div className="chips feel">
            {FEELS.map((f, i) => (
              <button key={i} className={`chip ${session.feel === i + 1 ? 'on' : ''}`} aria-label={`Feel ${i + 1} of 5`}
                onClick={() => void db.sessions.update(session.id, { feel: i + 1 })}>{f}</button>
            ))}
          </div>
        </section>
      )}

      <section className="card stack">
        <h2>Exercises</h2>
        {session.entries.map((entry) => {
          const ex = EXERCISE_BY_ID.get(entry.exerciseId)
          const own = sets.filter((s) => s.entryKey === entry.key && s.kind === 'working')
          if (!ex) return null
          return (
            <div key={entry.key}>
              <Link to={`/exercise/${ex.id}`}><strong>{ex.name}</strong></Link>
              <div className="muted small">
                {own.length ? own.map((s) => (s.weightKg ? `${+s.weightKg.toFixed(2)}×${s.reps}` : `${s.reps}${ex.measure === 'time' ? 's' : ''}`)).join(', ') : 'No sets'}
              </div>
            </div>
          )
        })}
      </section>

      {next.length > 0 && session.endedAt && (
        <section className="card stack">
          <h2>Next time</h2>
          {next.map((n, i) => (
            <div key={i}>
              <strong>{n.name}</strong>{n.suggestion.weightKg !== null && n.suggestion.weightKg > 0 && <> · {fmtKg(n.suggestion.weightKg)} × {n.suggestion.reps}</>}
              <div className="muted small">{n.suggestion.reason}</div>
            </div>
          ))}
        </section>
      )}

      <div className="row">
        <Link to="/" className="button">Done</Link>
        {session.endedAt && (
          <button className="danger" onClick={async () => {
            if (confirm('Delete this workout permanently?')) { await discardSession(session.id); navigate('/history', { replace: true }) }
          }}>Delete workout</button>
        )}
      </div>
    </div>
  )
}
