// Imbalance tests hub (ADR-010): posture scan, trunk rotation, and (next) movement tests, with their history.
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useSearchParams } from 'react-router'
import { db, type Assessment } from '../db/db'
import { deleteAssessment } from '../db/repo'
import { formatDate } from '../lib/hooks'
import { ATR_REFER, sideOf, summarize, type TrunkGrade, type TrunkRegion } from '../lib/trunk'

const GRADE_TEXT: Record<TrunkGrade, string> = { normal: 'Common range', borderline: 'Re-test', refer: 'Get it checked' }
const GRADE_SEV: Record<TrunkGrade, string> = { normal: 'none', borderline: 'mild', refer: 'marked' }
const REGION: Record<TrunkRegion, string> = { upper: 'Upper back', lower: 'Lower back' }

const angle = (d: number) => `${Math.abs(d).toFixed(1)}°${sideOf(d) ? ` ${sideOf(d)} higher` : ''}`

function TrunkResultCard({ a, open }: { a: Assessment; open: boolean }) {
  const { worst, grade } = summarize(a.trunk)
  return (
    <section className={`card stack ${open ? 'next-day' : ''}`}>
      <div className="day-head">
        <div>
          <h2>Trunk rotation</h2>
          <div className="muted small">{formatDate(a.takenAt)}</div>
        </div>
        <span className={`sev-chip sev-${GRADE_SEV[grade]}`}>{GRADE_TEXT[grade]}</span>
      </div>
      <dl className="volume-list">
        {(Object.entries(a.trunk.regions) as [TrunkRegion, number][]).map(([r, d]) => (
          <div key={r}><dt>{REGION[r]}</dt><dd>{angle(d)}</dd></div>
        ))}
      </dl>
      {open && grade === 'refer' && (
        <div className="referral card" role="alert">
          <h2>Worth a professional check</h2>
          <p className="small">
            A trunk rotation of {ATR_REFER}° or more in the forward bend is the usual point where screenings suggest seeing a
            physiotherapist or doctor. It often turns out to be minor, and only a professional can tell what it is. Until then,
            avoid heavy loading that hurts, and keep training both sides evenly.
          </p>
        </div>
      )}
      {open && grade === 'borderline' && (
        <p className="small">A small rotation. Readings vary by a degree or two, so re-test in a few weeks. If it stays at 5° or more, have it checked.</p>
      )}
      {open && grade === 'normal' && <p className="small">No clear rotation. Keep training both sides evenly.</p>}
      {open && grade !== 'normal' && worst && (
        <div className="suggestion small">
          <span className="sugg-icon">→</span>
          <span>
            Core work for both sides: Pallof presses in both directions, side planks on both sides, bird dogs, and open-book
            rotations for upper-back mobility. Side-specific corrective work for a rotation should come from a professional
            assessment, so keep these even until then.
          </span>
        </div>
      )}
      {open && (
        <button className="ghost small" onClick={() => { if (confirm('Delete this result?')) void deleteAssessment(a.id) }}>Delete</button>
      )}
    </section>
  )
}

export function ImbalancePage() {
  const [params] = useSearchParams()
  const resultId = params.get('result')
  const tests = useLiveQuery(() => db.assessments.orderBy('takenAt').reverse().toArray(), [])
  const scans = useLiveQuery(() => db.postureScans.count(), [])

  return (
    <div className="page">
      <header className="page-head">
        <h1>Imbalance tests</h1>
        <p className="muted">Find left/right and front/back imbalances, and what to train about them</p>
      </header>

      {tests?.filter((t) => t.id === resultId).map((t) => <TrunkResultCard key={t.id} a={t} open />)}

      <section className="card stack">
        <h2>Tests</h2>
        <Link to="/profile/posture" className="test-link">
          <b>Posture scan</b>
          <span className="muted small">Standing photos, front, side and back. Alone. {scans ? `${scans} saved.` : ''}</span>
        </Link>
        <Link to="/profile/imbalance/trunk" className="test-link">
          <b>Trunk rotation</b>
          <span className="muted small">Forward bend with the phone on your back. Needs a helper.</span>
        </Link>
        <p className="muted small">Coming next: movement tests comparing your left and right side (single-leg squat, overhead squat, overhead reach).</p>
      </section>

      {tests && tests.filter((t) => t.id !== resultId).length > 0 && (
        <>
          <h2 className="section-title">History</h2>
          {tests.filter((t) => t.id !== resultId).map((t) => <TrunkResultCard key={t.id} a={t} open={false} />)}
        </>
      )}

      <p className="muted small">Screening only, not a diagnosis. Stop any test that hurts.</p>
      <Link to="/profile" className="button secondary">Back</Link>
    </div>
  )
}
