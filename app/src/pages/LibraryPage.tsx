import { useState } from 'react'
import { Link } from 'react-router'
import { EXERCISES, PATTERN_LABELS, performableExercises, type Pattern } from '../data/exercises'
import { useActiveGym } from '../lib/hooks'

export function LibraryPage() {
  const gym = useActiveGym()
  const [showAll, setShowAll] = useState(false)
  const list = showAll ? EXERCISES : performableExercises(gym?.equipment ?? [])
  const patterns = Object.keys(PATTERN_LABELS) as Pattern[]

  return (
    <div className="page">
      <header className="page-head">
        <h1>Exercises</h1>
        <p className="muted">{showAll ? `All ${EXERCISES.length} exercises` : `${list.length} possible at ${gym?.name ?? 'your gym'}`}</p>
      </header>
      <label className="toggle small">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all exercises
      </label>
      {patterns.map((p) => {
        const items = list.filter((e) => e.pattern === p)
        if (!items.length) return null
        return (
          <section key={p} className="card stack">
            <h2>{PATTERN_LABELS[p]} <span className="muted small">({items.length})</span></h2>
            <ul className="link-list">
              {items.map((e) => <li key={e.id}><Link to={`/exercise/${e.id}`}>{e.name}</Link></li>)}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
