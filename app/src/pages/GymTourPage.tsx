// Gym tour (Design.md "Gym: choose manually", ADR-021): set up a gym's equipment one area at a time, starting from
// the closest gym type, with a hint for each item. Used for new gyms and to re-check an existing one.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CATEGORY_LABELS, EQUIPMENT, EQUIPMENT_BY_ID, GYM_PRESETS, type EquipmentCategory } from '../data/equipment'
import { performableExercises } from '../data/exercises'
import { db } from '../db/db'
import { createGym, saveSettings } from '../db/repo'
import { topUnlocks, unlockCounts } from '../lib/gymSetup'

const AREAS = Object.keys(CATEGORY_LABELS) as EquipmentCategory[]

export function GymTourPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const id = params.get('id')
  const gym = useLiveQuery(async () => (id ? (await db.gyms.get(id)) ?? null : null), [id])
  const [step, setStep] = useState(0) // 0 = name and type, 1..AREAS.length = areas, then summary
  const [name, setName] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<string[] | null>(null)
  if (gym === undefined) return null

  const eq = equipment ?? gym?.equipment ?? []
  const gymName = name ?? gym?.name ?? ''
  const owned = new Set(eq)
  const set = (ids: string[]) => setEquipment([...new Set(ids)])
  const toggle = (e: string) => set(owned.has(e) ? eq.filter((x) => x !== e) : [...eq, e])
  const count = performableExercises(eq).length
  const last = AREAS.length + 1

  async function save() {
    if (gym) await db.gyms.update(gym.id, { name: gymName.trim() || gym.name, equipment: eq })
    else {
      const created = await createGym(gymName.trim() || 'My gym', eq)
      await saveSettings({ activeGymId: created.id })
    }
    navigate('/gym')
  }

  const progress = (
    <div className="tour-progress" aria-label={`Step ${step + 1} of ${last + 1}`}>
      {Array.from({ length: last + 1 }, (_, i) => <span key={i} className={i <= step ? 'on' : ''} />)}
    </div>
  )

  if (step === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>{gym ? 'Re-check equipment' : 'New gym'}</h1>
          <p className="muted">Walk through the gym area by area. About a minute.</p>
        </header>
        {progress}
        <section className="card stack">
          <label className="field">Name<input value={gymName} placeholder="e.g. Station Gym" maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
          <div className="muted small">{gym ? 'Start again from a gym type, or keep what you have:' : 'Which is it closest to? You will fine-tune it next.'}</div>
          <div className="tour-tiles">
            {gym && (
              <button className={`tour-tile ${equipment === null ? 'on' : ''}`} onClick={() => setEquipment(null)}>
                <b>Keep current</b><span className="muted small">{gym.equipment.length} items</span>
              </button>
            )}
            {GYM_PRESETS.map((p) => (
              <button key={p.id} className={`tour-tile ${equipment !== null && p.equipment.length === eq.length && p.equipment.every((x) => owned.has(x)) ? 'on' : ''}`} onClick={() => set(p.equipment)}>
                <b>{p.name}</b><span className="muted small">{p.description}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} disabled={!gymName.trim()}>Start the tour</button>
          {!gymName.trim() && <p className="muted small">Give the gym a name to start.</p>}
        </section>
        <Link to="/gym" className="button secondary">Cancel</Link>
      </div>
    )
  }

  if (step <= AREAS.length) {
    const area = AREAS[step - 1]
    const items = EQUIPMENT.filter((e) => e.category === area)
    const gains = unlockCounts(eq)
    return (
      <div className="page">
        <header className="page-head">
          <h1>{CATEGORY_LABELS[area]}</h1>
          <p className="muted">Tap everything you can see. {count} exercises so far.</p>
        </header>
        {progress}
        <div className="row">
          <button className="secondary" onClick={() => set([...eq, ...items.map((e) => e.id)])}>All of these</button>
          <button className="secondary" onClick={() => set(eq.filter((x) => !items.some((e) => e.id === x)))}>None of these</button>
        </div>
        <ul className="tour-list">
          {items.map((e) => (
            <li key={e.id}>
              <button className={`tour-item ${owned.has(e.id) ? 'on' : ''}`} aria-pressed={owned.has(e.id)} onClick={() => toggle(e.id)}>
                <span className="tour-check" aria-hidden="true">{owned.has(e.id) ? '✓' : ''}</span>
                <span className="tour-text"><b>{e.name}</b><span className="muted small">{e.hint}</span></span>
                {!owned.has(e.id) && (gains.get(e.id) ?? 0) > 0 && <span className="tour-gain data">+{gains.get(e.id)}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="row">
          <button className="secondary" onClick={() => setStep(step - 1)}>Back</button>
          <button onClick={() => setStep(step + 1)}>{step === AREAS.length ? 'Review' : 'Next'}</button>
        </div>
      </div>
    )
  }

  const top = topUnlocks(eq)
  return (
    <div className="page">
      <header className="page-head">
        <h1>{gymName}</h1>
        <p className="muted">Review and save</p>
      </header>
      {progress}
      <section className="card stack">
        <div className="hero-number">{count}</div>
        <p className="small">exercises possible with {eq.length} items.</p>
        <ul className="chips">{eq.map((x) => <li key={x} className="chip small on">{EQUIPMENT_BY_ID.get(x)?.name ?? x}</li>)}</ul>
      </section>
      {top.length > 0 && (
        <section className="card stack">
          <h2>Did you miss any of these?</h2>
          <p className="muted small">The items that would unlock the most exercises.</p>
          {top.map((t) => (
            <button key={t.id} className="secondary" onClick={() => toggle(t.id)}>+ {EQUIPMENT_BY_ID.get(t.id)!.name} (+{t.gain} exercises)</button>
          ))}
        </section>
      )}
      <div className="row">
        <button className="secondary" onClick={() => setStep(step - 1)}>Back</button>
        <button onClick={() => void save()}>Save gym</button>
      </div>
    </div>
  )
}
