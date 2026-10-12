import { useState } from 'react'
import { CATEGORY_LABELS, EQUIPMENT, EQUIPMENT_BY_ID, GYM_PRESETS, type EquipmentCategory } from '../data/equipment'
import { performableExercises } from '../data/exercises'
import { matchesSearch, topUnlocks, unlockCounts } from '../lib/gymSetup'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as EquipmentCategory[]

/** Equipment list for a gym: search, presets, toggles showing what each missing item would unlock (ADR-021). */
export function EquipmentEditor({ equipment, onChange }: { equipment: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('')
  const owned = new Set(equipment)
  const count = performableExercises(equipment).length
  const gains = unlockCounts(equipment)
  const top = topUnlocks(equipment)
  const toggle = (id: string) => onChange(owned.has(id) ? equipment.filter((e) => e !== id) : [...equipment, id])

  return (
    <div className="stack">
      <p className="count-line"><strong>{count}</strong> exercises available with this equipment</p>
      {top.length > 0 && (
        <p className="small muted">Biggest unlocks: {top.map((t) => `${EQUIPMENT_BY_ID.get(t.id)!.name} (+${t.gain})`).join(', ')}</p>
      )}
      <input className="search" placeholder="Search equipment (e.g. sled, rack, cable)" value={q} onChange={(e) => setQ(e.target.value)} />
      {!q && (
        <div>
          <div className="muted small">Start from a preset</div>
          <div className="chips">
            {GYM_PRESETS.map((p) => (
              <button key={p.id} type="button" className="chip" title={p.description} onClick={() => onChange([...p.equipment])}>{p.name}</button>
            ))}
          </div>
        </div>
      )}
      {CATEGORIES.map((cat) => {
        const items = EQUIPMENT.filter((e) => e.category === cat && matchesSearch(e, q))
        if (!items.length) return null
        return (
          <fieldset key={cat} className="choice">
            <legend>{CATEGORY_LABELS[cat]}</legend>
            <div className="chips">
              {items.map((e) => (
                <button key={e.id} type="button" className={`chip ${owned.has(e.id) ? 'on' : ''}`} aria-pressed={owned.has(e.id)} title={e.hint} onClick={() => toggle(e.id)}>
                  {owned.has(e.id) ? '✓ ' : ''}{e.name}{!owned.has(e.id) && (gains.get(e.id) ?? 0) > 0 ? <span className="chip-gain"> +{gains.get(e.id)}</span> : null}
                </button>
              ))}
            </div>
          </fieldset>
        )
      })}
      {q && CATEGORIES.every((cat) => !EQUIPMENT.some((e) => e.category === cat && matchesSearch(e, q))) && <p className="muted small">No equipment matches "{q}".</p>}
    </div>
  )
}
