// Body composition (ADR-008): scan an InBody sheet (OCR on the phone) or type the values, review, save.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { db, type BodyComp } from '../db/db'
import { deleteBodyComp, saveBodyComp } from '../db/repo'
import { FIELD_ORDER, FIELDS, type InBodyField, type InBodyValues } from '../lib/inbody'
import { figureBox, resolveScan, type Status } from '../lib/inbodyScan'
import { readRegion, readSheet, type OcrStage } from '../lib/ocr'
import { formatDate, useSettings } from '../lib/hooks'

const SUMMARY: InBodyField[] = ['weightKg', 'smmKg', 'pbf']
const GROUPS: { id: 'main' | 'extra' | 'segmental'; title: string }[] = [
  { id: 'main', title: 'Main' },
  { id: 'extra', title: 'More results' },
  { id: 'segmental', title: 'Segmental lean mass' },
]

const fmt = (f: InBodyField, v: number) => `${v.toFixed(FIELDS[f].dp)}${FIELDS[f].unit && FIELDS[f].unit !== '/100' ? ` ${FIELDS[f].unit}` : ''}`
const toDateInput = (t: number) => new Date(t - new Date(t).getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
const fromDateInput = (s: string) => new Date(`${s}T12:00:00`).getTime()

interface Draft {
  source: 'scan' | 'manual'
  measuredAt: number
  fields: Partial<Record<InBodyField, string>>
  /** How each scanned value was obtained; editing a value clears its tag. */
  status: Partial<Record<InBodyField, Status>>
  /** Other readings for values marked "check". */
  alternatives?: Partial<Record<InBodyField, number[]>>
  convertedFromLb?: boolean
  photoUrl?: string
}

export function BodyPage() {
  const settings = useSettings()
  const entries = useLiveQuery(() => db.bodyComps.orderBy('measuredAt').reverse().toArray(), [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [progress, setProgress] = useState<{ stage: OcrStage; p: number } | null>(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  // The photo exists only as an in-memory object URL for comparing while reviewing.
  useEffect(() => () => { if (draft?.photoUrl) URL.revokeObjectURL(draft.photoUrl) }, [draft?.photoUrl])

  async function scan(file: File) {
    setError('')
    setDraft(null)
    setProgress({ stage: 'loading', p: 0 })
    try {
      const passes = await readSheet(file, (stage, p) => setProgress({ stage, p }))
      // InBody 270-style sheets print segmental values on a grey body figure: read it again close up.
      const box = figureBox(passes[0])
      const figure = box && passes[0].image ? await readRegion(passes[0].image, box, (stage, p) => setProgress({ stage, p })) : []
      const r = resolveScan(passes, settings?.heightCm, figure)
      const found = FIELD_ORDER.filter((f) => r.values[f] !== undefined)
      if (!found.length) {
        setError("Couldn't find InBody results in that photo. Try again closer, flat and in good light, or enter the values by hand.")
        return
      }
      setDraft({
        source: 'scan',
        measuredAt: r.date ?? Date.now(),
        fields: Object.fromEntries(found.map((f) => [f, r.values[f]!.toFixed(FIELDS[f].dp)])),
        status: r.status,
        alternatives: r.alternatives,
        convertedFromLb: r.convertedFromLb,
        photoUrl: URL.createObjectURL(file),
      })
    } catch (err) {
      setError(`The text reader failed: ${err instanceof Error ? err.message : String(err)}. You can enter the values by hand.`)
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Body composition</h1>
        <p className="muted">InBody results, stored only on this phone</p>
      </header>

      {entries && entries.length > 0 && !draft && <Latest entries={entries} />}

      {!draft && !progress && (
        <section className="card stack">
          <h2>Add a measurement</h2>
          <label className="button file-button">
            Scan InBody sheet
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void scan(f) }} />
          </label>
          <button className="secondary" onClick={() => setDraft({ source: 'manual', measuredAt: Date.now(), fields: {}, status: {} })}>Enter manually</button>
          <p className="muted small">
            Lay the printed sheet flat in good light and fill the photo with it. The text is read on this phone;
            the photo is not saved or sent anywhere. Check every value before saving.
          </p>
          {error && <p className="error small">{error}</p>}
        </section>
      )}

      {progress && (
        <section className="card stack" aria-live="polite">
          <h2>{progress.stage === 'loading' ? 'Loading the text reader…' : progress.stage === 'figure' ? 'Reading the body figure…' : 'Reading the sheet…'}</h2>
          <div className="progress"><div style={{ width: `${Math.round(progress.p * 100)}%` }} /></div>
          <p className="muted small">{progress.stage === 'loading' ? 'The first scan downloads about 7 MB; later scans work offline.' : `${Math.round(progress.p * 100)}%`}</p>
        </section>
      )}

      {draft && <Review draft={draft} onChange={setDraft} onDone={() => setDraft(null)} />}

      {entries && entries.length > 0 && !draft && (
        <section className="card stack">
          <h2>History</h2>
          <ul className="link-list">
            {entries.map((e) => (
              <li key={e.id}>
                <button className="history-row link-btn wide" aria-expanded={openId === e.id} onClick={() => setOpenId(openId === e.id ? null : e.id)}>
                  <span>{formatDate(e.measuredAt)}</span>
                  <span className="muted">{SUMMARY.filter((f) => e.values[f] !== undefined).map((f) => fmt(f, e.values[f]!)).join(' · ')}</span>
                </button>
                {openId === e.id && (
                  <div className="stack entry-detail">
                    <dl className="volume-list">
                      {FIELD_ORDER.filter((f) => e.values[f] !== undefined).map((f) => (
                        <div key={f}><dt>{FIELDS[f].label}</dt><dd>{fmt(f, e.values[f]!)}</dd></div>
                      ))}
                    </dl>
                    <p className="muted small">{e.source === 'scan' ? 'Scanned from an InBody sheet' : 'Entered by hand'}</p>
                    <button className="danger" onClick={() => { if (confirm('Delete this measurement?')) void deleteBodyComp(e.id) }}>Delete</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link to="/more" className="button secondary">Back</Link>
    </div>
  )
}

function Latest({ entries }: { entries: BodyComp[] }) {
  const [last, prev] = entries
  return (
    <section className="card stack">
      <div className="muted small">Latest · {formatDate(last.measuredAt)}</div>
      <div className="stat-row three">
        {SUMMARY.map((f) => {
          const v = last.values[f]
          const before = prev?.values[f]
          const delta = v !== undefined && before !== undefined ? v - before : undefined
          return (
            <div key={f}>
              <div className="muted small">{FIELDS[f].label}</div>
              <div className="stat-value">{v !== undefined ? fmt(f, v) : '–'}</div>
              {delta !== undefined && Math.abs(delta) >= 0.05 && (
                <div className="muted small">{delta > 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)} since {formatDate(prev.measuredAt)}</div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Review({ draft, onChange, onDone }: { draft: Draft; onChange: (d: Draft) => void; onDone: () => void }) {
  const [showPhoto, setShowPhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [today] = useState(() => toDateInput(Date.now()))
  // Editing a value counts as checking it.
  const set = (f: InBodyField, v: string) => {
    const status = { ...draft.status }
    delete status[f]
    onChange({ ...draft, fields: { ...draft.fields, [f]: v }, status })
  }
  const statusCount = (s: Status) => Object.values(draft.status).filter((x) => x === s).length

  const parsed: InBodyValues = {}
  const invalid: InBodyField[] = []
  for (const f of FIELD_ORDER) {
    const raw = draft.fields[f]?.trim().replace(',', '.')
    if (!raw) continue
    const v = Number(raw)
    if (Number.isFinite(v) && v >= FIELDS[f].min && v <= FIELDS[f].max) parsed[f] = v
    else invalid.push(f)
  }
  const canSave = Object.keys(parsed).length > 0 && invalid.length === 0

  async function save() {
    setBusy(true)
    await saveBodyComp({
      measuredAt: draft.measuredAt,
      values: parsed,
      source: draft.source,
      // Only values still as read from the photo count as scanned.
      ...(draft.source === 'scan' ? { scanned: FIELD_ORDER.filter((f) => draft.status[f] === 'read' && parsed[f] !== undefined) } : {}),
    })
    setBusy(false)
    onDone()
  }

  return (
    <section className="card stack">
      <h2>{draft.source === 'scan' ? 'Check the values' : 'Enter your results'}</h2>
      {draft.source === 'scan' && (
        <p className="small">
          Read {statusCount('read') + statusCount('check')} of {FIELD_ORDER.length} values from the photo
          {statusCount('calculated') > 0 && ` and calculated ${statusCount('calculated')}`}. Compare each one with your sheet,
          fix anything wrong and fill in what's missing (or leave it empty).
          {statusCount('check') > 0 && ' Values marked "check" were hard to read: look at those first.'}
          {draft.convertedFromLb && ' The sheet is in pounds; masses were converted to kg.'}
        </p>
      )}
      {draft.photoUrl && (
        <>
          <button className="secondary" onClick={() => setShowPhoto(!showPhoto)}>{showPhoto ? 'Hide photo' : 'Show photo'}</button>
          {showPhoto && <img className="sheet-photo" src={draft.photoUrl} alt="Your InBody sheet" />}
        </>
      )}
      <label className="field">Date measured
        <input type="date" value={toDateInput(draft.measuredAt)} max={today}
          onChange={(e) => e.target.value && onChange({ ...draft, measuredAt: fromDateInput(e.target.value) })} />
      </label>
      {GROUPS.map((g) => (
        <fieldset key={g.id} className="choice">
          <legend>{g.title}</legend>
          <div className="inbody-grid">
            {FIELD_ORDER.filter((f) => FIELDS[f].group === g.id).map((f) => {
              const st = draft.status[f]
              return (
                <label key={f} className={`field ${invalid.includes(f) ? 'invalid' : ''}`}>
                  <span>{FIELDS[f].label}{FIELDS[f].unit ? ` (${FIELDS[f].unit.replace('/', '')})` : ''}{st === 'read' && <span className="tag">from photo</span>}
                    {st === 'check' && <span className="tag check">check</span>}
                    {st === 'calculated' && <span className="tag calc" title="Worked out from your other values">calculated</span>}</span>
                  <input inputMode="decimal" value={draft.fields[f] ?? ''} placeholder={draft.source === 'scan' && !st ? 'not found' : ''}
                    aria-invalid={invalid.includes(f)} onChange={(e) => set(f, e.target.value)} />
                  {st === 'check' && draft.alternatives?.[f]?.map((alt) => (
                    <button key={alt} type="button" className="alt-pick" onClick={() => set(f, alt.toFixed(FIELDS[f].dp))}>or {alt.toFixed(FIELDS[f].dp)}?</button>
                  ))}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      {invalid.length > 0 && (
        <p className="error small">Check {invalid.map((f) => FIELDS[f].label.toLowerCase()).join(', ')}: {invalid.length > 1 ? 'these look' : 'this looks'} out of range.</p>
      )}
      <div className="row">
        <button className="secondary" onClick={onDone}>Cancel</button>
        <button onClick={() => void save()} disabled={!canSave || busy}>Save</button>
      </div>
    </section>
  )
}
