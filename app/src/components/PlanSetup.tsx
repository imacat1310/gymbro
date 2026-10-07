import type { Muscle } from '../data/exercises'
import { AREA_LABELS, type Area } from '../data/stress'
import type { Schedule } from '../db/db'
import { muscleLabel, PRIORITY_CHOICES } from '../lib/planner'

const DAYS = [2, 3, 4, 5, 6]
const MINUTES = [30, 45, 60, 75, 90]
const MAX_PRIORITIES = 3

interface Props {
  schedule: Schedule
  limitations: Area[]
  priorities: Muscle[]
  onChange: (patch: { schedule?: Schedule; limitations?: Area[]; priorities?: Muscle[] }) => void
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

export function PlanSetup({ schedule, limitations, priorities, onChange }: Props) {
  return (
    <div className="stack">
      <fieldset className="choice">
        <legend>Days per week</legend>
        <div className="chips">
          {DAYS.map((d) => (
            <button key={d} type="button" className={`chip ${schedule.daysPerWeek === d ? 'on' : ''}`} aria-pressed={schedule.daysPerWeek === d}
              onClick={() => onChange({ schedule: { ...schedule, daysPerWeek: d } })}>{d}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice">
        <legend>Minutes per session</legend>
        <div className="chips">
          {MINUTES.map((m) => (
            <button key={m} type="button" className={`chip ${schedule.sessionMinutes === m ? 'on' : ''}`} aria-pressed={schedule.sessionMinutes === m}
              onClick={() => onChange({ schedule: { ...schedule, sessionMinutes: m } })}>{m}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="choice">
        <legend>Muscles to prioritise (up to {MAX_PRIORITIES})</legend>
        <div className="chips">
          {PRIORITY_CHOICES.map((m) => {
            const on = priorities.includes(m)
            return (
              <button key={m} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
                disabled={!on && priorities.length >= MAX_PRIORITIES}
                onClick={() => onChange({ priorities: toggle(priorities, m) })}>{muscleLabel(m)}</button>
            )
          })}
        </div>
      </fieldset>
      <fieldset className="choice">
        <legend>Injuries or pain to work around</legend>
        <div className="chips">
          {(Object.keys(AREA_LABELS) as Area[]).map((a) => {
            const on = limitations.includes(a)
            return (
              <button key={a} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on}
                onClick={() => onChange({ limitations: toggle(limitations, a) })}>{AREA_LABELS[a]}</button>
            )
          })}
        </div>
        {limitations.length > 0 && (
          <p className="muted small">Exercises that load these areas are left out. If pain is sharp, worsening or lasts more than a couple of weeks, see a physiotherapist or doctor.</p>
        )}
      </fieldset>
    </div>
  )
}
