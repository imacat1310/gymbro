import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PlanSetup } from '../components/PlanSetup'
import { EXERCISE_BY_ID } from '../data/exercises'
import type { StoredPlan } from '../db/db'
import { DEFAULT_SCHEDULE, generatePlan, getActivePlan, nextPlanDayIndex, saveSettings, startSession, swapPlanExercise } from '../db/repo'
import { useActiveSession, useActiveGym, useSettings } from '../lib/hooks'
import { muscleLabel } from '../lib/planner'

const VOLUME_ORDER = ['chest', 'lats', 'upper_back', 'side_delt', 'rear_delt', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'] as const

export function PlanPage() {
  const settings = useSettings()
  const gym = useActiveGym()
  const active = useActiveSession()
  const navigate = useNavigate()
  const plan = useLiveQuery(async () => (await getActivePlan()) ?? null, [settings?.activePlanId])
  const nextDay = useLiveQuery(async () => (plan ? nextPlanDayIndex(plan) : 0), [plan?.id])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!settings || plan === undefined) return null
  const showSetup = editing || !plan

  async function regenerate() {
    setBusy(true)
    await generatePlan()
    setBusy(false)
    setEditing(false)
  }

  async function start(p: StoredPlan, dayIndex: number) {
    await startSession({ plan: p, dayIndex })
    navigate('/workout')
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Plan</h1>
        <p className="muted">{plan && !editing ? `${plan.splitName} · ${gym?.name ?? ''}` : 'Built from your goal, gym, schedule and body'}</p>
      </header>

      {showSetup && (
        <section className="card stack">
          <h2>{plan ? 'Change your plan' : 'Create your plan'}</h2>
          <PlanSetup
            schedule={settings.schedule ?? DEFAULT_SCHEDULE}
            limitations={settings.limitations ?? []}
            priorities={settings.priorities ?? []}
            onChange={(patch) => void saveSettings(patch)}
          />
          <p className="muted small">Goal, experience and intensity come from your <Link to="/more">training profile</Link>. Exercises come from the equipment at <Link to="/gym">{gym?.name ?? 'your gym'}</Link>.</p>
          <div className="row">
            {plan && <button className="secondary" onClick={() => setEditing(false)}>Cancel</button>}
            <button onClick={regenerate} disabled={busy || !gym}>{plan ? 'Rebuild plan' : 'Build my plan'}</button>
          </div>
        </section>
      )}

      {plan && !editing && (
        <>
          {plan.gymId && gym && plan.gymId !== gym.id && (
            <div className="card-callout small">
              Built for another gym. Exercises that aren't possible here are swapped automatically when you start, or <button className="ghost small" onClick={regenerate}>rebuild for {gym.name}</button>.
            </div>
          )}
          {plan.notes.length > 0 && (
            <section className="card stack">
              <h2>Notes</h2>
              <ul className="bullets small">{plan.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </section>
          )}

          {plan.days.map((day, dayIndex) => (
            <section key={dayIndex} className={`card stack ${dayIndex === nextDay ? 'next-day' : ''}`}>
              <div className="day-head">
                <div>
                  <h2>{day.name}</h2>
                  <div className="muted small">~{day.estMinutes} min · {day.items.length} exercises{dayIndex === nextDay ? ' · next up' : ''}</div>
                </div>
                {!active && (
                  <button className={dayIndex === nextDay ? '' : 'secondary'} onClick={() => void start(plan, dayIndex)}>Start</button>
                )}
              </div>
              <ol className="plan-items">
                {day.items.map((item, itemIndex) => (
                  <PlanItemRow key={`${item.exerciseId}-${itemIndex}`} plan={plan} dayIndex={dayIndex} itemIndex={itemIndex} />
                ))}
              </ol>
            </section>
          ))}

          <section className="card stack">
            <h2>Weekly sets per muscle</h2>
            <p className="muted small">Hard sets per week (half credit for supporting muscles).</p>
            <dl className="volume-list">
              {VOLUME_ORDER.filter((m) => plan.weeklySets[m]).map((m) => (
                <div key={m}><dt>{muscleLabel(m)}</dt><dd>{+(plan.weeklySets[m] ?? 0).toFixed(1)}</dd></div>
              ))}
            </dl>
          </section>

          <button className="secondary" onClick={() => setEditing(true)}>Change preferences / rebuild</button>
        </>
      )}
    </div>
  )
}

function PlanItemRow({ plan, dayIndex, itemIndex }: { plan: StoredPlan; dayIndex: number; itemIndex: number }) {
  const [open, setOpen] = useState(false)
  const item = plan.days[dayIndex].items[itemIndex]
  const ex = EXERCISE_BY_ID.get(item.exerciseId)
  if (!ex) return null
  const unit = ex.measure === 'time' ? 's' : ''
  return (
    <li className="plan-item">
      <div className="plan-item-main">
        <div>
          <Link to={`/exercise/${ex.id}`} className="plan-item-name">{ex.name}</Link>
          <div className="muted small">{item.target.sets} × {item.target.repMin}–{item.target.repMax}{unit} · {item.reason}</div>
        </div>
        {item.alternatives.length > 0 && (
          <button className="ghost small" aria-expanded={open} onClick={() => setOpen(!open)}>Swap</button>
        )}
      </div>
      {open && (
        <div className="chips">
          {item.alternatives.map((id) => (
            <button key={id} className="chip small" onClick={() => { void swapPlanExercise(plan.id, dayIndex, itemIndex, id); setOpen(false) }}>
              {EXERCISE_BY_ID.get(id)?.name ?? id}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}
