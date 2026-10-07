import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { EXERCISE_BY_ID, type Exercise } from '../data/exercises'
import type { SessionEntry, SetLog } from '../db/db'
import { deleteSet, exerciseHistory, logSet, removeEntry, startRest, toLogged } from '../db/repo'
import { unlockAudio } from '../lib/alerts'
import { formatDate } from '../lib/hooks'
import {
  adjustNextSet, fmtKg, loadIncrement, platesPerSide, suggestNext, warmupSets, type NextSet, type Suggestion,
} from '../lib/progression'
import type { Experience, Target } from '../lib/targets'
import { Stepper } from './Stepper'

const FEEL = [
  { label: 'Easy', rpe: 6 }, { label: 'Good', rpe: 7.5 }, { label: 'Hard', rpe: 9 }, { label: 'Max', rpe: 10 },
]
const RPES = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const KIND_ICON: Record<Suggestion['kind'], string> = {
  new: '•', increase: '↑', repeat: '=', deload: '↓', more_reps: '↑', more_time: '↑',
}

interface Props {
  sessionId: string
  entry: SessionEntry
  sets: SetLog[]
  experience: Experience
}

export function EntryCard({ sessionId, entry, sets, experience }: Props) {
  const ex = EXERCISE_BY_ID.get(entry.exerciseId)
  const history = useLiveQuery(() => exerciseHistory(entry.exerciseId, sessionId), [entry.exerciseId, sessionId])
  if (!ex) return null

  const { target } = entry
  const working = sets.filter((s) => s.kind === 'working')
  const warmups = sets.filter((s) => s.kind === 'warmup')
  const inc = loadIncrement(ex)
  const suggestion = history ? suggestNext(ex, target, history.map((h) => h.sets.map(toLogged))) : null
  const last = working[working.length - 1]

  let planned: NextSet = { weightKg: suggestion?.weightKg ?? 0, reps: suggestion?.reps ?? target.repMax }
  if (last) planned = adjustNextSet({ weightKg: last.weightKg, reps: suggestion?.reps ?? last.reps }, toLogged(last), target, inc)

  const pendingWarmups = !last && suggestion?.weightKg
    ? warmupSets(ex, suggestion.weightKg).slice(warmups.length)
    : []
  const done = working.length >= target.sets
  const unit = ex.measure === 'time' ? 's' : 'reps'

  return (
    <article className="card entry">
      <header className="entry-head">
        <div>
          <h3><Link to={`/exercise/${ex.id}`}>{ex.name}</Link></h3>
          <div className="muted small">
            {target.sets} × {target.repMin}–{target.repMax} {unit} @ RPE {target.targetRpe} · rest {Math.round(target.restSec / 60 * 10) / 10} min
          </div>
        </div>
        <button className="ghost small" aria-label={`Remove ${ex.name}`} onClick={() => {
          if (sets.length === 0 || confirm(`Remove ${ex.name} and its ${sets.length} logged sets?`)) void removeEntry(sessionId, entry.key)
        }}>✕</button>
      </header>

      {history && history[0] && (
        <p className="small muted">
          Last ({formatDate(history[0].date)}): {history[0].sets.map((s) => (inc ? `${+s.weightKg.toFixed(2)}×${s.reps}` : `${s.reps}${ex.measure === 'time' ? 's' : ''}`)).join(', ')}
        </p>
      )}
      {suggestion && working.length === 0 && (
        <p className={`suggestion ${suggestion.kind}`}>
          <span className="sugg-icon" aria-hidden="true">{KIND_ICON[suggestion.kind]}</span>
          <span>
            {suggestion.weightKg !== null && inc > 0 && <strong>{fmtKg(suggestion.weightKg)} × {suggestion.reps} · </strong>}
            {suggestion.reason}
          </span>
        </p>
      )}

      {(sets.length > 0 || pendingWarmups.length > 0) && (
        <ol className="set-list">
          {warmups.map((s) => <SetRow key={s.id} set={s} label="W" ex={ex} />)}
          {pendingWarmups.map((w, i) => (
            <li key={`pw${i}`} className="set-row pending">
              <span className="set-idx">W</span>
              <span>{fmtKg(w.weightKg)} × {w.reps}</span>
              <button className="ghost small" onClick={() => {
                unlockAudio()
                void logSet({ sessionId, entryKey: entry.key, exerciseId: ex.id, kind: 'warmup', weightKg: w.weightKg, reps: w.reps })
              }}>Done</button>
            </li>
          ))}
          {working.map((s, i) => <SetRow key={s.id} set={s} label={String(i + 1)} ex={ex} />)}
        </ol>
      )}

      <SetEditor
        key={`${working.length}-${suggestion?.weightKg ?? 'x'}`}
        ex={ex}
        target={target}
        planned={planned}
        experience={experience}
        setNumber={working.length + 1}
        done={done}
        onLog={(weightKg, reps, rpe) => {
          unlockAudio()
          void logSet({ sessionId, entryKey: entry.key, exerciseId: ex.id, kind: 'working', weightKg, reps, rpe })
          void startRest(sessionId, target.restSec)
        }}
      />
    </article>
  )
}

function SetRow({ set, label, ex }: { set: SetLog; label: string; ex: Exercise }) {
  const loadBased = loadIncrement(ex) > 0 || set.weightKg > 0
  return (
    <li className={`set-row ${set.kind}`}>
      <span className="set-idx">{label}</span>
      <span>
        {loadBased && `${fmtKg(set.weightKg)} × `}{set.reps}{ex.measure === 'time' ? ' s' : loadBased ? '' : ' reps'}
        {set.rpe !== undefined && <span className="muted"> · RPE {set.rpe}</span>}
      </span>
      <button className="ghost small" aria-label="Delete set" onClick={() => confirm('Delete this set?') && void deleteSet(set.id)}>✕</button>
    </li>
  )
}

function SetEditor({ ex, target, planned, experience, setNumber, done, onLog }: {
  ex: Exercise
  target: Target
  planned: NextSet
  experience: Experience
  setNumber: number
  done: boolean
  onLog: (weightKg: number, reps: number, rpe?: number) => void
}) {
  const [weight, setWeight] = useState(planned.weightKg)
  const [reps, setReps] = useState(planned.reps)
  const [rpe, setRpe] = useState<number | undefined>(undefined)
  const [open, setOpen] = useState(!done)
  const inc = loadIncrement(ex)

  if (!open) {
    return (
      <div className="entry-done">
        <span>✓ All {target.sets} sets done</span>
        <button className="ghost small" onClick={() => setOpen(true)}>+ Extra set</button>
      </div>
    )
  }

  const plates = ex.load === 'barbell' && weight >= 20 ? platesPerSide(weight) : null

  return (
    <div className="set-editor">
      <div className="set-editor-title">{done ? 'Extra set' : `Set ${setNumber} of ${target.sets}`}</div>
      {planned.note && <p className="small adjust-note">{planned.note}</p>}
      <div className="steppers">
        <Stepper label={inc > 0 ? 'kg' : '+kg'} value={weight} step={inc || 2.5} onChange={setWeight} />
        <Stepper label={ex.measure === 'time' ? 'seconds' : 'reps'} value={reps} step={ex.measure === 'time' ? 5 : 1} onChange={setReps} />
      </div>
      {plates && (
        <p className="small muted">
          Per side: {plates.plates.length ? plates.plates.join(' + ') : 'empty bar'}{plates.remainderKg ? ` (+${plates.remainderKg} kg can't be loaded)` : ''}
        </p>
      )}
      <div className="rpe-row" role="group" aria-label="How hard was it? (optional)">
        <span className="muted small">{experience === 'beginner' ? 'How did it feel?' : 'RPE'}</span>
        <div className="chips">
          {(experience === 'beginner' ? FEEL : RPES.map((r) => ({ label: String(r), rpe: r }))).map((o) => (
            <button key={o.label} type="button" className={`chip small ${rpe === o.rpe ? 'on' : ''}`} aria-pressed={rpe === o.rpe}
              onClick={() => setRpe(rpe === o.rpe ? undefined : o.rpe)}>{o.label}</button>
          ))}
        </div>
      </div>
      <button className="log-btn" disabled={reps <= 0} onClick={() => onLog(weight, reps, rpe)}>
        ✓ Log {inc > 0 || weight > 0 ? `${fmtKg(weight)} × ` : ''}{reps}{ex.measure === 'time' ? ' s' : ''}
      </button>
    </div>
  )
}
