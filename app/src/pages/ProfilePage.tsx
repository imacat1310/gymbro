import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { db } from '../db/db'
import { useSignals } from '../lib/coach/useSignals'
import { coachView } from '../lib/coach/signals'
import { ProfileForm } from '../components/ProfileForm'
import { exportAll, resetAll, saveSettings } from '../db/repo'
import { formatDate, useSettings } from '../lib/hooks'

async function downloadExport() {
  const data = await exportAll()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gymbro-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ProfilePage() {
  const settings = useSettings()
  const latestBody = useLiveQuery(() => db.bodyComps.orderBy('measuredAt').last(), [])
  const scans = useLiveQuery(() => db.postureScans.count(), [])
  const tests = useLiveQuery(() => db.assessments.count(), [])
  const v = latestBody?.values

  return (
    <div className="page">
      <header className="page-head">
        <h1>Profile</h1>
        <p className="muted">Your body, your training, your data</p>
      </header>

      <section className="card stack">
        <h2>Body</h2>
        <Link to="/profile/body" className="test-link">
          <b>Body composition</b>
          <span className="muted small">
            {v ? `Latest ${formatDate(latestBody!.measuredAt)} · ${[v.weightKg && `${v.weightKg} kg`, v.smmKg && `muscle ${v.smmKg} kg`, v.pbf && `fat ${v.pbf}%`].filter(Boolean).join(' · ')}`
              : 'Scan an InBody sheet or enter your results.'}
          </span>
        </Link>
        <Link to="/profile/posture" className="test-link">
          <b>Posture scan</b>
          <span className="muted small">{scans ? `${scans} saved · ` : ''}Front, both sides and back; only body points are kept.</span>
        </Link>
        <Link to="/profile/imbalance" className="test-link">
          <b>Imbalance tests</b>
          <span className="muted small">{tests ? `${tests} saved · ` : ''}Trunk rotation and, soon, left-vs-right movement tests.</span>
        </Link>
      </section>

      <Link to="/profile/goals" className="test-link card-link">
        <b>Goals</b>
        <span className="muted small">Lift and body targets, tracked against your training and InBody results.</span>
      </Link>

      <Link to="/profile/badges" className="test-link card-link">
        <b>Badges</b>
        <span className="muted small">Milestones for workouts, records, streaks and body checks.</span>
      </Link>

      <CoachView />

      {settings && (
        <section className="card stack">
          <h2>Training profile</h2>
          <p className="muted small">Sets the default rep ranges, RPE targets and rest times for new exercises.</p>
          <ProfileForm profile={settings.profile} onChange={(profile) => void saveSettings({ profile })} />
        </section>
      )}

      <section className="card stack">
        <h2>Phone checks</h2>
        <Link to="/profile/device" className="button secondary">Device check</Link>
        <Link to="/profile/pose" className="button secondary">Pose speed test</Link>
      </section>

      <section className="card stack">
        <h2>Your data</h2>
        <p className="muted small">Everything is stored only on this phone. Export a backup now and then.</p>
        <button className="secondary" onClick={() => void downloadExport()}>Export data (JSON)</button>
        <button className="danger" onClick={async () => {
          if (confirm('Delete ALL GymBro data on this phone? This cannot be undone.') && confirm('Really delete everything?')) {
            await resetAll()
            location.hash = '#/welcome'
          }
        }}>Delete all data</button>
      </section>

      <section className="card stack">
        <h2>About</h2>
        <p className="small">GymBro is a fitness app, not medical advice. Stop if you feel pain, and see a professional about injuries or health conditions.</p>
        <p className="muted small">v{__APP_VERSION__} · <a href="https://github.com/imacat1310/gymbro" target="_blank" rel="noreferrer">Source on GitHub</a></p>
      </section>
    </div>
  )
}

/** "What your coach sees" (ADR-016): every signal the coach reasons over, in plain lines. */
function CoachView() {
  const signals = useSignals()
  if (!signals) return null
  return (
    <section className="card stack">
      <h2>What your coach sees</h2>
      <ul className="bullets small">{coachView(signals).map((l) => <li key={l}>{l}</li>)}</ul>
      <p className="muted small">This is everything the coach reasons over. It's worked out on this phone by fixed rules; nothing is sent anywhere.</p>
    </section>
  )
}
