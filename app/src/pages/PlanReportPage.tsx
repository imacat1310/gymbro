// Plan report (Design.md "History: finished plan → goal reached or not", ADR-019).
import { Link, useParams } from 'react-router'
import { Why } from '../components/Why'
import { EXERCISE_BY_ID } from '../data/exercises'
import { formatDate } from '../lib/hooks'
import { VERDICT_LABEL, type Change } from '../lib/progress/planReport'
import { usePlanReports } from '../lib/progress/usePlanReports'
import { GOAL_LABELS } from '../lib/targets'

const sign = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v * 10) / 10)}`
const good = (c: Change) => (c.better === 'up' ? c.after > c.before : c.after < c.before)

export function PlanReportPage() {
  const { id } = useParams()
  const data = usePlanReports(id)
  if (!data) return null
  const entry = data[0]
  if (!entry) return <div className="page"><p>Plan not found.</p><Link to="/history">Back to history</Link></div>
  const { plan, report: r } = entry
  return (
    <div className="page">
      <header className="page-head">
        <h1>Plan report</h1>
        <p className="muted">{plan.name} · {formatDate(r.window.start)} – {formatDate(r.window.end)}{r.window.finished ? '' : ' (in progress)'}</p>
      </header>

      <section className={`card stack verdict verdict-${r.verdict}`}>
        <div className="coach-tag">{GOAL_LABELS[r.goal]}</div>
        <div className="verdict-title">{VERDICT_LABEL[r.verdict]}</div>
        <p className="small">{r.basis}</p>
        <Why codes={[r.why]} label="How this is judged" />
      </section>

      <section className="card stack">
        <h2>Workouts</h2>
        <div className="progress" role="progressbar" aria-valuenow={Math.round(r.workouts.adherence * 100)}><div style={{ width: `${Math.round(r.workouts.adherence * 100)}%` }} /></div>
        <p className="small data">{r.workouts.done} of {r.workouts.planned} planned · {Math.round(r.workouts.adherence * 100)}%</p>
      </section>

      <section className="card stack">
        <h2>Strength</h2>
        {r.lifts.length ? (
          <ul className="change-list">
            {r.lifts.map((l) => (
              <li key={l.exerciseId}>
                <span>{EXERCISE_BY_ID.get(l.exerciseId)?.name ?? l.exerciseId}</span>
                <span className="data">{l.before} → {l.after} kg</span>
                <span className={`data ${l.pct > 0 ? 'up' : l.pct < 0 ? 'down' : ''}`}>{sign(l.pct)}%</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">Main lifts need at least two sessions in the plan to compare.</p>}
        {r.lifts.length > 0 && <p className="muted small">Estimated one-rep max, first session vs last.</p>}
      </section>

      <section className="card stack">
        <h2>Body</h2>
        {r.body.length ? (
          <ul className="change-list">
            {r.body.map((c) => (
              <li key={c.label}>
                <span>{c.label}</span>
                <span className="data">{c.before} → {c.after} {c.unit}</span>
                <span className={`data ${good(c) ? 'up' : c.after === c.before ? '' : 'down'}`}>{sign(c.after - c.before)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">Log an InBody result near the start and the end of a plan to see body changes.</p>}
        {r.posture ? (
          <p className="small">Posture scan: {r.posture.before} → {r.posture.after} finding{r.posture.after === 1 ? '' : 's'}{r.posture.after < r.posture.before ? ', improving' : r.posture.after > r.posture.before ? ', worth a look' : ''}.</p>
        ) : <p className="muted small">Do a posture scan at the start and end of a plan to compare posture.</p>}
      </section>

      <section className="card stack">
        <h2>Goals reached</h2>
        {r.goalsReached.length ? <ul className="bullets small">{r.goalsReached.map((g) => <li key={g}>{g}</li>)}</ul> : <p className="muted small">No goals reached during this plan.</p>}
      </section>

      <Link to="/history?tab=plans" className="button secondary">Back</Link>
    </div>
  )
}
