import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { EquipmentEditor } from '../components/EquipmentEditor'
import { GYM_PRESETS } from '../data/equipment'
import { db } from '../db/db'
import { createGym, deleteGym, saveSettings } from '../db/repo'
import { useActiveGym } from '../lib/hooks'

export function GymPage() {
  const gym = useActiveGym()
  const gyms = useLiveQuery(() => db.gyms.toCollection().sortBy('createdAt'), [])

  async function addGym() {
    const name = prompt('Name of the new gym', 'Hotel gym')?.trim()
    if (!name) return
    const created = await createGym(name, GYM_PRESETS[0].equipment)
    await saveSettings({ activeGymId: created.id })
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Gym</h1>
        <p className="muted">Exercises and suggestions follow the equipment of your active gym.</p>
      </header>

      {gyms && gyms.length > 1 && (
        <div className="chips">
          {gyms.map((g) => (
            <button key={g.id} className={`chip ${g.id === gym?.id ? 'on' : ''}`} onClick={() => void saveSettings({ activeGymId: g.id })}>{g.name}</button>
          ))}
        </div>
      )}

      {gym ? (
        <section className="card stack">
          <label className="field">
            <span>Name</span>
            <input defaultValue={gym.name} key={gym.id} onBlur={(e) => {
              const name = e.target.value.trim()
              if (name && name !== gym.name) void db.gyms.update(gym.id, { name })
            }} />
          </label>
          <div className="card-callout">
            <strong>Equipment scan</strong>
            <p className="muted small">Scanning the gym with your camera arrives in Phase 2. For now, tap to select what's there.</p>
          </div>
          <EquipmentEditor equipment={gym.equipment} onChange={(equipment) => void db.gyms.update(gym.id, { equipment })} />
          <Link to="/library" className="button secondary">Browse available exercises</Link>
        </section>
      ) : (
        <p className="muted">No gym yet.</p>
      )}

      <div className="row">
        <button className="secondary" onClick={addGym}>+ Add another gym</button>
        {gym && gyms && gyms.length > 1 && (
          <button className="danger" onClick={() => confirm(`Delete "${gym.name}"? Workout history is kept.`) && void deleteGym(gym.id)}>Delete this gym</button>
        )}
      </div>
    </div>
  )
}
