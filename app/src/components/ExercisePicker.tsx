import { useMemo, useState } from 'react'
import { EXERCISES, PATTERN_LABELS, performableExercises, type Pattern } from '../data/exercises'

interface Props {
  equipment: string[]
  onPick: (exerciseId: string) => void
  onClose: () => void
}

export function ExercisePicker({ equipment, onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [pattern, setPattern] = useState<Pattern | 'all'>('all')
  const [showAll, setShowAll] = useState(false)

  const available = useMemo(() => new Set(performableExercises(equipment).map((e) => e.id)), [equipment])
  const list = EXERCISES.filter((e) =>
    (showAll || available.has(e.id)) &&
    (pattern === 'all' || e.pattern === pattern) &&
    e.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Add exercise" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Add exercise</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        <input className="search" placeholder="Search exercises" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="chips scroll-x">
          <button className={`chip ${pattern === 'all' ? 'on' : ''}`} onClick={() => setPattern('all')}>All</button>
          {(Object.keys(PATTERN_LABELS) as Pattern[]).map((p) => (
            <button key={p} className={`chip ${pattern === p ? 'on' : ''}`} onClick={() => setPattern(p)}>{PATTERN_LABELS[p]}</button>
          ))}
        </div>
        <label className="toggle small">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Include exercises not possible at this gym
        </label>
        <ul className="pick-list">
          {list.map((e) => (
            <li key={e.id}>
              <button className="pick-item" onClick={() => onPick(e.id)}>
                <span>{e.name}</span>
                <span className="muted small">{PATTERN_LABELS[e.pattern]}{available.has(e.id) ? '' : ' · needs equipment'}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="muted">No matches.</li>}
        </ul>
      </div>
    </div>
  )
}
