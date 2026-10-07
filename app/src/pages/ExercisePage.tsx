import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router'
import { LineChart } from '../components/LineChart'
import { EQUIPMENT_BY_ID } from '../data/equipment'
import { EXERCISE_BY_ID, PATTERN_LABELS } from '../data/exercises'
import { exerciseHistory } from '../db/repo'
import { formatDate } from '../lib/hooks'
import { fmtKg } from '../lib/progression'
import { bestE1rm } from '../lib/stats'

const label = (id: string) => id.replace(/_/g, ' ')

export function ExercisePage() {
  const { id = '' } = useParams()
  const ex = EXERCISE_BY_ID.get(id)
  const history = useLiveQuery(() => exerciseHistory(id), [id])

  if (!ex) return <div className="page"><p>Exercise not found.</p></div>

  const loadBased = ex.measure === 'reps' && ex.load !== 'bodyweight' && ex.load !== 'band'
  const points = (history ?? [])
    .map((h) => ({ x: h.date, y: Math.round(bestE1rm(h.sets) * 10) / 10 }))
    .filter((p) => p.y > 0)
    .reverse()
  const best = points.reduce((m, p) => Math.max(m, p.y), 0)

  return (
    <div className="page">
      <header className="page-head">
        <h1>{ex.name}</h1>
        <p className="muted">{PATTERN_LABELS[ex.pattern]} · {ex.primary.map(label).join(', ')}{ex.secondary.length ? ` (+ ${ex.secondary.map(label).join(', ')})` : ''}</p>
      </header>

      {loadBased && points.length > 0 && (
        <section className="card stack">
          <div className="chart-head">
            <h2>Estimated 1RM</h2>
            <div className="muted small">Best {fmtKg(best)}</div>
          </div>
          {points.length >= 2
            ? <LineChart points={points} label={`Estimated 1RM for ${ex.name} over time`} formatX={(x) => formatDate(x)} formatY={(y) => `${+y.toFixed(1)} kg`} />
            : <p className="muted small">Log this exercise in another session to see your trend.</p>}
        </section>
      )}

      <section className="card stack">
        <h2>How to do it</h2>
        <ul className="bullets">{ex.cues.map((c) => <li key={c}>{c}</li>)}</ul>
        <p className="muted small">
          Needs: {ex.requires.map((g) => (g.length ? g.map((e) => EQUIPMENT_BY_ID.get(e)?.name ?? e).join(' + ') : 'no equipment')).join(' or ')}
        </p>
      </section>

      <section className="card stack">
        <h2>History</h2>
        {history?.length === 0 && <p className="muted">Not logged yet.</p>}
        {history?.map((h) => (
          <Link key={h.sessionId} to={`/session/${h.sessionId}`} className="history-row">
            <span>{formatDate(h.date)}</span>
            <span className="muted small">
              {h.sets.map((s) => (s.weightKg ? `${+s.weightKg.toFixed(2)}×${s.reps}` : `${s.reps}${ex.measure === 'time' ? 's' : ''}`)).join(', ')}
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}
