// Tap the two hip stickers on a zoomed crop of the side photo (ADR-023). Only the two points are kept; the photo is
// still discarded with the review.
import { useEffect, useRef, useState } from 'react'
import type { ViewCapture } from '../db/db'
import { hipCrop, tapToPoint } from '../lib/pelvis'
import { pelvicTiltDeg } from '../lib/posture'

type Pt = { x: number; y: number }
type Pelvis = NonNullable<ViewCapture['pelvis']>

interface Props {
  /** The side photo without the skeleton drawn on it. */
  photo: HTMLCanvasElement
  capture: ViewCapture
  camera: 'user' | 'environment'
  /** The front camera's preview is mirrored; the crop is shown the same way so taps match what the user saw. */
  mirrored: boolean
  onDone: (pelvis: Pelvis) => void
  onCancel: () => void
}

export function PelvisMarker({ photo, capture, camera, mirrored, onDone, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [front, setFront] = useState<Pt | null>(capture.pelvis?.front ?? null)
  const [back, setBack] = useState<Pt | null>(capture.pelvis?.back ?? null)

  const W = capture.width, H = capture.height
  const { x: cropX, y: cropY, size } = hipCrop(capture)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = Math.round(size)
    c.height = Math.round(size)
    const ctx = c.getContext('2d')!
    ctx.drawImage(photo, cropX, cropY, size, size, 0, 0, size, size)
    const toCrop = (p: Pt) => ({ x: p.x * W - cropX, y: p.y * H - cropY })
    const r = Math.max(6, size / 45)
    if (front && back) {
      const a = toCrop(front), b = toCrop(back)
      ctx.strokeStyle = '#22d3ee'
      ctx.lineWidth = Math.max(2, size / 150)
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    }
    for (const [p, color] of [[front, '#f43f5e'], [back, '#facc15']] as const) {
      if (!p) continue
      const q = toCrop(p)
      ctx.fillStyle = color
      ctx.strokeStyle = '#020409'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    }
  }, [photo, front, back, size, cropX, cropY, W, H])

  function tap(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const p = tapToPoint((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, hipCrop(capture), mirrored, W, H)
    if (!front) setFront(p)
    else if (!back) setBack(p)
    else { setFront(p); setBack(null) }
  }

  const deg = front && back ? pelvicTiltDeg({ ...capture, pelvis: { front, back } }, camera) : undefined
  const step = !front ? 'Tap the sticker at the FRONT of your hip (the bony point below your waist).'
    : !back ? 'Now tap the sticker at the BACK (the dimple above your buttock).'
      : deg === undefined ? 'The two points are too close: tap them again.'
        : `${Math.abs(deg).toFixed(0)}° ${deg >= 0 ? 'forward' : 'backward'} (most people: 5–15° forward). Tap again to redo.`

  return (
    <div className="pelvis-marker stack">
      <p className="small" aria-live="polite">{step}</p>
      <canvas ref={canvasRef} className={`pelvis-crop ${mirrored ? 'mirrored' : ''}`} onPointerDown={tap}
        role="img" aria-label="Zoomed photo of your hip: tap the front sticker, then the back sticker" />
      <p className="muted small"><span className="dot front" /> front · <span className="dot back" /> back. Only the two points are saved, not the photo.</p>
      <div className="row">
        <button className="secondary" onClick={onCancel}>Skip</button>
        <button className="secondary" disabled={!front} onClick={() => { setFront(null); setBack(null) }}>Clear</button>
        <button disabled={!front || !back || deg === undefined} onClick={() => onDone({ front: front!, back: back! })}>Save points</button>
      </div>
    </div>
  )
}
