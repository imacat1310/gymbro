// Guided posture capture (features/02-posture-scan.md, ADR-006). The Lite model tracks the live camera and drives
// the checklist; when everything passes and you hold still, a countdown runs and the Full model analyses a burst of
// frames. Frames live only in memory and are dropped after review: only landmarks are kept.
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { useEffect, useRef, useState } from 'react'
import type { ViewCapture } from '../db/db'
import { beep, speak } from '../lib/alerts'
import {
  bodyExtent, evaluateFrame, firstHint, isStill, landmarkSpread, medianLandmarks, motionPoints, nearSide,
  isSideView, OPTIONAL_VIEWS, readyToCapture, tiltFromGravity, VIEW_LABELS, VIEW_ORDER, type Check, type MotionSample, type PostureView, type Tilt,
} from '../lib/capture'
import { useWakeLock } from '../lib/hooks'
import { createPoseEngine, type PoseEngine } from '../lib/pose'
import { pelvicTiltDeg } from '../lib/posture'
import { PelvisMarker } from './PelvisMarker'

type Phase = 'loading' | 'live' | 'countdown' | 'grabbing' | 'processing' | 'review' | 'error'
export type Facing = 'user' | 'environment'

const COUNTDOWN_MS = 3000
const BURST = 5
const BURST_GAP_MS = 120
/** Breathing moves the body a little; during the countdown only real movement cancels it. */
const COUNTDOWN_TOL = 0.025
/** A check flickering for a frame or two near its threshold shouldn't restart the countdown. */
const GRACE_MS = 500
const SAY_AGAIN_MS = 6000

interface Review {
  canvas: HTMLCanvasElement
  /** The same frame without the skeleton, for tapping the hip stickers (ADR-023). */
  photo: HTMLCanvasElement
  capture: ViewCapture
  tracked: number
}

interface Props {
  facing: Facing
  voice: boolean
  onDone: (views: Partial<Record<PostureView, ViewCapture>>) => void
  onCancel: () => void
}

/** Mean luma of the frame, 0–1, from a tiny downscaled copy. */
function brightnessOf(video: HTMLVideoElement, probe: HTMLCanvasElement) {
  const ctx = probe.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(video, 0, 0, probe.width, probe.height)
  const px = ctx.getImageData(0, 0, probe.width, probe.height).data
  let sum = 0
  for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
  return sum / (px.length / 4) / 255
}

function steadiness(spread: number) {
  if (spread < 0.005) return 'steady'
  if (spread < 0.01) return 'mostly steady'
  return 'a bit shaky, consider retaking'
}

export function PostureCapture({ facing, voice, onDone, onCancel }: Props) {
  const [viewIdx, setViewIdx] = useState(0)
  const [phase, setPhaseState] = useState<Phase>('loading')
  const [checks, setChecks] = useState<Check[]>([])
  const [still, setStill] = useState(false)
  const [count, setCount] = useState(0)
  const [error, setError] = useState('')
  const [review, setReview] = useState<Review | null>(null)
  const [marking, setMarking] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reviewHostRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<Phase>('loading')
  const viewRef = useRef<PostureView>(VIEW_ORDER[0])
  const resultsRef = useRef<Partial<Record<PostureView, ViewCapture>>>({})
  const tiltRef = useRef<{ tilt: Tilt; at: number } | null>(null)
  const voiceRef = useRef(voice)
  const enginesRef = useRef<{ live: PoseEngine; still: PoseEngine } | null>(null)
  const burstRef = useRef<{ frames: HTMLCanvasElement[]; tilt: Tilt | null; lastAt: number }>({ frames: [], tilt: null, lastAt: 0 })

  useWakeLock(true)

  const setPhase = (p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }
  const say = (text: string) => { if (voiceRef.current) speak(text) }

  // Phone tilt from the accelerometer, smoothed. Permission was requested by the tap that opened this screen.
  useEffect(() => {
    let g: { x: number; y: number; z: number } | null = null
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (a?.x == null || a.y == null || a.z == null) return
      g = g ? { x: g.x * 0.8 + a.x * 0.2, y: g.y * 0.8 + a.y * 0.2, z: g.z * 0.8 + a.z * 0.2 } : { x: a.x, y: a.y, z: a.z }
      tiltRef.current = { tilt: tiltFromGravity(g.x, g.y, g.z), at: performance.now() }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [])

  useEffect(() => {
    let cancelled = false
    let raf = 0
    let stream: MediaStream | null = null

    async function start() {
      try {
        const [live, stillEngine, media] = await Promise.all([
          createPoseEngine('lite', 'GPU', 'VIDEO'),
          createPoseEngine('full', 'GPU', 'IMAGE'),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          }),
        ])
        stream = media
        enginesRef.current = { live, still: stillEngine }
        if (cancelled) return
        const video = videoRef.current!
        video.srcObject = media
        await video.play()
        if (cancelled) return
        setPhase('live')
        say(`${VIEW_LABELS[viewRef.current].title} view. ${VIEW_LABELS[viewRef.current].instruction}.`)
        loop(video, live)
      } catch (err) {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ''
        setError(name === 'NotAllowedError'
          ? 'Camera access was blocked. Allow the camera for this site in your browser settings, then try again.'
          : `Couldn't start the camera or body tracking: ${err instanceof Error ? err.message : String(err)}`)
        setPhase('error')
      }
    }

    function loop(video: HTMLVideoElement, live: PoseEngine) {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      const drawer = live.createDrawer(ctx)
      const probe = Object.assign(document.createElement('canvas'), { width: 24, height: 32 })
      let lastVideoTime = -1
      let motion: MotionSample[] = []
      let brightness: number | null = null
      let lastProbe = 0
      let lastUi = 0
      let countdownStart = 0
      let lastCount = 0
      let troubleSince = 0
      let pendingHint: { text: string; since: number } | null = null
      let lastSaid = { text: '', at: 0 }

      const tick = () => {
        raf = requestAnimationFrame(tick)
        if (video.readyState < 2 || video.currentTime === lastVideoTime) return
        lastVideoTime = video.currentTime
        const now = performance.now()
        const cur = phaseRef.current

        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        if (cur === 'grabbing') {
          const burst = burstRef.current
          if (now - burst.lastAt >= BURST_GAP_MS) {
            const f = Object.assign(document.createElement('canvas'), { width: video.videoWidth, height: video.videoHeight })
            f.getContext('2d')!.drawImage(video, 0, 0)
            burst.frames.push(f)
            burst.lastAt = now
            if (burst.frames.length >= BURST) {
              setPhase('processing')
              // Let React paint "Analysing…" before the synchronous Full-model pass.
              setTimeout(processBurst, 30)
            }
          }
          return
        }
        if (cur !== 'live' && cur !== 'countdown') return

        const lms: NormalizedLandmark[] | undefined = live.landmarker.detectForVideo(video, now).landmarks[0]
        if (now - lastProbe > 500) {
          brightness = brightnessOf(video, probe)
          lastProbe = now
        }
        const t = tiltRef.current
        const tilt = t && now - t.at < 1000 ? t.tilt : null
        const frameChecks = evaluateFrame({ lms, width: video.videoWidth, height: video.videoHeight, view: viewRef.current, tilt, brightness })
        const ready = readyToCapture(frameChecks)

        let span = 0
        if (lms) {
          motion.push({ t: now, pts: motionPoints(lms) })
          motion = motion.filter((m) => now - m.t <= 1500)
          span = bodyExtent(lms).span
        } else motion = []
        const isSteady = !!lms && isStill(motion, now, span)

        // Overlay: margins the body must stay inside, a centre plumb line, and the tracked skeleton.
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.save()
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)'
        ctx.lineWidth = Math.max(2, canvas.width / 360)
        ctx.setLineDash([12, 10])
        ctx.beginPath()
        ctx.moveTo(canvas.width / 2, 0)
        ctx.lineTo(canvas.width / 2, canvas.height)
        const m = canvas.height * 0.02
        ctx.moveTo(0, m); ctx.lineTo(canvas.width, m)
        ctx.moveTo(0, canvas.height - m); ctx.lineTo(canvas.width, canvas.height - m)
        ctx.stroke()
        ctx.restore()
        if (lms) {
          const color = ready ? (cur === 'countdown' ? '#22c55e' : '#86efac') : '#fbbf24'
          drawer.drawConnectors(lms, live.connections, { color, lineWidth: 4 })
          drawer.drawLandmarks(lms, { color: '#f8fafc', radius: 3 })
        }

        if (cur === 'live' && ready && isSteady) {
          countdownStart = now
          lastCount = 0
          troubleSince = 0
          setPhase('countdown')
          say('Hold still')
        } else if (cur === 'countdown') {
          const ok = ready && isStill(motion, now, span, 800, COUNTDOWN_TOL)
          if (ok) troubleSince = 0
          else troubleSince ||= now
          if (!ok && now - troubleSince > GRACE_MS) {
            setPhase('live')
          } else {
            const left = Math.ceil((COUNTDOWN_MS - (now - countdownStart)) / 1000)
            if (left !== lastCount && left > 0) {
              lastCount = left
              setCount(left)
              void beep(1)
            }
            if (ok && now - countdownStart >= COUNTDOWN_MS) {
              burstRef.current = { frames: [], tilt, lastAt: 0 }
              setPhase('grabbing')
            }
          }
        }

        if (now - lastUi > 250) {
          lastUi = now
          setChecks(frameChecks)
          setStill(isSteady)
        }

        // Speak the most important fix once it has been showing for a moment; repeat it now and then.
        if (phaseRef.current === 'live') {
          const hint = firstHint(frameChecks) ?? (ready && !isSteady ? 'Hold still' : undefined)
          if (!hint) pendingHint = null
          else if (pendingHint?.text !== hint) pendingHint = { text: hint, since: now }
          else if (now - pendingHint.since > 800 && (hint !== lastSaid.text || now - lastSaid.at > SAY_AGAIN_MS)) {
            say(hint)
            lastSaid = { text: hint, at: now }
          }
        }
      }
      tick()
    }

    void start()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      enginesRef.current?.live.landmarker.close()
      enginesRef.current?.still.landmarker.close()
      enginesRef.current = null
      if ('speechSynthesis' in window) speechSynthesis.cancel()
    }
    // The camera and models load once; views and phases change through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing])

  function processBurst() {
    const engines = enginesRef.current
    if (!engines) return
    const { frames, tilt } = burstRef.current
    const poses = frames
      .map((f) => engines.still.landmarker.detect(f))
      .map((r, i) => ({ lms: r.landmarks[0], world: r.worldLandmarks[0], frame: frames[i] }))
      .filter((p) => p.lms && p.world)

    if (poses.length < 3) {
      say("Couldn't see you clearly. Let's try again.")
      setPhase('live')
      return
    }
    const landmarks = medianLandmarks(poses.map((p) => p.lms))
    const capture: ViewCapture = {
      landmarks,
      worldLandmarks: medianLandmarks(poses.map((p) => p.world)),
      width: frames[0].width,
      height: frames[0].height,
      tilt: tilt && { rollDeg: Math.round(tilt.rollDeg * 10) / 10, pitchDeg: Math.round(tilt.pitchDeg * 10) / 10 },
      frames: poses.length,
      spread: landmarkSpread(poses.map((p) => p.lms), landmarks),
      ...(isSideView(viewRef.current) ? { nearSide: nearSide(landmarks) } : {}),
    }

    // The middle frame, with the Full-model skeleton, is shown for review and then discarded.
    const shown = poses[Math.floor(poses.length / 2)].frame
    const photo = document.createElement('canvas')
    photo.width = shown.width
    photo.height = shown.height
    photo.getContext('2d')!.drawImage(shown, 0, 0)
    const drawer = engines.still.createDrawer(shown.getContext('2d')!)
    drawer.drawConnectors(landmarks, engines.still.connections, { color: '#22c55e', lineWidth: Math.max(3, shown.width / 200) })
    drawer.drawLandmarks(landmarks, { color: '#f8fafc', radius: Math.max(3, shown.width / 250) })
    burstRef.current = { frames: [], tilt: null, lastAt: 0 }
    setReview({ canvas: shown, photo, capture, tracked: poses.length })
    setPhase('review')
    void beep(2)
    say('Got it. Check the photo.')
  }

  useEffect(() => {
    const host = reviewHostRef.current
    if (!host) return
    host.replaceChildren(...(review ? [review.canvas] : []))
  }, [review])

  function retake() {
    setReview(null)
    setMarking(false)
    setPhase('live')
    say(VIEW_LABELS[viewRef.current].instruction)
  }

  function accept() {
    if (!review) return
    setMarking(false)
    resultsRef.current = { ...resultsRef.current, [viewRef.current]: review.capture }
    setReview(null)
    advance()
  }

  /** Optional views (the right side) can be skipped; the report then uses the left side only. */
  function skip() {
    setReview(null)
    advance()
  }

  function advance() {
    const next = viewIdx + 1
    if (next >= VIEW_ORDER.length) {
      say('All done.')
      onDone(resultsRef.current)
      return
    }
    viewRef.current = VIEW_ORDER[next]
    setViewIdx(next)
    setChecks([])
    setPhase('live')
    say(`${VIEW_LABELS[VIEW_ORDER[next]].title} view. ${VIEW_LABELS[VIEW_ORDER[next]].instruction}.`)
  }

  const view = VIEW_ORDER[viewIdx]
  const hint = phase === 'countdown' ? 'Hold still…'
    : firstHint(checks) ?? (checks.length && readyToCapture(checks) && !still ? 'Hold still' : '')
  const mirrored = facing === 'user' ? 'mirrored' : ''
  const level = review?.capture.tilt
  const reviewTilt = review?.capture.pelvis ? pelvicTiltDeg(review.capture, facing) : undefined

  return (
    <div className="capture" role="dialog" aria-label="Posture capture">
      <div className="capture-top">
        <div>
          <strong>{viewIdx + 1}/{VIEW_ORDER.length} · {VIEW_LABELS[view].title}</strong>
          <span className="muted small"> {VIEW_LABELS[view].instruction}</span>
        </div>
        <button className="ghost" onClick={onCancel}>Cancel</button>
      </div>

      <div className={`capture-stage ${mirrored}`} hidden={phase === 'review'}>
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
        {phase === 'countdown' && <div className="countdown" aria-live="assertive">{count}</div>}
        {(phase === 'grabbing' || phase === 'processing') && <div className="countdown small-text">Analysing…</div>}
      </div>
      <div className={`capture-stage review ${mirrored}`} ref={reviewHostRef} hidden={phase !== 'review'} />

      <div className="capture-panel">
        {phase === 'loading' && <p className="muted">Loading camera and body tracking…</p>}
        {phase === 'error' && (
          <>
            <p className="error">{error}</p>
            <button className="secondary" onClick={onCancel}>Back</button>
          </>
        )}
        {(phase === 'live' || phase === 'countdown') && (
          <>
            <p className="capture-hint" aria-live="polite">{hint || 'Looking good'}</p>
            {OPTIONAL_VIEWS.includes(view) && (
              <button className="ghost small" onClick={skip}>Skip {VIEW_LABELS[view].title.toLowerCase()} (optional)</button>
            )}
            <ul className="capture-checks">
              {checks.map((c) => (
                <li key={c.id} className={c.ok ? 'ok' : c.soft ? 'soft' : 'bad'}>
                  <span aria-hidden>{c.ok ? '✓' : c.soft ? '!' : '✕'}</span> {c.label}
                </li>
              ))}
            </ul>
          </>
        )}
        {review && phase === 'review' && marking && (
          <PelvisMarker photo={review.photo} capture={review.capture} camera={facing} mirrored={facing === 'user'}
            onCancel={() => setMarking(false)}
            onDone={(pelvis) => { setReview({ ...review, capture: { ...review.capture, pelvis } }); setMarking(false) }} />
        )}
        {review && phase === 'review' && !marking && (
          <>
            <p className="small">
              Body tracked in {review.tracked}/{BURST} frames · {steadiness(review.capture.spread)}
              {level ? ` · phone tilt ${Math.abs(level.rollDeg).toFixed(1)}° sideways` : ' · phone level not measured'}
            </p>
            <p className="muted small">Check that the skeleton follows your body. The photo is not saved: only these points are.</p>
            {isSideView(view) && (
              <button className="ghost small" onClick={() => setMarking(true)}>
                {reviewTilt !== undefined
                  ? `Hip stickers marked: ${Math.abs(reviewTilt).toFixed(0)}° ${reviewTilt >= 0 ? 'forward' : 'backward'} · change`
                  : 'Wearing hip stickers? Mark them for pelvic tilt (optional)'}
              </button>
            )}
            <div className="row">
              <button className="secondary" onClick={retake}>Retake</button>
              <button onClick={accept}>{viewIdx + 1 < VIEW_ORDER.length ? 'Next view' : 'Save scan'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
