// Synthetic posture-scan fixtures for tests (no real person's data).
import type { Landmark } from '@mediapipe/tasks-vision'
import type { PostureScan, ViewCapture } from '../../db/db'
import { LM } from '../pose'

// A synthetic 175 cm person in body coordinates (cm): x = towards their left, y = up from the floor,
// f = forwards. Projected into 720×1280 portrait frames the way a camera would see them.
export const H = 175, W = 720, HPX = 1280
const S = (0.75 * HPX) / H // px per cm
const FLOOR = 0.08 * HPX + 0.75 * HPX

export type Pt = { x: number; y: number; f: number }
export interface Body { pts: Pt[] }

export function body(): Body {
  const at = (x: number, frac: number, f = 0): Pt => ({ x, y: H - frac * H, f })
  const pts: Pt[] = []
  pts[LM.nose] = at(0, 0.07, 10)
  for (const i of [1, 2, 3]) pts[i] = at(1.5 * (i - 1) + 2, 0.055, 8)
  for (const i of [4, 5, 6]) pts[i] = at(-1.5 * (i - 4) - 2, 0.055, 8)
  pts[LM.leftEar] = at(7, 0.065, 0); pts[LM.rightEar] = at(-7, 0.065, 0)
  pts[9] = at(2, 0.085, 9); pts[10] = at(-2, 0.085, 9)
  pts[LM.leftShoulder] = at(20, 0.18); pts[LM.rightShoulder] = at(-20, 0.18)
  pts[13] = at(21, 0.33); pts[14] = at(-21, 0.33)
  pts[LM.leftWrist] = at(20, 0.5); pts[LM.rightWrist] = at(-20, 0.5)
  for (const i of [17, 19, 21]) pts[i] = at(20, 0.53)
  for (const i of [18, 20, 22]) pts[i] = at(-20, 0.53)
  pts[LM.leftHip] = at(10, 0.48); pts[LM.rightHip] = at(-10, 0.48)
  pts[LM.leftKnee] = at(9.5, 0.72); pts[LM.rightKnee] = at(-9.5, 0.72)
  pts[LM.leftAnkle] = at(9, 0.95); pts[LM.rightAnkle] = at(-9, 0.95)
  pts[LM.leftHeel] = at(9, 0.975, -5); pts[LM.rightHeel] = at(-9, 0.975, -5)
  pts[LM.leftFootIndex] = at(10, 1, 15); pts[LM.rightFootIndex] = at(-10, 1, 15)
  return { pts }
}

export type View = 'front' | 'back' | 'side'
/** Project to normalized landmarks. Side view: the left side faces the camera, facing image +x. */
export function project(b: Body, view: View, opts: { rotateDeg?: number; vis?: number } = {}): Landmark[] {
  const t = ((opts.rotateDeg ?? 0) * Math.PI) / 180
  return b.pts.map((p, i) => {
    const xc = view === 'front' ? p.x : view === 'back' ? -p.x : p.f
    let x = W / 2 + xc * S, y = FLOOR - p.y * S
    // Simulate a tilted phone: the image is rotated by −t around its centre.
    if (t) {
      const dx = x - W / 2, dy = y - HPX / 2
      x = W / 2 + dx * Math.cos(-t) - dy * Math.sin(-t)
      y = HPX / 2 + dx * Math.sin(-t) + dy * Math.cos(-t)
    }
    const farSide = view === 'side' && [8, 12, 14, 16, 24, 26, 28, 30, 32].includes(i)
    return { x: x / W, y: y / HPX, z: 0, visibility: farSide ? 0.3 : (opts.vis ?? 0.95) }
  })
}

export const cap = (lms: Landmark[], extra: Partial<ViewCapture> = {}): ViewCapture => ({
  landmarks: lms, worldLandmarks: lms, width: W, height: HPX, tilt: { rollDeg: 0, pitchDeg: 0 }, frames: 5, spread: 0.002, ...extra,
})

export function scan(b: Body, opts: { views?: View[]; camera?: 'user' | 'environment'; vis?: number } = {}): PostureScan {
  const views = opts.views ?? ['front', 'side', 'back']
  return {
    id: 's', takenAt: 0, heightCm: H, camera: opts.camera ?? 'user', appVersion: 'test',
    views: Object.fromEntries(views.map((v) => [v, cap(project(b, v, { vis: opts.vis }))])),
  }
}

