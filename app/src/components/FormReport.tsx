// Form-check report (ADR-022): score, tips with personal reasons, faults, rep-by-rep table.
import { useState } from 'react'
import { makeSample, VIEW_FAULTS, type SampleLabels } from '../lib/form/sample'
import type { FaultCode, FormProfile, FormReport, Recording } from '../lib/form/types'
import { Stepper } from './Stepper'
import { FAULT_TITLE, VIEW_INFO } from '../lib/form/views'


export function ReportView({ report, recording, profile, onAgain, onDone, onUseReps }: {
  report: FormReport; recording: Recording | null; onAgain: () => void; onDone: () => void
  /** The profile the analysis used; included in a shared tuning sample. */
  profile?: FormProfile
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
      {recording && !report.error && profile && <LabelPanel report={report} recording={recording} profile={profile} />}
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

/**
 * Opt-in tuning help: mark what really happened on each rep, then share the body points (no video) with those
 * labels. Starts unlabelled (what GymBro saw is shown, not pre-selected) so the labels are the user's own judgement.
 */
function LabelPanel({ report, recording, profile }: { report: FormReport; recording: Recording; profile: FormProfile }) {
  const [open, setOpen] = useState(false)
  const [perRep, setPerRep] = useState<Record<number, FaultCode[]>>({})
  const [reps, setReps] = useState(report.reps.length)
  const [shared, setShared] = useState(false)
  const faults = VIEW_FAULTS[report.view]
  const seen = (rep: number) => report.faults.filter((f) => f.reps.includes(rep)).map((f) => FAULT_TITLE[f.code].toLowerCase())
  const toggle = (rep: number, code: FaultCode) => setPerRep((cur) => {
    const list = cur[rep] ?? []
    return { ...cur, [rep]: list.includes(code) ? list.filter((c) => c !== code) : [...list, code] }
  })

  async function share() {
    // Every detected rep is labelled: one with nothing ticked was a good rep.
    const labels: SampleLabels = { perRep: Object.fromEntries(report.reps.map((r) => [r.rep, perRep[r.rep] ?? []])) }
    if (reps !== report.reps.length) labels.reps = reps
    const sample = makeSample(recording, profile, report, labels, __APP_VERSION__)
    const name = `gymbro-form-${recording.exerciseId}-${recording.view}-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`
    const file = new File([JSON.stringify(sample)], name, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'GymBro form sample' }); setShared(true) } catch { /* cancelled */ }
      return
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setShared(true)
  }

  if (!open) return <button className="ghost small" onClick={() => setOpen(true)}>Help tune GymBro: label this set</button>
  return (
    <section className="card stack label-panel">
      <h2>What really happened?</h2>
      <p className="muted small">Tick the faults you actually did on each rep (nothing ticked = a good rep). This trains the judgement; only body points are shared, never video.</p>
      <ol className="plan-items">
        {report.reps.map((r) => (
          <li key={r.rep} className="plan-item">
            <div className="plan-item-main"><strong>Rep {r.rep}</strong><span className="muted small">{seen(r.rep).length ? `GymBro saw: ${seen(r.rep).join(', ')}` : 'GymBro saw: nothing'}</span></div>
            <div className="chips">
              {faults.map((code) => {
                const on = (perRep[r.rep] ?? []).includes(code)
                return <button key={code} type="button" className={`chip small ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(r.rep, code)}>{FAULT_TITLE[code]}</button>
              })}
            </div>
          </li>
        ))}
      </ol>
      <Stepper label="Reps you actually did" value={reps} step={1} min={0} onChange={(v) => setReps(Math.round(v))} />
      <button onClick={() => void share()}>{shared ? 'Shared ✓ (share again)' : 'Share labelled sample'}</button>
    </section>
  )
}

const fmtDepth = (d?: number) => (d === undefined ? '–' : `${d > 0 ? '+' : ''}${Math.round(d)}°`)
