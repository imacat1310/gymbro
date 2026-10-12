// Live framing check before a form-check recording: whole body in view, facing the right way.
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { LM } from '../pose'
import type { FormView } from './types'

const KEY = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle]
const MIN_VIS = 0.6
const EDGE = 0.02
/** Shoulder width ÷ shoulder-to-hip height: small side-on, large facing the camera (assumption). */
const SIDE_MAX = 0.35
const FRONT_MIN = 0.45

/** Undefined when ready to record; otherwise the one thing to fix. */
export function framingHint(lms: NormalizedLandmark[] | undefined, view: FormView, width: number, height: number): string | undefined {
  if (!lms?.length) return 'Step into view: whole body, head to feet.'
  if (view === 'front') {
    // One side clearly visible and the other hidden: they're side-on, not out of frame.
    const avg = (ids: number[]) => ids.reduce((a, i) => a + (lms[i]?.visibility ?? 0), 0) / ids.length
    const l = avg([LM.leftShoulder, LM.leftHip, LM.leftKnee, LM.leftAnkle])
    const r = avg([LM.rightShoulder, LM.rightHip, LM.rightKnee, LM.rightAnkle])
    if (Math.min(l, r) < MIN_VIS && Math.max(l, r) >= MIN_VIS) return 'Face the camera.'
  }
  if (view === 'front' && KEY.some((i) => (lms[i]?.visibility ?? 0) < MIN_VIS)) return 'Make sure your whole body is visible.'
  if (view === 'side') {
    const near = (lms[LM.leftHip].visibility ?? 0) >= (lms[LM.rightHip].visibility ?? 0) ? 'left' : 'right'
    const ids = near === 'left' ? [LM.leftShoulder, LM.leftHip, LM.leftKnee, LM.leftAnkle] : [LM.rightShoulder, LM.rightHip, LM.rightKnee, LM.rightAnkle]
    if (ids.some((i) => (lms[i].visibility ?? 0) < MIN_VIS)) return 'Make sure your whole body is visible.'
  }
  const pts = KEY.map((i) => lms[i])
  if (pts.some((p) => p.x < EDGE || p.x > 1 - EDGE || p.y < EDGE || p.y > 1 - EDGE)) return 'Step back: keep your feet and shoulders inside the frame.'
  const shW = Math.abs(lms[LM.leftShoulder].x - lms[LM.rightShoulder].x) * width
  const torso = Math.abs((lms[LM.leftShoulder].y + lms[LM.rightShoulder].y) / 2 - (lms[LM.leftHip].y + lms[LM.rightHip].y) / 2) * height
  const ratio = shW / (torso || 1)
  if (view === 'side' && ratio > SIDE_MAX) return 'Turn side-on to the camera.'
  if (view === 'front' && ratio < FRONT_MIN) return 'Face the camera.'
  return undefined
}
