import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router'
import { PostureCapture, type Facing } from '../components/PostureCapture'
import { db, type ViewCapture } from '../db/db'
import { deletePostureScan, saveSettings, savePostureScan } from '../db/repo'
import { unlockAudio, unlockSpeech } from '../lib/alerts'
import { VIEW_LABELS, VIEW_ORDER, type PostureView } from '../lib/capture'
import { formatDate, useSettings } from '../lib/hooks'

/** iOS asks for motion-sensor access, and only from a tap. Other platforms have no prompt. */
async function requestMotionPermission() {
  const DM = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
  try {
    await DM?.requestPermission?.()
  } catch {
    // Denied or unsupported: the level check shows as "can't check" and capture still works.
  }
}

export function PosturePage() {
  const settings = useSettings()
  const scans = useLiveQuery(() => db.postureScans.orderBy('takenAt').reverse().toArray(), [])
  const [height, setHeight] = useState('')
  const [facing, setFacing] = useState<Facing>('user')
  const [voice, setVoice] = useState(true)
  const [running, setRunning] = useState(false)
  const [saved, setSaved] = useState(false)

  const heightValue = height || (settings?.heightCm ? String(settings.heightCm) : '')
  const heightCm = Number(heightValue)
  const heightOk = heightCm >= 120 && heightCm <= 230

  async function start() {
    // Audio and speech must be unlocked synchronously inside the tap, before any await.
    unlockAudio()
    if (voice) unlockSpeech()
    await requestMotionPermission()
    void saveSettings({ heightCm })
    setSaved(false)
    setRunning(true)
  }

  async function finish(views: Partial<Record<PostureView, ViewCapture>>) {
    await savePostureScan({ takenAt: Date.now(), heightCm, camera: facing, views })
    setRunning(false)
    setSaved(true)
  }

  if (running) return <PostureCapture facing={facing} voice={voice} onDone={(v) => void finish(v)} onCancel={() => setRunning(false)} />

  return (
    <div className="page">
      <header className="page-head">
        <h1>Posture scan</h1>
        <p className="muted">Beta · three photos: front, side and back</p>
      </header>

      {saved && (
        <section className="card suggestion" role="status">
          <span className="sugg-icon">✓</span>
          <span>Scan saved. Posture analysis comes in the next update; your scan will be analysed then.</span>
        </section>
      )}

      <section className="card stack">
        <h2>Before you start</h2>
        <ul className="bullets small">
          <li>Wear fitted clothes or shorts, and tie long hair up so your neck shows.</li>
          <li>Stand the phone upright at hip height, 2.5–3 m away (lean it against something steady).</li>
          <li>Pick a plain background with good light in front of you.</li>
          <li>Stand relaxed, feet hip-width, arms by your sides. The app talks you into position and takes the photo by itself.</li>
        </ul>
        <p className="muted small">
          Privacy: photos never leave this phone and are not saved. Only 33 body points per view are kept.
          This is a fitness screening, not a medical diagnosis.
        </p>
      </section>

      <section className="card stack">
        <label className="field">Your height (cm)
          <input type="number" inputMode="numeric" min={120} max={230} value={heightValue} placeholder="e.g. 178"
            onChange={(e) => setHeight(e.target.value)} />
        </label>
        <p className="muted small">Used to turn the photos into centimetres.</p>
        <fieldset className="choice">
          <legend>Camera</legend>
          <div className="chips">
            <button className={`chip ${facing === 'user' ? 'on' : ''}`} onClick={() => setFacing('user')}>Front (see the screen)</button>
            <button className={`chip ${facing === 'environment' ? 'on' : ''}`} onClick={() => setFacing('environment')}>Back (sharper)</button>
          </div>
        </fieldset>
        <label className="toggle small">
          <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
          Spoken guidance
        </label>
        <button onClick={() => void start()} disabled={!heightOk}>Start scan</button>
        {!heightOk && <p className="muted small">Enter your height to start.</p>}
      </section>

      {!!scans?.length && (
        <section className="card stack">
          <h2>Your scans</h2>
          <ul className="link-list">
            {scans.map((s) => (
              <li key={s.id} className="history-row">
                <span>
                  {formatDate(s.takenAt)}
                  <span className="muted small"> · {VIEW_ORDER.filter((v) => s.views[v]).map((v) => VIEW_LABELS[v].title).join(', ')}</span>
                </span>
                <button className="ghost small" onClick={() => { if (confirm('Delete this scan?')) void deletePostureScan(s.id) }}>Delete</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link to="/more" className="button secondary">Back</Link>
    </div>
  )
}
