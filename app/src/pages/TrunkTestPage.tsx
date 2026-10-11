// Trunk rotation test (ADR-010): forward-bend test with the phone as a scoliometer. A helper holds the phone.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { saveAssessment } from '../db/repo'
import { beep, unlockAudio } from '../lib/alerts'
import { useWakeLock } from '../lib/hooks'
import { onGravity, requestMotionPermission } from '../lib/motion'
import {
  angleAcross, ATR_BORDERLINE, ATR_REFER, calibrate, gradeAtr, peakOf, sideOf, smoothed, type Sample, type TrunkRegion,
} from '../lib/trunk'

type Step = 'intro' | 'calibrate' | TrunkRegion | 'done'

const REGION_TEXT: Record<TrunkRegion, { title: string; where: string }> = {
  upper: { title: 'Upper back', where: 'Start between the shoulder blades and slide slowly down to the bottom of the shoulder blades.' },
  lower: { title: 'Lower back', where: 'Start at the bottom of the ribs and slide slowly down to the waistband.' },
}

const fmt = (d: number) => `${Math.abs(d).toFixed(1)}°`
const sideText = (d: number) => {
  const s = sideOf(d)
  return s ? `${s === 'right' ? 'Right' : 'Left'} side higher` : 'Level'
}

/** Live, smoothed angle across the back from the motion sensor, after calibration, with peak tracking. */
function useAcross(active: boolean, offset: number, trackPeak: boolean) {
  const [now, setNow] = useState<number | null>(null)
  const [peak, setPeak] = useState<number | null>(null)
  const [seen, setSeen] = useState(false)
  const samples = useRef<Sample[]>([])
  useEffect(() => {
    if (!active) return
    let last = 0
    return onGravity((g) => {
      setSeen(true)
      const a = angleAcross(g)
      if (a === null) {
        samples.current = []
        if (g.t - last > 100) { last = g.t; setNow(null) }
        return
      }
      samples.current.push({ t: g.t, deg: a - offset })
      samples.current = samples.current.filter((s) => g.t - s.t <= 1000)
      if (g.t - last > 100) {
        last = g.t
        const v = smoothed(samples.current, g.t)
        setNow(v)
        if (trackPeak && v !== null) setPeak((p) => peakOf(p, v))
      }
    })
  }, [active, offset, trackPeak])
  return {
    now, seen, peak,
    resetPeak: () => setPeak(null),
    /** Clear history, e.g. before collecting calibration readings. */
    clear: () => { samples.current = [] },
    readings: () => samples.current.map((s) => s.deg),
  }
}

export function TrunkTestPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('intro')
  const [offset, setOffset] = useState(0)
  const [calMsg, setCalMsg] = useState('')
  const [regions, setRegions] = useState<Partial<Record<TrunkRegion, number>>>({})
  const [noSensor, setNoSensor] = useState(false)
  const measuring = step === 'calibrate' || step === 'upper' || step === 'lower'
  const sensor = useAcross(measuring, step === 'calibrate' ? 0 : offset, step === 'upper' || step === 'lower')
  const { now, seen, peak, resetPeak } = sensor
  useWakeLock(measuring)

  // No motion data at all a couple of seconds after starting → this browser doesn't provide it.
  useEffect(() => {
    if (!measuring || seen) return
    const t = setTimeout(() => setNoSensor(true), 2500)
    return () => clearTimeout(t)
  }, [measuring, seen])

  async function begin() {
    unlockAudio()
    await requestMotionPermission()
    setStep('calibrate')
  }

  function doCalibrate() {
    setCalMsg('Hold still…')
    sensor.clear()
    setTimeout(() => {
      const r = calibrate(sensor.readings())
      if ('offset' in r) {
        setOffset(r.offset)
        setCalMsg('')
        beep(1)
        setStep('upper')
        resetPeak()
      } else {
        setCalMsg(r.error === 'moving' ? 'The phone moved. Leave it untouched on the table and try again.'
          : r.error === 'not_flat' ? "That surface isn't flat. Use a table or the floor."
            : 'No readings yet. Lay the phone flat, screen up, and try again.')
      }
    }, 1500)
  }

  async function saveRegion(region: TrunkRegion) {
    if (peak === null) return
    const next = { ...regions, [region]: Math.round(peak * 10) / 10 }
    setRegions(next)
    resetPeak()
    beep(1)
    if (region === 'upper') setStep('lower')
    else {
      const id = await saveAssessment({ type: 'trunk_rotation', takenAt: Date.now(), trunk: { regions: next, offsetDeg: Math.round(offset * 10) / 10 } })
      navigate(`/profile/imbalance?result=${id}`)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Trunk rotation test</h1>
        <p className="muted">Forward bend · needs a helper · about 2 minutes</p>
      </header>

      {noSensor && (
        <p className="card error small">
          This browser isn't sharing motion data. On iPhone, allow "Motion & Orientation Access" for this site when asked
          (or in Settings → Safari), then start again.
        </p>
      )}

      {step === 'intro' && (
        <section className="card stack">
          <p className="small">
            This checks whether one side of your back rises higher than the other when you bend forward, which shows a
            rotation of the trunk. It's the forward-bend test physios use in spine screening, with the phone as the measuring tool.
          </p>
          <h2>How to bend</h2>
          <ul className="bullets small">
            <li>Shirt off or a thin, tight top. Feet together, knees straight.</li>
            <li>Palms together, arms hanging. Bend forward slowly until your back is roughly level, head relaxed.</li>
            <li>Stop if it hurts.</li>
          </ul>
          <h2>The helper</h2>
          <ul className="bullets small">
            <li>Stands behind you and lays the phone across your back, <b>screen up, top of the phone pointing to your right</b>.</li>
            <li>Keeps it centred on the spine and slides it slowly, without pressing.</li>
          </ul>
          <button onClick={() => void begin()}>Start</button>
        </section>
      )}

      {step === 'calibrate' && (
        <section className="card stack">
          <h2>1 · Calibrate</h2>
          <p className="small">Lay the phone on a table or the floor, screen up, and don't touch it. Camera bumps make phones rock; this cancels that out.</p>
          <div className="big-angle muted">{now === null ? '–' : `${now.toFixed(1)}°`}</div>
          <button onClick={doCalibrate} disabled={calMsg === 'Hold still…'}>{calMsg === 'Hold still…' ? 'Hold still…' : 'Calibrate'}</button>
          {calMsg && calMsg !== 'Hold still…' && <p className="error small">{calMsg}</p>}
        </section>
      )}

      {(step === 'upper' || step === 'lower') && (
        <section className="card stack">
          <h2>{step === 'upper' ? '2' : '3'} · {REGION_TEXT[step].title}</h2>
          <p className="small">{REGION_TEXT[step].where} Top of the phone to the person's right, screen up.</p>
          <div className={`big-angle grade-${now === null ? 'none' : gradeAtr(Math.abs(now))}`} aria-live="polite">
            {now === null ? 'Lay the phone on the back' : fmt(now)}
          </div>
          <div className="muted small center">{now === null ? '' : sideText(now)}</div>
          <div className="peak-row">
            <span>Highest: <b>{peak === null ? '–' : `${fmt(peak)} · ${sideText(peak)}`}</b></span>
            <button className="ghost small" onClick={resetPeak}>Reset</button>
          </div>
          <button onClick={() => void saveRegion(step)} disabled={peak === null}>
            {step === 'upper' ? 'Save and go to the lower back' : 'Save and see the result'}
          </button>
          <p className="muted small">Under {ATR_BORDERLINE}° is common. {ATR_BORDERLINE}–{ATR_REFER - 0.1}° is worth re-testing; {ATR_REFER}° or more is worth a professional check.</p>
        </section>
      )}

      <Link to="/profile/imbalance" className="button secondary">Cancel</Link>
    </div>
  )
}
