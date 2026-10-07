import { useEffect, useRef, useState } from 'react'
import { angleDeg, createPoseEngine, LM, type Delegate, type PoseEngine, type PoseModel } from '../lib/pose'

type Facing = 'user' | 'environment'
const BENCH_MS = 10_000

interface BenchResult {
  model: PoseModel
  delegate: Delegate
  resolution: string
  fps: number
  medianMs: number
  p95Ms: number
  detectedPct: number
  avgVisibility: number
  loadMs: number
}

function percentile(sorted: number[], p: number) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0
}

export function PoseTest() {
  const [model, setModel] = useState<PoseModel>('lite')
  const [delegate, setDelegate] = useState<Delegate>('GPU')
  const [facing, setFacing] = useState<Facing>('user')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const [live, setLive] = useState({ fps: 0, ms: 0, knee: null as number | null, delegate: '' })
  const [benchLeft, setBenchLeft] = useState(0)
  const [results, setResults] = useState<BenchResult[]>([])
  const [copied, setCopied] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<PoseEngine | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const loadMsRef = useRef(0)
  const benchRef = useRef<{ until: number; times: number[]; frames: number; detected: number; visSum: number } | null>(null)

  function stop() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    engineRef.current?.landmarker.close()
    engineRef.current = null
    benchRef.current = null
    setBenchLeft(0)
    setRunning(false)
  }

  useEffect(() => stop, [])

  async function start() {
    setStatus('Loading model…')
    try {
      const engine = await createPoseEngine(model, delegate)
      loadMsRef.current = engine.loadMs
      engineRef.current = engine

      setStatus('Starting camera…')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()

      setStatus('')
      setRunning(true)
      loop(engine)
    } catch (err) {
      stop()
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function loop(engine: PoseEngine) {
    const video = videoRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const drawer = engine.createDrawer(ctx)
    let lastVideoTime = -1
    let frameTimes: number[] = []
    let emaMs = 0
    let lastUi = 0

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime

      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }

      const t0 = performance.now()
      const result = engine.landmarker.detectForVideo(video, t0)
      const ms = performance.now() - t0
      emaMs = emaMs ? emaMs * 0.9 + ms * 0.1 : ms

      const now = performance.now()
      frameTimes.push(now)
      frameTimes = frameTimes.filter((t) => now - t < 1000)

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const lms = result.landmarks[0]
      let knee: number | null = null
      if (lms) {
        drawer.drawConnectors(lms, engine.connections, { color: '#22c55e', lineWidth: 4 })
        drawer.drawLandmarks(lms, { color: '#f8fafc', radius: 3 })
        // Use whichever leg the camera sees better.
        const left = lms[LM.leftKnee].visibility >= lms[LM.rightKnee].visibility
        knee = left
          ? angleDeg(lms[LM.leftHip], lms[LM.leftKnee], lms[LM.leftAnkle], canvas.width, canvas.height)
          : angleDeg(lms[LM.rightHip], lms[LM.rightKnee], lms[LM.rightAnkle], canvas.width, canvas.height)
      }

      const bench = benchRef.current
      if (bench) {
        bench.times.push(ms)
        bench.frames++
        if (lms) {
          bench.detected++
          bench.visSum += lms.reduce((s, l) => s + l.visibility, 0) / lms.length
        }
        if (now >= bench.until) finishBench(engine, video)
      }

      if (now - lastUi > 250) {
        lastUi = now
        setLive({ fps: frameTimes.length, ms: emaMs, knee, delegate: engine.delegate })
        if (bench) setBenchLeft(Math.max(0, Math.ceil((bench.until - now) / 1000)))
      }
    }
    tick()
  }

  function startBench() {
    benchRef.current = { until: performance.now() + BENCH_MS, times: [], frames: 0, detected: 0, visSum: 0 }
    setBenchLeft(BENCH_MS / 1000)
  }

  function finishBench(engine: PoseEngine, video: HTMLVideoElement) {
    const b = benchRef.current!
    benchRef.current = null
    setBenchLeft(0)
    const sorted = [...b.times].sort((x, y) => x - y)
    setResults((r) => [...r, {
      model,
      delegate: engine.delegate,
      resolution: `${video.videoWidth}×${video.videoHeight}`,
      fps: Math.round((b.frames / BENCH_MS) * 1000 * 10) / 10,
      medianMs: Math.round(percentile(sorted, 0.5)),
      p95Ms: Math.round(percentile(sorted, 0.95)),
      detectedPct: b.frames ? Math.round((b.detected / b.frames) * 100) : 0,
      avgVisibility: b.detected ? Math.round((b.visSum / b.detected) * 100) / 100 : 0,
      loadMs: loadMsRef.current,
    }])
  }

  async function copyResults() {
    const lines = [
      `GymBro pose benchmark v${__APP_VERSION__}`,
      navigator.userAgent,
      ...results.map((r) =>
        `${r.model}/${r.delegate} ${r.resolution}: ${r.fps} fps, median ${r.medianMs} ms, p95 ${r.p95Ms} ms, ` +
        `pose ${r.detectedPct}%, vis ${r.avgVisibility}, load ${r.loadMs} ms`),
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="card">
      <h2>Pose test</h2>
      <p className="muted">Measures how fast body tracking runs on this phone. Stand 2–3 m from the camera with your full body in view.</p>

      <div className="controls">
        <label>Model
          <select value={model} disabled={running} onChange={(e) => setModel(e.target.value as PoseModel)}>
            <option value="lite">Lite (fast)</option>
            <option value="full">Full (accurate)</option>
          </select>
        </label>
        <label>Processor
          <select value={delegate} disabled={running} onChange={(e) => setDelegate(e.target.value as Delegate)}>
            <option value="GPU">GPU</option>
            <option value="CPU">CPU</option>
          </select>
        </label>
        <label>Camera
          <select value={facing} disabled={running} onChange={(e) => setFacing(e.target.value as Facing)}>
            <option value="user">Front</option>
            <option value="environment">Back</option>
          </select>
        </label>
      </div>

      <div className="row">
        {!running
          ? <button onClick={start}>Start</button>
          : <button className="secondary" onClick={stop}>Stop</button>}
        {running && <button onClick={startBench} disabled={benchLeft > 0}>
          {benchLeft > 0 ? `Benchmarking… ${benchLeft}s` : 'Run 10 s benchmark'}
        </button>}
      </div>
      {status && <p className={status.startsWith('Error') ? 'error' : 'muted'}>{status}</p>}

      <div className={`stage ${facing === 'user' ? 'mirrored' : ''}`} hidden={!running}>
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
        <div className="hud">
          <span>{live.fps} fps</span>
          <span>{live.ms.toFixed(0)} ms</span>
          <span>{live.delegate}</span>
          <span>knee {live.knee === null ? '–' : `${live.knee.toFixed(0)}°`}</span>
        </div>
      </div>

      {results.length > 0 && (
        <>
          <h3>Results</h3>
          <div className="table-wrap">
            <table className="results">
              <thead><tr><th>Model</th><th>FPS</th><th>Median</th><th>p95</th><th>Pose</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.model}/{r.delegate}</td>
                    <td>{r.fps}</td>
                    <td>{r.medianMs} ms</td>
                    <td>{r.p95Ms} ms</td>
                    <td>{r.detectedPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={copyResults}>{copied ? 'Copied ✓' : 'Copy results'}</button>
        </>
      )}
    </section>
  )
}
