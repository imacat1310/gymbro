import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { EquipmentEditor } from '../components/EquipmentEditor'
import { db } from '../db/db'
import { deleteGym, saveSettings } from '../db/repo'
import { useActiveGym } from '../lib/hooks'

export function GymPage() {
  const gym = useActiveGym()
  const gyms = useLiveQuery(() => db.gyms.toCollection().sortBy('createdAt'), [])

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
          <Link to={`/gym/setup?id=${gym.id}`} className="button">Walk through the gym</Link>
          <div className="card-callout">
            <strong>Camera scan</strong>
            <p className="muted small">Recognising equipment from photos needs an AI service, which isn't switched on yet. The walk-through or the list below is the quick way for now.</p>
          </div>
          <EquipmentEditor equipment={gym.equipment} onChange={(equipment) => void db.gyms.update(gym.id, { equipment })} />
          <Link to="/library" className="button secondary">Browse available exercises</Link>
        </section>
      ) : (
        <p className="muted">No gym yet.</p>
      )}

      <div className="row">
        <Link to="/gym/setup" className="button secondary">+ Add another gym</Link>
        {gym && gyms && gyms.length > 1 && (
          <button className="danger" onClick={() => confirm(`Delete "${gym.name}"? Workout history is kept.`) && void deleteGym(gym.id)}>Delete this gym</button>
        )}
      </div>
    </div>
  )
}
