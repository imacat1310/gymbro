import { CATEGORY_LABELS, EQUIPMENT, GYM_PRESETS, type EquipmentCategory } from '../data/equipment'
import { performableExercises } from '../data/exercises'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as EquipmentCategory[]

export function EquipmentEditor({ equipment, onChange }: { equipment: string[]; onChange: (ids: string[]) => void }) {
  const owned = new Set(equipment)
  const count = performableExercises(equipment).length
  const toggle = (id: string) => onChange(owned.has(id) ? equipment.filter((e) => e !== id) : [...equipment, id])

  return (
    <div className="stack">
      <p className="count-line"><strong>{count}</strong> exercises available with this equipment</p>
      <div>
        <div className="muted small">Start from a preset</div>
        <div className="chips">
          {GYM_PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip" title={p.description} onClick={() => onChange([...p.equipment])}>{p.name}</button>
          ))}
        </div>
      </div>
      {CATEGORIES.map((cat) => (
        <fieldset key={cat} className="choice">
          <legend>{CATEGORY_LABELS[cat]}</legend>
          <div className="chips">
            {EQUIPMENT.filter((e) => e.category === cat).map((e) => (
              <button key={e.id} type="button" className={`chip ${owned.has(e.id) ? 'on' : ''}`} aria-pressed={owned.has(e.id)} onClick={() => toggle(e.id)}>
                {owned.has(e.id) ? '✓ ' : ''}{e.name}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
