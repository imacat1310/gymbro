// Form check (ADR-022): set up the camera, record a set (landmarks only, no video kept), get a personal report.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { EXERCISE_BY_ID } from '../data/exercises'
import { db } from '../db/db'
import { getBodyData, getSettings, saveFormCheck } from '../db/repo'
import { speak, unlockAudio, unlockSpeech } from '../lib/alerts'
import { framingHint } from '../lib/form/framing'
import { analyzeForm, supportsFormCheck } from '../lib/form'
import { formProfile } from '../lib/form/profile'
import { analyzeSquat } from '../lib/form/squat'
import { EMPTY_PROFILE, type FormProfile, type FormReport, type FormView, type PoseFrame, type Recording } from '../lib/form/types'
import { formatDate } from '../lib/hooks'
import { createPoseEngine, type PoseEngine } from '../lib/pose'
import { ReportView } from '../components/FormReport'
import { VIEW_INFO } from '../lib/form/views'

type Facing = 'environment' | 'user'
type Stage = 'setup' | 'camera' | 'countdown' | 'recording' | 'report'

const MAX_RECORD_MS = 90_000

export function FormCheckPage() {
  const { exerciseId = '' } = useParams()
  const [params] = useSearchParams()
  const sessionId = params.get('session') ?? undefined
  const navigate = useNavigate()
  const ex = EXERCISE_BY_ID.get(exerciseId)
  const [view, setView] = useState<FormView>('side')
  const [facing, setFacing] = useState<Facing>('environment')
  const [stage, setStage] = useState<Stage>('setup')
  const [report, setReport] = useState<FormReport | null>(null)
  const [recording, setRecording] = useState<Recording | null>(null)
  const profile = useLiveQuery(async () => {
    const [data, s] = await Promise.all([getBodyData(), getSettings()])
    return formProfile(data, s.limitations ?? [])
  }, [])
  const history = useLiveQuery(() => db.formChecks.where('exerciseId').equals(exerciseId).reverse().sortBy('takenAt'), [exerciseId])

  if (!ex || !supportsFormCheck(exerciseId)) {
    return <div className="page"><p>No form check for this exercise yet. Squats are first.</p><Link to="/">Back</Link></div>
  }

  async function finish(rec: Recording) {
    const r = analyzeForm(rec, profile ?? EMPTY_PROFILE)
    setRecording(rec)
    setReport(r)
    setStage('report')
    if (!r.error) await saveFormCheck(r, sessionId)
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Form check</h1>
        <p className="muted">{ex.name} · beta</p>
      </header>

      {stage === 'setup' && (
        <>
          <section className="card stack">
            <h2>1. Choose the camera angle</h2>
            <div className="chips">
              {(Object.keys(VIEW_INFO) as FormView[]).map((v) => (
                <button key={v} className={`chip ${view === v ? 'on' : ''}`} aria-pressed={view === v} onClick={() => setView(v)}>{VIEW_INFO[v].title}</button>
              ))}
            </div>
            <p className="small">{VIEW_INFO[view].how}</p>
            <p className="muted small">Checks: {VIEW_INFO[view].checks}.</p>
            <fieldset className="choice">
              <legend>Camera</legend>
              <div className="chips">
                <button className={`chip ${facing === 'environment' ? 'on' : ''}`} onClick={() => setFacing('environment')}>Back (phone propped up)</button>
                <button className={`chip ${facing === 'user' ? 'on' : ''}`} onClick={() => setFacing('user')}>Front (see yourself)</button>
              </div>
            </fieldset>
          </section>
          <PersonalCard profile={profile} />
          <section className="card stack">
            <h2>2. Record a set</h2>
            <p className="small">Stand tall for a moment when recording starts, then do your reps. GymBro counts them out loud. Only body points are kept, never video.</p>
            <button onClick={() => { unlockAudio(); unlockSpeech(); setStage('camera') }}>Start camera</button>
          </section>
          {history && history.length > 0 && (
            <section className="card stack">
              <h2>Earlier checks</h2>
              <ul className="link-list">
                {history.slice(0, 5).map((h) => (
                  <li key={h.id} className="history-row"><span>{formatDate(h.takenAt)} · {VIEW_INFO[h.report.view].title}</span><span>{h.report.score}/100 · {h.report.reps.length} reps</span></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {(stage === 'camera' || stage === 'countdown' || stage === 'recording') && (
        <Recorder exerciseId={exerciseId} view={view} facing={facing} stage={stage} setStage={setStage}
          onDone={(rec) => void finish(rec)} onCancel={() => setStage('setup')} />
      )}

      {stage === 'report' && report && (
        <ReportView report={report} recording={recording}
          onAgain={() => { setReport(null); setStage('camera') }}
          onDone={() => (sessionId ? navigate('/workout') : navigate(-1))} />
      )}
    </div>
  )
}

function PersonalCard({ profile }: { profile?: FormProfile }) {
  if (!profile) return null
  const items: string[] = []
  if (profile.femurTorso !== undefined) items.push(`Thigh-to-torso ratio ${profile.femurTorso} (posture scan)`)
  if (profile.staticValgus) items.push('Knees angling in when standing (posture scan)')
  if (profile.weakLeg) items.push(`Weaker ${profile.weakLeg.side} leg, ${profile.weakLeg.diffPct}% less lean mass (InBody)`)
  for (const l of profile.limitations) items.push(`Limitation: ${l.replace('_', ' ')}`)
  return (
    <section className="card stack">
      <h2>Personalised with</h2>
      {items.length ? <ul className="bullets small">{items.map((i) => <li key={i}>{i}</li>)}</ul>
        : <p className="small muted">No body data yet. A <Link to="/profile/posture">posture scan</Link> sets your personal lean limit and knee checks.</p>}
    </section>
  )
}

/** Camera, live skeleton, framing check, countdown, recording with spoken rep count. */
function Recorder({ exerciseId, view, facing, stage, setStage, onDone, onCancel }: {
  exerciseId: string; view: FormView; facing: Facing; stage: Stage
  setStage: (s: Stage) => void; onDone: (rec: Recording) => void; onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef(stage)
  const framesRef = useRef<PoseFrame[]>([])
  const [hint, setHint] = useState<string | undefined>('Starting camera…')
  const [reps, setReps] = useState(0)
  const [count, setCount] = useState(3)
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  // The camera loop lives across renders: read the latest stage and callback through refs, so a profile that
  // loads after the camera started is still used for the analysis.
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    stageRef.current = stage
    onDoneRef.current = onDone
  })

  useEffect(() => {
    let raf = 0
    let stream: MediaStream | null = null
    let engine: PoseEngine | null = null
    let cancelled = false
    let lastVideoTime = -1
    let lastCount = 0
    let recordStart = 0
    let lastRepCheck = 0

    ;(async () => {
      try {
        engine = await createPoseEngine('lite', 'GPU', 'VIDEO')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        if (cancelled) return
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        const drawer = engine.createDrawer(ctx)
        const tick = () => {
          raf = requestAnimationFrame(tick)
          if (video.readyState < 2 || video.currentTime === lastVideoTime || !engine) return
          lastVideoTime = video.currentTime
          if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight }
          const now = performance.now()
          const lms = engine.landmarker.detectForVideo(video, now).landmarks[0]
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          if (lms) {
            drawer.drawConnectors(lms, engine.connections, { color: '#22d3ee', lineWidth: 4 })
            drawer.drawLandmarks(lms, { color: '#f8fafc', radius: 3 })
          }
          const s = stageRef.current
          if (s === 'camera') setHint(framingHint(lms, view, video.videoWidth, video.videoHeight))
          if (s === 'recording') {
            if (!recordStart) recordStart = now
            if (lms) framesRef.current.push({ t: now, lms: lms.map((l) => ({ ...l })) })
            // Live rep count from the same analysis (cheap at these sizes), spoken as it goes up.
            if (now - lastRepCheck > 700) {
              lastRepCheck = now
              const rec: Recording = { exerciseId, view, width: video.videoWidth, height: video.videoHeight, frames: framesRef.current }
              const n = analyzeSquat(rec, EMPTY_PROFILE).reps.length
              if (n > lastCount) { lastCount = n; setReps(n); speak(String(n)) }
            }
            if (now - recordStart > MAX_RECORD_MS) stopRef.current?.()
          }
        }
        tick()
        setHint(undefined)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })()

    stopRef.current = () => {
      const video = videoRef.current
      const frames = framesRef.current
      framesRef.current = []
      onDoneRef.current({ exerciseId, view, width: video?.videoWidth ?? 1280, height: video?.videoHeight ?? 720, frames })
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      engine?.landmarker.close()
    }
    // The camera runs for the life of the recorder; stage and callbacks are read through refs.
  }, [facing, view, exerciseId])

  // 3, 2, 1, go: each step happens on the timer, then recording starts.
  useEffect(() => {
    if (stage !== 'countdown') return
    speak(String(count))
    const t = setTimeout(() => {
      if (count > 1) { setCount(count - 1); return }
      speak('Go')
      framesRef.current = []
      setReps(0)
      setStage('recording')
    }, 1000)
    return () => clearTimeout(t)
  }, [stage, count, setStage])

  if (error) {
    return (
      <section className="card stack">
        <p className="error">Camera error: {error}</p>
        <button className="secondary" onClick={onCancel}>Back</button>
      </section>
    )
  }

  return (
    <section className="stack">
      <div className={`stage ${facing === 'user' ? 'mirrored' : ''}`}>
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
        <div className="hud">
          {stage === 'camera' && <span>{hint ?? 'Ready'}</span>}
          {stage === 'countdown' && <span className="big">{count}</span>}
          {stage === 'recording' && <span>● Recording · {reps} rep{reps === 1 ? '' : 's'}</span>}
        </div>
      </div>
      {stage === 'camera' && (
        <div className="row">
          <button className="secondary" onClick={onCancel}>Cancel</button>
          <button disabled={!!hint} onClick={() => { setCount(3); setStage('countdown') }}>{hint ? 'Get in position' : 'Record'}</button>
        </div>
      )}
      {stage === 'recording' && <button className="log-btn" onClick={() => stopRef.current?.()}>Stop and analyse</button>}
    </section>
  )
}
