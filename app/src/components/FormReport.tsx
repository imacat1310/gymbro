// Form-check report (ADR-022): score, tips with personal reasons, faults, rep-by-rep table.
import { useState } from 'react'
import type { FormReport, Recording } from '../lib/form/types'
import { FAULT_TITLE, VIEW_INFO } from '../lib/form/views'


export function ReportView({ report, recording, onAgain, onDone, onUseReps }: {
  report: FormReport; recording: Recording | null; onAgain: () => void; onDone: () => void
  /** Opened from a workout: put the counted reps into that exercise's next set. */
  onUseReps?: () => void
}) {
  if (report.error) {
    return (
      <section className="card stack">
        <h2>{report.error === 'not_visible' ? "Couldn't see you clearly" : 'No reps found'}</h2>
        <p className="small">{report.error === 'not_visible'
          ? 'Keep your whole body in the frame for the whole set, in good light, about 3 m from the phone.'
          : 'Stand tall for a moment at the start, then squat down and up fully at least once.'}</p>
        <div className="row"><button onClick={onAgain}>Try again</button><button className="secondary" onClick={onDone}>Done</button></div>
      </section>
    )
  }
  const side = report.view === 'side'
  return (
    <>
      <section className="card stack form-score">
        <div className="day-head">
          <div>
            <div className="muted small">{report.reps.length} reps · {VIEW_INFO[report.view].title}</div>
            <div className="hero-number">{report.score}<span className="muted small"> / 100</span></div>
          </div>
        </div>
        {report.tips.map((t, i) => <Tip key={i} text={t.text} why={t.why} />)}
        {report.blockIncrease && <p className="small adjust-note">Next time: keep this weight. {report.faults.some((f) => f.severity === 'safety') ? 'Safety first.' : ''}</p>}
      </section>

      {report.faults.length > 0 && (
        <section className="card stack">
          <h2>What we saw</h2>
          <ul className="plan-items">
            {report.faults.map((f) => (
              <li key={f.code} className="plan-item">
                <div className="plan-item-main">
                  <span>{FAULT_TITLE[f.code]}</span>
                  <span className={`sev-chip sev-${f.severity === 'safety' ? 'marked' : f.severity}`}>{f.severity}</span>
                </div>
                <div className="muted small">Reps {f.reps.join(', ')}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card stack">
        <h2>Rep by rep</h2>
        <div className="table-wrap">
          <table className="results">
            <thead><tr><th>Rep</th>{side ? <><th>Depth</th><th>Lean</th><th>Down</th></> : <><th>Knee in L / R</th><th>Hip shift</th></>}</tr></thead>
            <tbody>
              {report.reps.map((r) => (
                <tr key={r.rep}>
                  <td>{r.rep}</td>
                  {side
                    ? <><td>{fmtDepth(r.depthDeg)}</td><td>{r.leanDeg}°</td><td>{r.descentSec} s</td></>
                    : <><td>{r.kneeCaveDeg?.left}° / {r.kneeCaveDeg?.right}°</td><td>{Math.round(Math.abs(r.hipShift ?? 0) * 100)}% {(r.hipShift ?? 0) > 0 ? 'L' : (r.hipShift ?? 0) < 0 ? 'R' : ''}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Depth: + below parallel. "Down" is the active lowering, so it reads shorter than it feels.</p>
      </section>

      {(report.personal.length > 0 || report.notMeasured.length > 0) && (
        <section className="card stack">
          {report.personal.length > 0 && <><h2>Personal settings</h2><ul className="bullets small">{report.personal.map((p) => <li key={p}>{p}</li>)}</ul></>}
          <ul className="bullets small muted">{report.notMeasured.map((n) => <li key={n}>{n}</li>)}</ul>
          <p className="muted small">Beta: thresholds are being tuned. Treat this as a second opinion, not a verdict.</p>
        </section>
      )}

      {onUseReps && <button className="log-btn" onClick={onUseReps}>Fill in {report.reps.length} reps</button>}
      <div className="row">
        <button className="secondary" onClick={onAgain}>Record again</button>
        <button className={onUseReps ? 'secondary' : ''} onClick={onDone}>Done</button>
      </div>
      {recording && <TuningExport recording={recording} />}
    </>
  )
}

function Tip({ text, why }: { text: string; why?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="stack form-tip">
      <p>{text}</p>
      {why && (
        <div className="why">
          <button type="button" className="why-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Why for you?'}</button>
          {open && <div className="why-panel"><p>{why}</p></div>}
        </div>
      )}
    </div>
  )
}

/** Opt-in: share the body points (no video) so thresholds can be tuned on real sets. */
function TuningExport({ recording }: { recording: Recording }) {
  return (
    <button className="ghost small" onClick={async () => {
      const name = `gymbro-form-${recording.exerciseId}-${recording.view}-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`
      const file = new File([JSON.stringify(recording)], name, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'GymBro form recording' }) } catch { /* cancelled */ }
        return
      }
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url; a.download = name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }}>Share body points for tuning (no video)</button>
  )
}


const fmtDepth = (d?: number) => (d === undefined ? '–' : `${d > 0 ? '+' : ''}${Math.round(d)}°`)
