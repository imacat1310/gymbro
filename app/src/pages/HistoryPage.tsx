import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EXERCISE_BY_ID } from '../data/exercises'
import { db } from '../db/db'
import { formatDate, formatDuration } from '../lib/hooks'
import { fmtKg } from '../lib/progression'
import { bestE1rm, volumeKg } from '../lib/stats'
import { usePlanReports } from '../lib/progress/usePlanReports'
import { VERDICT_LABEL } from '../lib/progress/planReport'

export function HistoryPage() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'sessions' | 'exercises' | 'plans'>(params.get('tab') === 'plans' ? 'plans' : 'sessions')
  const reports = usePlanReports()
  const data = useLiveQuery(async () => {
    const sessions = await db.sessions.orderBy('startedAt').reverse().filter((s) => !!s.endedAt).toArray()
    const sets = await db.sets.toArray()
    return { sessions, sets }
  }, [])

  if (!data) return null
  const { sessions, sets } = data

  const byExercise = new Map<string, typeof sets>()
  for (const s of sets) {
    if (s.kind !== 'working') continue
    byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s])
  }

  return (
    <div className="page">
      <header className="page-head"><h1>History</h1></header>
      <nav className="tabs">
        <button className={tab === 'sessions' ? 'active' : ''} onClick={() => setTab('sessions')}>Workouts</button>
        <button className={tab === 'exercises' ? 'active' : ''} onClick={() => setTab('exercises')}>Exercises</button>
        <button className={tab === 'plans' ? 'active' : ''} onClick={() => setTab('plans')}>Plans</button>
      </nav>

      {tab === 'plans' && (
        <section className="stack">
          {!reports?.length && <p className="muted">No plans yet. Build one on the Plan tab.</p>}
          {reports?.map(({ plan, report: r }) => (
            <Link key={plan.id} to={`/history/plan/${plan.id}`} className="card list-card">
              <div className="day-head">
                <strong>{plan.name}</strong>
                {r.window.finished ? <span className={`sev-chip verdict-chip verdict-${r.verdict}`}>{VERDICT_LABEL[r.verdict]}</span> : <span className="sev-chip">Week {r.window.week} of {r.window.weeks}</span>}
              </div>
              <div className="muted small">{formatDate(r.window.start)} – {formatDate(r.window.end)} · {r.workouts.done} workouts</div>
              <div className="small">{r.basis}</div>
            </Link>
          ))}
        </section>
      )}

      {tab === 'sessions' && (
        <section className="stack">
          {sessions.length === 0 && <p className="muted">No workouts yet. Start one from Today.</p>}
          {sessions.map((s) => {
            const own = sets.filter((x) => x.sessionId === s.id)
            return (
              <Link key={s.id} to={`/session/${s.id}`} className="card list-card">
                <div><strong>{formatDate(s.startedAt)}</strong></div>
                <div className="muted small">
                  {formatDuration((s.endedAt ?? s.startedAt) - s.startedAt)} · {own.filter((x) => x.kind === 'working').length} sets · {Math.round(volumeKg(own)).toLocaleString()} kg
                </div>
                <div className="small">{s.entries.map((e) => EXERCISE_BY_ID.get(e.exerciseId)?.name).filter(Boolean).join(', ')}</div>
              </Link>
            )
          })}
        </section>
      )}

      {tab === 'exercises' && (
        <section className="stack">
          {byExercise.size === 0 && <p className="muted">No exercises logged yet.</p>}
          {[...byExercise.entries()]
            .sort((a, b) => b[1].length - a[1].length)
            .map(([id, list]) => {
              const ex = EXERCISE_BY_ID.get(id)
              const best = bestE1rm(list)
              return (
                <Link key={id} to={`/exercise/${id}`} className="card list-card">
                  <strong>{ex?.name ?? id}</strong>
                  <div className="muted small">
                    {new Set(list.map((s) => s.sessionId)).size} workouts · {list.length} sets
                    {best > 0 && ex?.measure === 'reps' ? ` · best e1RM ${fmtKg(Math.round(best * 10) / 10)}` : ''}
                  </div>
                </Link>
              )
            })}
        </section>
      )}
    </div>
  )
}
