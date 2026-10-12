// Full body report (Design.md "Profile: body full report", ADR-020): posture, InBody, left/right balance and the trunk
// test in one place, with what changed since last time. Screening, not a diagnosis.
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router'
import { LineChart } from '../components/LineChart'
import { Why } from '../components/Why'
import { db } from '../db/db'
import { formatDate } from '../lib/hooks'
import { FIELDS, type InBodyField } from '../lib/inbody'
import { muscleLabel } from '../lib/planner'
import { bodyReport, type Trend } from '../lib/progress/bodyReport'
import { useProgress } from '../lib/progress/useProgress'

const TREND: Record<Trend, string> = { improved: 'Improved', worse: 'Worse', same: 'Same', new: 'New', resolved: 'Resolved' }
const SEV: Record<string, string> = { none: 'Normal range', mild: 'Mild', moderate: 'Moderate', marked: 'Marked' }
const MAIN: InBodyField[] = ['weightKg', 'smmKg', 'bodyFatKg', 'pbf', 'bmi', 'visceralFat']
/** Whether a rise is good news, for colouring changes. */
const UP_IS_GOOD: Partial<Record<InBodyField, boolean>> = { smmKg: true, pbf: false, bodyFatKg: false, visceralFat: false }
const fmt = (f: InBodyField, v: number) => `${v.toFixed(FIELDS[f].dp)}${FIELDS[f].unit === '%' ? '%' : FIELDS[f].unit ? ` ${FIELDS[f].unit}` : ''}`

export function BodyReportPage() {
  const data = useLiveQuery(async () => {
    const [scans, comps, trunks] = await Promise.all([db.postureScans.toArray(), db.bodyComps.toArray(), db.assessments.where('type').equals('trunk_rotation').toArray()])
    return bodyReport({ scans, comps, trunks })
  }, [])
  const progress = useProgress()
  if (!data) return null
  const r = data
  const balance = progress?.stats.find((s) => s.key === 'balance')

  return (
    <div className="page">
      <header className="page-head">
        <h1>Body report</h1>
        <p className="muted">{r.latestAt ? `Updated ${formatDate(r.latestAt)}` : 'No body data yet'} · screening, not a diagnosis</p>
      </header>

      {r.posture?.referral && (
        <section className="card referral" role="alert">
          <h2>Worth a professional check</h2>
          <p className="small">{r.posture.referral}</p>
        </section>
      )}

      <section className="card stack">
        <h2>Summary</h2>
        <div className="stat-line">
          <span className="stat-name">Balance</span>
          <span className="stat-num">{balance?.value ?? '–'}</span>
        </div>
        <div className="progress thin"><div style={{ width: `${balance?.value ?? 0}%` }} /></div>
        <p className="muted small">{balance?.hint}</p>
        {r.focus.strengthen.length > 0 ? (
          <>
            <div className="muted small">Focus for your training (strengthen)</div>
            <ul className="focus-list small">
              {r.focus.strengthen.slice(0, 6).map((m) => <li key={m.muscle}><b>{muscleLabel(m.muscle)}</b> <span className="muted">· {m.because.join('; ')}</span></li>)}
            </ul>
            {r.focus.stretch.length > 0 && <p className="small"><span className="muted">Stretch: </span>{r.focus.stretch.join(' · ')}</p>}
            <Link to="/plan" className="button secondary">See it in your plan</Link>
          </>
        ) : <p className="small">{r.posture || r.limbs.length ? 'Nothing stands out. Keep training both sides evenly.' : 'Add body data below to get training priorities.'}</p>}
        <Why codes={['stat_balance', 'strengthen']} />
      </section>

      <section className="card stack">
        <h2>Body composition</h2>
        {r.composition ? (
          <>
            <p className="muted small">InBody {formatDate(r.composition.at)}{r.composition.firstAt !== r.composition.at ? ` · change since ${formatDate(r.composition.firstAt)}` : ''}</p>
            <ul className="change-list">
              {MAIN.filter((f) => r.composition!.values[f] !== undefined).map((f) => {
                const d = r.composition!.changeSinceFirst[f]
                const good = d === undefined || d === 0 || UP_IS_GOOD[f] === undefined ? '' : (d > 0) === UP_IS_GOOD[f] ? 'up' : 'down'
                return (
                  <li key={f}>
                    <span>{FIELDS[f].label}</span>
                    <span className="data">{fmt(f, r.composition!.values[f]!)}</span>
                    <span className={`data ${good}`}>{d === undefined ? '' : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}`}</span>
                  </li>
                )
              })}
            </ul>
            {r.series.map((s) => (
              <div key={s.field}>
                <div className="muted small">{FIELDS[s.field].label} over time</div>
                <LineChart points={s.points} label={FIELDS[s.field].label} formatX={(x) => formatDate(x)} formatY={(y) => fmt(s.field, y)} />
              </div>
            ))}
          </>
        ) : <Link to="/profile/body" className="button">Log an InBody result</Link>}
      </section>

      <section className="card stack">
        <h2>Left / right balance</h2>
        {r.limbs.length ? (
          <ul className="change-list">
            {r.limbs.map((l) => (
              <li key={l.limb}>
                <span>{l.limb === 'arm' ? 'Arms' : 'Legs'}</span>
                <span className="data">L {l.left} · R {l.right} kg</span>
                <span className={`data ${l.weaker ? 'down' : 'up'}`}>{l.diffPct}%{l.weaker ? ` ${l.weaker} weaker` : ''}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">Needs segmental lean mass from InBody (arms and legs).</p>}
        {r.limbs.some((l) => l.weaker) && <p className="small">One-sided exercises in your plan start with the weaker side and add a set on it.</p>}
        <Why codes={['weak_side']} />
      </section>

      <section className="card stack">
        <h2>Posture</h2>
        {r.posture ? (
          <>
            <p className="muted small">Scan {formatDate(r.posture.at)}{r.posture.previousAt ? ` · compared with ${formatDate(r.posture.previousAt)}` : ''}</p>
            {r.posture.findings.length ? (
              <ul className="change-list">
                {r.posture.findings.map((f) => (
                  <li key={f.code}>
                    <span>{f.tentative ? 'Possible: ' : ''}{f.title}{f.side ? ` (${f.side})` : ''}</span>
                    <span className={`sev-chip sev-${f.severity}`}>{SEV[f.severity]}</span>
                    <span className={`data trend-${f.trend ?? 'none'}`}>{f.trend ? TREND[f.trend] : ''}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="small">No clear imbalances in the latest scan.</p>}
            {r.posture.femurTorso !== undefined && <p className="muted small">Thigh-to-torso ratio {r.posture.femurTorso.toFixed(2)}.</p>}
            <Link to={`/profile/posture/${r.posture.id}`} className="button secondary">Full scan report</Link>
          </>
        ) : <Link to="/profile/posture" className="button">Do a posture scan</Link>}
      </section>

      <section className="card stack">
        <h2>Trunk rotation</h2>
        {r.trunk ? (
          <p className="small">{Math.abs(r.trunk.worstDeg).toFixed(1)}° in the {r.trunk.region} back ({formatDate(r.trunk.at)}): {r.trunk.grade === 'normal' ? 'common range' : r.trunk.grade === 'borderline' ? 're-test in a few weeks' : 'worth a professional check'}.</p>
        ) : <Link to="/profile/imbalance/trunk" className="button secondary">Do the trunk rotation test</Link>}
      </section>

      <p className="muted small">Everything here is worked out on this phone from your scans and measurements. Photos are never stored.</p>
      <Link to="/profile" className="button secondary">Back</Link>
    </div>
  )
}
