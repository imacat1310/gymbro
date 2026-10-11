import { useState } from 'react'
import { EXERCISE_BY_ID } from '../data/exercises'
import type { StoredPlan } from '../db/db'
import { editPlanDays, renamePlan } from '../db/repo'
import { addDay, addItem, moveDay, moveItem, removeDay, removeItem, renameDay, updateTarget, type PlanWarning } from '../lib/planEdit'
import type { Profile } from '../lib/targets'
import { ExercisePicker } from './ExercisePicker'
import { Stepper } from './Stepper'

interface Props {
  plan: StoredPlan
  profile: Profile
  equipment: string[]
  warnings: PlanWarning[]
  onDone: () => void
}

/** Hand-editing a plan (ADR-007). Every change is saved immediately; rule breaks show as warnings, never blocks. */
export function PlanEditor({ plan, profile, equipment, warnings, onDone }: Props) {
  const [name, setName] = useState(plan.name)
  const [open, setOpen] = useState<string | null>(null)
  const [pickFor, setPickFor] = useState<number | null>(null)
  const edit = (f: Parameters<typeof editPlanDays>[1]) => void editPlanDays(plan.id, f)
  const itemWarning = (d: number, i: number) => warnings.find((w) => w.dayIndex === d && w.itemIndex === i && w.level === 'danger')

  return (
    <div className="stack">
      <section className="card stack">
        <label className="field">Plan name
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => void renamePlan(plan.id, name)} />
        </label>
        <p className="muted small">Changes save as you go. GymBro warns you if something breaks its training rules, but the call is yours.</p>
      </section>

      {plan.days.map((day, d) => (
        <section key={d} className="card stack">
          <div className="day-head">
            <input className="day-name" aria-label={`Day ${d + 1} name`} defaultValue={day.name} key={`${d}-${day.name}`} maxLength={30}
              onBlur={(e) => { if (e.target.value.trim() && e.target.value !== day.name) edit((days) => renameDay(days, d, e.target.value.trim())) }} />
            <div className="icon-btns">
              <button className="icon-btn" aria-label={`Move ${day.name} up`} disabled={d === 0} onClick={() => edit((days) => moveDay(days, d, -1))}>↑</button>
              <button className="icon-btn" aria-label={`Move ${day.name} down`} disabled={d === plan.days.length - 1} onClick={() => edit((days) => moveDay(days, d, 1))}>↓</button>
              <button className="icon-btn danger" aria-label={`Delete ${day.name}`} disabled={plan.days.length === 1}
                onClick={() => { if (!day.items.length || confirm(`Delete ${day.name} and its ${day.items.length} exercises?`)) edit((days) => removeDay(days, d)) }}>✕</button>
            </div>
          </div>
          <div className="muted small">~{day.estMinutes} min · {day.items.length} exercises</div>

          <ol className="plan-items">
            {day.items.map((item, i) => {
              const ex = EXERCISE_BY_ID.get(item.exerciseId)
              const key = `${d}-${i}`
              const t = item.target
              const unit = ex?.measure === 'time' ? 's' : ''
              const danger = itemWarning(d, i)
              return (
                <li key={`${key}-${item.exerciseId}`} className="plan-item">
                  <div className="plan-item-main">
                    <button className="plan-item-name link-btn" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>
                      {danger && <span className="badge danger" title={danger.text}>!</span>} {ex?.name ?? item.exerciseId}
                      <span className="muted small block">{t.sets} × {t.repMin}–{t.repMax}{unit} · rest {t.restSec}s</span>
                    </button>
                    <div className="icon-btns">
                      <button className="icon-btn" aria-label={`Move ${ex?.name} up`} disabled={i === 0} onClick={() => edit((days) => moveItem(days, d, i, -1))}>↑</button>
                      <button className="icon-btn" aria-label={`Move ${ex?.name} down`} disabled={i === day.items.length - 1} onClick={() => edit((days) => moveItem(days, d, i, 1))}>↓</button>
                      <button className="icon-btn danger" aria-label={`Remove ${ex?.name}`} onClick={() => edit((days) => removeItem(days, d, i))}>✕</button>
                    </div>
                  </div>
                  {danger && open === key && <p className="small error">{danger.text}</p>}
                  {open === key && (
                    <div className="steppers">
                      <Stepper label="Sets" value={t.sets} step={1} min={1} onChange={(v) => edit((days) => updateTarget(days, d, i, { sets: v }))} />
                      <Stepper label="Rest (s)" value={t.restSec} step={15} min={0} onChange={(v) => edit((days) => updateTarget(days, d, i, { restSec: v }))} />
                      <Stepper label={unit ? 'Min (s)' : 'Reps min'} value={t.repMin} step={1} min={1} onChange={(v) => edit((days) => updateTarget(days, d, i, { repMin: v }))} />
                      <Stepper label={unit ? 'Max (s)' : 'Reps max'} value={t.repMax} step={1} min={1} onChange={(v) => edit((days) => updateTarget(days, d, i, { repMax: v }))} />
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          <button className="secondary" onClick={() => setPickFor(d)}>+ Add exercise</button>
        </section>
      ))}

      <button className="secondary" disabled={plan.days.length >= 7} onClick={() => edit(addDay)}>+ Add day</button>
      <button onClick={() => { void renamePlan(plan.id, name); onDone() }}>Done</button>

      {pickFor !== null && (
        <ExercisePicker
          equipment={equipment}
          onClose={() => setPickFor(null)}
          onPick={(id) => { edit((days) => addItem(days, pickFor, id, profile)); setPickFor(null) }}
        />
      )}
    </div>
  )
}
