// All badges (Design.md "Goals and badges", ADR-017): unlocked ones with their date, locked ones with progress.
import { Link } from 'react-router'
import { formatDate } from '../lib/hooks'
import { useProgress } from '../lib/progress/useProgress'

export function BadgesPage() {
  const p = useProgress()
  if (!p) return null
  const unlocked = p.badges.filter((b) => b.unlocked).length
  return (
    <div className="page">
      <header className="page-head">
        <h1>Badges</h1>
        <p className="muted">{unlocked} of {p.badges.length} unlocked · level {p.level} · {p.totals.workouts} workouts</p>
      </header>
      <ul className="badge-grid">
        {p.badges.map((b) => (
          <li key={b.id} className={`badge-tile ${b.unlocked ? 'on' : ''}`}>
            <span className="badge-hex" aria-hidden="true">{b.icon}</span>
            <strong>{b.title}</strong>
            <span className="muted small">{b.detail}</span>
            <span className="small badge-state">{b.unlocked ? (b.at ? `Unlocked ${formatDate(b.at)}` : 'Unlocked') : b.progress ?? 'Locked'}</span>
          </li>
        ))}
      </ul>
      <Link to="/profile" className="button secondary">Back</Link>
    </div>
  )
}
