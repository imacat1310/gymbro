// Posture report (features/02-posture-scan.md, ADR-009). Computed on the fly from stored landmarks.
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router'
import { db, type PostureScan } from '../db/db'
import { deletePostureScan } from '../db/repo'
import { formatDate } from '../lib/hooks'
import { muscleLabel } from '../lib/planner'
import { LM } from '../lib/pose'
import {
  analyzeScan, FINDING_INFO, HIDE_BELOW, muscleFocus, SHOW_AS_POSSIBLE, uprightPoints, type Finding, type FindingCode, type Severity,
} from '../lib/posture'

const SEVERITY_ORDER: Severity[] = ['marked', 'moderate', 'mild', 'none']
const SEVERITY_LABEL: Record<Severity, string> = { none: 'Normal range', mild: 'Mild', moderate: 'Moderate', marked: 'Marked' }
const NOT_MEASURED = ['Pelvic tilt', 'Upper-back curvature', 'Shoulder-blade winging', 'Foot turnout']

const sideText = (f: Finding) => (f.side ? ` (${f.side})` : '')
const valueText = (f: Finding) => `${f.value}${f.unit === '°' ? '°' : ` ${f.unit}`}`

export function PostureReportPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const scan = useLiveQuery(() => (id ? db.postureScans.get(id) : undefined), [id])
  if (scan === undefined) return null

  const report = analyzeScan(scan)
  const shown = report.findings.filter((f) => f.confidence >= HIDE_BELOW)
  const flagged = shown.filter((f) => f.severity !== 'none')
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || b.confidence - a.confidence)
  const normal = shown.filter((f) => f.severity === 'none')
  const hidden = report.findings.filter((f) => f.confidence < HIDE_BELOW)
  const ft = report.proportions.femurTorso
  const focus = muscleFocus(shown)

  return (
    <div className="page">
      <header className="page-head">
        <h1>Posture report</h1>
        <p className="muted">{formatDate(scan.takenAt)} · screening, not a diagnosis</p>
      </header>

      {report.referral && (
        <section className="card referral" role="alert">
          <h2>Worth a professional check</h2>
          <p className="small">{report.referral}</p>
        </section>
      )}

      <section className="card stack">
        <h2>{flagged.length ? `${flagged.length} thing${flagged.length > 1 ? 's' : ''} to work on` : 'No clear imbalances found'}</h2>
        <BodyDiagram scan={scan} findings={shown} />
        <div className="legend small">
          {(['none', 'mild', 'moderate', 'marked'] as Severity[]).map((s) => <span key={s}><i className={`dot sev-${s}`} /> {SEVERITY_LABEL[s]}</span>)}
        </div>
      </section>

      {focus.strengthen.length > 0 && (
        <section className="card stack">
          <h2>Focus for your training</h2>
          <div>
            <div className="muted small">Strengthen (most important first)</div>
            <div className="chips focus-chips">
              {focus.strengthen.map((m) => (
                <span key={m.muscle} className={`chip small ${m.score >= 3 ? 'on' : ''}`}>{muscleLabel(m.muscle)}</span>
              ))}
            </div>
          </div>
          {focus.stretch.length > 0 && (
            <div>
              <div className="muted small">Stretch / mobilise</div>
              <p className="small">{focus.stretch.join(' · ')}</p>
            </div>
          )}
        </section>
      )}

      {flagged.map((f) => {
        const info = FINDING_INFO[f.code]
        const possible = f.confidence < SHOW_AS_POSSIBLE
        return (
          <section key={f.code} className="card stack finding">
            <div className="day-head">
              <h2>{possible ? 'Possible: ' : ''}{info.title}{sideText(f)}</h2>
              <span className={`sev-chip sev-${f.severity}`}>{SEVERITY_LABEL[f.severity]}</span>
            </div>
            <p className="small">{info.what}</p>
            <p className="muted small">Measured {valueText(f)} · confidence {Math.round(f.confidence * 100)}%{possible ? ' (low: a re-scan in better conditions would confirm it)' : ''}</p>
            <div className="suggestion small"><span className="sugg-icon">→</span><span>{info.response}</span></div>
          </section>
        )
      })}

      {normal.length > 0 && (
        <section className="card stack">
          <h2>In the normal range</h2>
          <ul className="link-list small">
            {normal.map((f) => (
              <li key={f.code} className="history-row"><span>{FINDING_INFO[f.code].metric}</span><span className="muted">{valueText(f)}</span></li>
            ))}
          </ul>
        </section>
      )}

      {ft !== undefined && (
        <section className="card stack">
          <h2>Proportions</h2>
          <p className="small">
            Thigh to torso: <b>{ft.toFixed(2)}</b>.{' '}
            {ft >= 0.9 ? 'Your thighs are long relative to your torso: front squats, heel-elevated or wider-stance squats often feel better than low-bar back squats.'
              : ft <= 0.7 ? 'Your thighs are short relative to your torso: upright squats usually come naturally.'
                : 'Average thigh-to-torso ratio: most squat styles will suit you.'}
          </p>
          <p className="muted small">These inform exercise choice; they're not something to correct.</p>
        </section>
      )}

      <section className="card stack">
        <h2>About this report</h2>
        <ul className="bullets small">
          {report.notes.map((n) => <li key={n}>{n}</li>)}
          {hidden.length > 0 && <li>{hidden.length} measurement{hidden.length > 1 ? 's were' : ' was'} too uncertain to show (body points hard to see).</li>}
          <li>Not measured from photos yet: {NOT_MEASURED.join(', ').toLowerCase()}.</li>
          <li>Static posture says little on its own about pain or performance. Findings are tendencies to keep an eye on, not problems.</li>
          <li>For a fair comparison, re-scan in about 6 weeks with the same clothes, spot and phone position.</li>
        </ul>
      </section>

      <div className="row">
        <Link to="/more/posture" className="button secondary">Back</Link>
        <button className="danger" onClick={async () => {
          if (confirm('Delete this scan?')) { await deletePostureScan(scan.id); navigate('/more/posture') }
        }}>Delete scan</button>
      </div>
    </div>
  )
}

/** Front and side stick figures from the (tilt-corrected) landmarks, with markers coloured by severity. */
function BodyDiagram({ scan, findings }: { scan: PostureScan; findings: Finding[] }) {
  const sev = (code: FindingCode | FindingCode[]) => {
    const fs = findings.filter((f) => ([] as FindingCode[]).concat(code).includes(f.code))
    return fs.reduce<Severity>((w, f) => (SEVERITY_ORDER.indexOf(f.severity) < SEVERITY_ORDER.indexOf(w) ? f.severity : w), 'none')
  }
  const figures: { key: string; label: string; cap: NonNullable<PostureScan['views']['front']>; markers: [number[], Severity][]; plumb?: boolean }[] = []
  const frontCap = scan.views.front ?? scan.views.back
  if (frontCap) {
    figures.push({
      key: 'front', label: scan.views.front ? 'Front' : 'Back', cap: frontCap,
      markers: [
        [[LM.leftEar, LM.rightEar], sev('head_tilt')],
        [[LM.leftShoulder, LM.rightShoulder], sev(['shoulder_height_asymmetry', 'lateral_trunk_shift'])],
        [[LM.leftHip, LM.rightHip], sev('pelvic_height_asymmetry')],
        [[LM.leftKnee, LM.rightKnee], sev(['knee_valgus_static', 'knee_varus_static'])],
      ],
    })
  }
  if (scan.views.side) {
    figures.push({
      key: 'side', label: 'Side', cap: scan.views.side, plumb: true,
      markers: [
        [[LM.leftEar, LM.rightEar], sev('forward_head')],
        [[LM.leftShoulder, LM.rightShoulder], sev('rounded_shoulders')],
        [[LM.leftKnee, LM.rightKnee], sev('knee_hyperextension')],
      ],
    })
  }
  const BONES: [number, number][] = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [7, 8],
  ]
  return (
    <div className="diagram">
      {figures.map(({ key, label, cap, markers, plumb }) => {
        const pts = uprightPoints(cap, scan.camera)
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys) - 30, maxY = Math.max(...ys)
        const h = maxY - minY, w = Math.max(maxX - minX, h * 0.45)
        const cx = (minX + maxX) / 2
        const vb = `${cx - w / 2 - 20} ${minY} ${w + 40} ${h + 10}`
        const headR = Math.max(10, Math.hypot(pts[7].x - pts[8].x, pts[7].y - pts[8].y) * 0.7, h * 0.045)
        const head = { x: (pts[7].x + pts[8].x) / 2, y: Math.min(pts[7].y, pts[8].y) - headR * 0.3 }
        const near = (a: number, b: number) => (pts[a].v >= pts[b].v ? a : b)
        return (
          <figure key={key}>
            <svg viewBox={vb} role="img" aria-label={`${label} view outline`}>
              {plumb && (() => {
                const a = pts[near(LM.leftAnkle, LM.rightAnkle)]
                return <line className="plumb" x1={a.x} y1={minY} x2={a.x} y2={maxY} />
              })()}
              <circle className="bone-head" cx={head.x} cy={head.y} r={headR} />
              {BONES.filter(([a, b]) => key !== 'side' || (pts[a].v > 0.4 && pts[b].v > 0.4)).map(([a, b]) => (
                <line key={`${a}-${b}`} className="bone" x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} />
              ))}
              {markers.flatMap(([ids, s]) => (key === 'side' ? [near(ids[0], ids[1])] : ids).map((i) => (
                <circle key={`${i}`} className={`marker sev-${s}`} cx={pts[i].x} cy={pts[i].y} r={h * 0.018} />
              )))}
            </svg>
            <figcaption className="muted small">{label}</figcaption>
          </figure>
        )
      })}
    </div>
  )
}
