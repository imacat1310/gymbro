// Today's status panel (Design.md, ADR-017): level and XP, weekly activity rings, stats and the latest badges.
import { Link } from 'react-router'
import { useProgress } from '../lib/progress/useProgress'
import { Why } from './Why'

/** Two concentric rings: outer = workouts, inner = minutes, each against this week's plan. */
function Rings({ a, b }: { a: number; b: number }) {
  const ring = (r: number, frac: number, cls: string) => {
    const c = 2 * Math.PI * r
    return (
      <>
        <circle className="ring-track" cx="50" cy="50" r={r} />
        {/* A zero-length arc with round caps would still draw a dot. */}
        {frac > 0 && <circle className={`ring ${cls}`} cx="50" cy="50" r={r} strokeDasharray={`${Math.min(1, frac) * c} ${c}`} transform="rotate(-90 50 50)" />}
      </>
    )
  }
  return <svg viewBox="0 0 100 100" className="rings" aria-hidden="true">{ring(42, a, 'ring-a')}{ring(30, b, 'ring-b')}</svg>
}

export function StatusCard() {
  const p = useProgress()
  if (!p) return null
  const span = p.nextLevel - p.levelFloor
  const pct = Math.round(((p.xp - p.levelFloor) / span) * 100)
  const recent = p.badges.filter((b) => b.unlocked).sort((x, y) => (y.at ?? 0) - (x.at ?? 0)).slice(0, 4)
  return (
    <section className="card status-card" aria-label="Status">
      <div className="status-top">
        <div className="lvl">
          <span className="lvl-label">LVL</span>
          <span className="lvl-num">{p.level}</span>
        </div>
        <div className="xp">
          <div className="xp-row"><span>{p.xp - p.levelFloor} / {span} XP</span><span className="muted">{p.streakWeeks ? `${p.streakWeeks}-week streak` : ''}</span></div>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div>
          <Why codes={['xp_level']} label="How XP works" />
        </div>
      </div>

      <div className="week">
        <Rings a={p.week.workouts / p.week.targetWorkouts} b={p.week.minutes / p.week.targetMinutes} />
        <dl className="week-legend">
          <div><dt><i className="dot-a" /> Workouts</dt><dd>{p.week.workouts} / {p.week.targetWorkouts}</dd></div>
          <div><dt><i className="dot-b" /> Minutes</dt><dd>{p.week.minutes} / {p.week.targetMinutes}</dd></div>
          <div className="muted small">This week, against your plan</div>
        </dl>
      </div>

      <ul className="stats">
        {p.stats.map((s) => (
          <li key={s.key}>
            <div className="stat-line">
              <span className="stat-name">{s.label}</span>
              <span className="stat-num">{s.value ?? '–'}</span>
            </div>
            <div className="progress thin"><div style={{ width: `${s.value ?? 0}%` }} /></div>
            <div className="muted small">{s.hint}</div>
          </li>
        ))}
      </ul>
      <Why codes={p.stats.map((s) => s.why)} label="How stats work" />

      <Link to="/profile/goals" className="goal-strip">
        <span className="muted small">Goals</span>
        {p.goals.filter((g) => !g.status.achieved).length ? (
          <ul>
            {p.goals.filter((g) => !g.status.achieved).slice(0, 3).map((g) => (
              <li key={g.goal.id}>
                <span>{g.status.title}</span>
                <span className="progress thin"><span style={{ width: `${Math.round((g.status.progress ?? 0) * 100)}%` }} /></span>
              </li>
            ))}
          </ul>
        ) : <span className="muted small">Set a lift or body goal</span>}
        <span aria-hidden="true">›</span>
      </Link>

      <Link to="/profile/badges" className="badge-strip">
        <span className="muted small">Badges {p.badges.filter((b) => b.unlocked).length} / {p.badges.length}</span>
        <span className="badge-icons">{recent.length ? recent.map((b) => <i key={b.id} title={b.title}>{b.icon}</i>) : <span className="muted small">Finish a workout to earn your first</span>}</span>
        <span aria-hidden="true">›</span>
      </Link>
    </section>
  )
}
