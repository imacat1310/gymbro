import { Link } from 'react-router'
import { ProfileForm } from '../components/ProfileForm'
import { exportAll, resetAll, saveSettings } from '../db/repo'
import { useSettings } from '../lib/hooks'

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

export function MorePage() {
  const settings = useSettings()

  return (
    <div className="page">
      <header className="page-head"><h1>More</h1></header>

      {settings && (
        <section className="card stack">
          <h2>Training profile</h2>
          <p className="muted small">Sets the default rep ranges, RPE targets and rest times for new exercises.</p>
          <ProfileForm profile={settings.profile} onChange={(profile) => void saveSettings({ profile })} />
        </section>
      )}

      <section className="card stack">
        <h2>Phone checks</h2>
        <Link to="/more/device" className="button secondary">Device check</Link>
        <Link to="/more/pose" className="button secondary">Pose speed test</Link>
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
