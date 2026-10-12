// Goals (Design.md "Goals and badges", ADR-018): lift goals tracked by estimated one-rep max, body goals by InBody.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { Why } from '../components/Why'
import { EXERCISES } from '../data/exercises'
import { db } from '../db/db'
import { addGoal, deleteGoal } from '../db/repo'
import { formatDate } from '../lib/hooks'
import { BODY_METRICS, evaluateGoal, type BodyMetric, type GoalStatus, type Pace } from '../lib/progress/goals'

const PACE: Record<Pace, string> = { ahead: 'Ahead of pace', on_track: 'On track', behind: 'Behind pace', missed: 'Deadline passed' }
const fmt = (v: number | undefined, unit: string) => (v === undefined ? '–' : `${v}${unit === '%' ? '%' : ` ${unit.replace(' e1RM', '')}`}`)
const toDate = (s: string) => (s ? new Date(`${s}T23:59:00`).getTime() : undefined)

export function GoalCard({ status, onDelete }: { status: GoalStatus & { kind: 'lift' | 'body'; deadline?: number }; onDelete?: () => void }) {
  const pct = Math.round((status.progress ?? 0) * 100)
  return (
    <section className={`card stack goal ${status.achieved ? 'done' : ''}`}>
      <div className="day-head">
        <h2>{status.title}</h2>
        {status.achieved ? <span className="sev-chip goal-chip">Reached</span> : status.pace && <span className={`sev-chip pace-${status.pace}`}>{PACE[status.pace]}</span>}
      </div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div>
      <div className="goal-nums small">
        <span>Start {fmt(status.start, status.unit)}</span>
        <span className="data">Now {fmt(status.current, status.unit)}</span>
        <span>Target {fmt(status.target, status.unit)}</span>
      </div>
      <p className="muted small">
        {status.achieved ? `Reached ${formatDate(status.achievedAt!)}.`
          : status.current === undefined ? (status.kind === 'lift' ? 'Log this exercise to start tracking.' : 'Log an InBody result to start tracking.')
            : `${pct}% of the way${status.deadline ? ` · deadline ${formatDate(status.deadline)}` : ''}.`}
        {status.kind === 'lift' && ' Measured as an estimated one-rep max.'}
      </p>
      <Why codes={status.kind === 'lift' ? ['goal_lift', ...(status.deadline ? ['goal_pace' as const] : [])] : ['goal_body', ...(status.deadline ? ['goal_pace' as const] : [])]} />
      {onDelete && <button className="ghost small" onClick={onDelete}>Delete goal</button>}
    </section>
  )
}

export function GoalsPage() {
  const data = useLiveQuery(async () => {
    const [goals, sets, comps] = await Promise.all([db.goals.orderBy('createdAt').toArray(), db.sets.toArray(), db.bodyComps.toArray()])
    const now = Date.now()
    const trained = new Set(sets.filter((s) => s.weightKg > 0).map((s) => s.exerciseId))
    return { list: goals.map((g) => ({ goal: g, status: { ...evaluateGoal(g, sets, comps, now), kind: g.kind, deadline: g.deadline } })), trained }
  }, [])
  const [kind, setKind] = useState<'lift' | 'body'>('lift')
  const [exerciseId, setExerciseId] = useState('barbell_bench_press')
  const [kg, setKg] = useState('')
  const [reps, setReps] = useState('1')
  const [metric, setMetric] = useState<BodyMetric>('pbf')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  if (!data) return null

  const weighted = EXERCISES.filter((e) => e.measure === 'reps' && e.load !== 'bodyweight' && e.load !== 'band')
  const yours = weighted.filter((e) => data.trained.has(e.id)).sort((a, b) => a.name.localeCompare(b.name))
  const others = weighted.filter((e) => !data.trained.has(e.id)).sort((a, b) => a.name.localeCompare(b.name))
  const valid = kind === 'lift' ? Number(kg) > 0 && Number(reps) >= 1 && Number(reps) <= 20 : Number(target) > 0

  async function save() {
    if (kind === 'lift') await addGoal({ kind, exerciseId, targetKg: Number(kg), targetReps: Math.round(Number(reps)), deadline: toDate(deadline) })
    else await addGoal({ kind, metric, target: Number(target), deadline: toDate(deadline) })
    setKg(''); setTarget(''); setDeadline('')
  }

  const active = data.list.filter((x) => !x.status.achieved)
  const done = data.list.filter((x) => x.status.achieved)
  return (
    <div className="page">
      <header className="page-head">
        <h1>Goals</h1>
        <p className="muted">{active.length} active · {done.length} reached</p>
      </header>

      {active.map(({ goal, status }) => <GoalCard key={goal.id} status={status} onDelete={() => { if (confirm('Delete this goal?')) void deleteGoal(goal.id) }} />)}

      <section className="card stack">
        <h2>New goal</h2>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={kind === 'lift'} className={kind === 'lift' ? 'active' : ''} onClick={() => setKind('lift')}>Lift</button>
          <button role="tab" aria-selected={kind === 'body'} className={kind === 'body' ? 'active' : ''} onClick={() => setKind('body')}>Body</button>
        </div>
        {kind === 'lift' ? (
          <>
            <label className="field">Exercise
              <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
                {yours.length > 0 && <optgroup label="You've trained">{yours.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>}
                <optgroup label="All exercises">{others.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>
              </select>
            </label>
            <div className="row">
              <label className="field">Weight (kg)<input inputMode="decimal" value={kg} placeholder="100" onChange={(e) => setKg(e.target.value.replace(',', '.'))} /></label>
              <label className="field">Reps<input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></label>
            </div>
          </>
        ) : (
          <div className="row">
            <label className="field">Measure
              <select value={metric} onChange={(e) => setMetric(e.target.value as BodyMetric)}>
                {(Object.keys(BODY_METRICS) as BodyMetric[]).map((m) => <option key={m} value={m}>{BODY_METRICS[m].label} ({BODY_METRICS[m].unit})</option>)}
              </select>
            </label>
            <label className="field">Target<input inputMode="decimal" value={target} placeholder={metric === 'pbf' ? '15' : '70'} onChange={(e) => setTarget(e.target.value.replace(',', '.'))} /></label>
          </div>
        )}
        <label className="field">Deadline (optional)<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
        <button onClick={() => void save()} disabled={!valid}>Add goal</button>
        <p className="muted small">{kind === 'lift' ? 'Any weight × reps that reaches the same estimated one-rep max counts.' : 'Tracked against your InBody results (Profile → Body composition).'}</p>
      </section>

      {done.length > 0 && (
        <>
          <h2 className="section-title">Reached</h2>
          {done.map(({ goal, status }) => <GoalCard key={goal.id} status={status} onDelete={() => { if (confirm('Delete this goal?')) void deleteGoal(goal.id) }} />)}
        </>
      )}
      <Link to="/profile" className="button secondary">Back</Link>
    </div>
  )
}
