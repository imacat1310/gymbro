import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { describe, expect, it } from 'vitest'
import {
  bodyExtent, evaluateFrame, firstHint, isStill, landmarkSpread, medianLandmarks, motionPoints, nearSide,
  readyToCapture, shoulderRatio, tiltFromGravity, type FrameInput, type MotionSample, type PostureView,
} from './capture'
import { LM } from './pose'

// Portrait camera frame, as an iPhone delivers it.
const W = 720, H = 1280

interface PersonOpts {
  /** Hip midpoint x (normalized). */
  cx?: number
  /** Crown y (normalized). */
  top?: number
  /** Crown-to-feet height as a share of frame height. */
  height?: number
  turn?: 'front' | 'side'
  armsUp?: boolean
  visibility?: number
}

/** A synthetic standing person: rough adult proportions as a share of body height, measured from the crown. */
function person({ cx = 0.5, top = 0.08, height = 0.75, turn = 'front', armsUp = false, visibility = 0.95 }: PersonOpts = {}): NormalizedLandmark[] {
  const bodyPx = height * H
  // Half-widths in body heights; side-on the body is seen edge-on, so left and right almost overlap.
  const k = turn === 'front' ? 1 : 0.1
  const at = (frac: number, halfWidth: number, z = 0): NormalizedLandmark => ({
    x: cx + (halfWidth * k * bodyPx) / W, y: top + frac * height, z, visibility,
  })
  const lms: NormalizedLandmark[] = []
  const set = (i: number, l: NormalizedLandmark) => { lms[i] = l }
  // Face 0–10.
  set(LM.nose, at(0.07, 0))
  for (const i of [1, 2, 3]) set(i, at(0.055, -0.015 * (i - 1)))
  for (const i of [4, 5, 6]) set(i, at(0.055, 0.015 * (i - 4)))
  set(LM.leftEar, at(0.065, -0.04)); set(LM.rightEar, at(0.065, 0.04))
  set(9, at(0.085, -0.01)); set(10, at(0.085, 0.01))
  set(LM.leftShoulder, at(0.18, 0.1, -0.05)); set(LM.rightShoulder, at(0.18, -0.1, 0.05))
  set(13, at(0.33, 0.11)); set(14, at(0.33, -0.11))
  const wristY = armsUp ? 0.1 : 0.5
  set(LM.leftWrist, at(wristY, 0.11)); set(LM.rightWrist, at(wristY, -0.11))
  for (const i of [17, 19, 21]) set(i, at(wristY + 0.03, 0.11))
  for (const i of [18, 20, 22]) set(i, at(wristY + 0.03, -0.11))
  set(LM.leftHip, at(0.48, 0.06, -0.05)); set(LM.rightHip, at(0.48, -0.06, 0.05))
  set(LM.leftKnee, at(0.72, 0.055, -0.05)); set(LM.rightKnee, at(0.72, -0.055, 0.05))
  set(LM.leftAnkle, at(0.95, 0.05, -0.05)); set(LM.rightAnkle, at(0.95, -0.05, 0.05))
  set(LM.leftHeel, at(0.975, 0.05)); set(LM.rightHeel, at(0.975, -0.05))
  set(LM.leftFootIndex, at(1, 0.06)); set(LM.rightFootIndex, at(1, -0.06))
  return lms
}

const level = { rollDeg: 0.5, pitchDeg: 1 }
const frame = (lms: NormalizedLandmark[] | undefined, view: PostureView = 'front', extra: Partial<FrameInput> = {}): FrameInput =>
  ({ lms, width: W, height: H, view, tilt: level, brightness: 0.5, ...extra })
const failing = (input: FrameInput) => evaluateFrame(input).filter((c) => !c.ok).map((c) => c.id)

describe('tiltFromGravity', () => {
  it('upright phone is level', () => {
    const t = tiltFromGravity(0, -9.81, 0)
    expect(t.rollDeg).toBeCloseTo(0)
    expect(t.pitchDeg).toBeCloseTo(0)
  })
  it('gives the same answer whichever sign convention the platform uses', () => {
    const a = tiltFromGravity(0.5, -9.8, 1)
    const b = tiltFromGravity(-0.5, 9.8, -1)
    expect(a.rollDeg).toBeCloseTo(b.rollDeg)
    expect(a.pitchDeg).toBeCloseTo(b.pitchDeg)
  })
  it('measures sideways lean', () => {
    const g = 9.81, r = (10 * Math.PI) / 180
    expect(Math.abs(tiltFromGravity(g * Math.sin(r), -g * Math.cos(r), 0).rollDeg)).toBeCloseTo(10)
  })
  it('a phone lying flat reads as 90° pitch, not level', () => {
    expect(Math.abs(tiltFromGravity(0, 0, -9.81).pitchDeg)).toBeCloseTo(90)
  })
})

describe('body geometry', () => {
  it('estimates the crown above the face and the span to the feet', () => {
    const { crown, feet, span } = bodyExtent(person({ top: 0.1, height: 0.7 }))
    expect(crown).toBeCloseTo(0.1, 2)
    expect(feet).toBeCloseTo(0.8, 2)
    expect(span).toBeCloseTo(0.7, 2)
  })
  it('shoulder ratio separates facing from side-on', () => {
    expect(shoulderRatio(person(), W, H)).toBeGreaterThan(0.6)
    expect(shoulderRatio(person({ turn: 'side' }), W, H)).toBeLessThan(0.1)
  })
  it('nearSide picks the side with smaller z', () => {
    expect(nearSide(person())).toBe('left')
  })
})

describe('evaluateFrame', () => {
  it('a well-placed person passes every check', () => {
    expect(failing(frame(person()))).toEqual([])
    expect(readyToCapture(evaluateFrame(frame(person())))).toBe(true)
    expect(failing(frame(person({ turn: 'side' }), 'side'))).toEqual([])
    expect(failing(frame(person(), 'back'))).toEqual([])
  })

  it('no person: asks to step into view first', () => {
    const checks = evaluateFrame(frame(undefined))
    expect(checks[0]).toMatchObject({ id: 'person', ok: false })
    expect(firstHint(checks)).toBe('Step into view')
  })

  it('level: strict sideways, looser forward/back', () => {
    expect(failing(frame(person(), 'front', { tilt: { rollDeg: 2.5, pitchDeg: 0 } }))).toEqual(['level'])
    expect(failing(frame(person(), 'front', { tilt: { rollDeg: 0, pitchDeg: 4.5 } }))).toEqual([])
    expect(failing(frame(person(), 'front', { tilt: { rollDeg: 0, pitchDeg: 7 } }))).toEqual(['level'])
  })

  it('no motion sensor: warns but does not block capture', () => {
    const checks = evaluateFrame(frame(person(), 'front', { tilt: null }))
    expect(checks.find((c) => c.id === 'level')).toMatchObject({ ok: false, soft: true })
    expect(readyToCapture(checks)).toBe(true)
    expect(firstHint(checks)).toBeUndefined()
  })

  it('too dark', () => {
    expect(failing(frame(person(), 'front', { brightness: 0.1 }))).toEqual(['light'])
  })

  it('wrong way round for the view', () => {
    expect(failing(frame(person({ turn: 'side' }), 'front'))).toContain('turn')
    expect(failing(frame(person(), 'side'))).toContain('turn')
  })

  it('head or feet cut off → step back', () => {
    const checks = evaluateFrame(frame(person({ top: -0.02 })))
    expect(checks.find((c) => c.id === 'body')).toMatchObject({ ok: false, hint: 'Your head is cut off, step back' })
    const feet = evaluateFrame(frame(person({ top: 0.3 })))
    expect(feet.find((c) => c.id === 'body')?.hint).toBe('Your feet are cut off, step back')
  })

  it('hidden landmarks fail the body check', () => {
    expect(failing(frame(person({ visibility: 0.3 })))).toContain('body')
  })

  it('distance: too small → closer, too large → back', () => {
    expect(evaluateFrame(frame(person({ height: 0.4, top: 0.3 }))).find((c) => c.id === 'distance')?.hint).toBe('Step closer')
    expect(evaluateFrame(frame(person({ height: 0.94, top: 0.03 }))).find((c) => c.id === 'distance')?.hint).toBe('Step back')
  })

  it('centring hint flips between front and back view', () => {
    const hint = (view: PostureView) => evaluateFrame(frame(person({ cx: 0.75 }), view)).find((c) => c.id === 'centre')?.hint
    expect(hint('front')).toBe('Take a small step to your right')
    expect(hint('back')).toBe('Take a small step to your left')
    expect(hint('side')).toBe('Move to the middle of the picture')
  })

  it('arms raised', () => {
    expect(failing(frame(person({ armsUp: true })))).toEqual(['arms'])
  })
})

describe('stillness', () => {
  const samples = (n: number, jitter: number): MotionSample[] =>
    Array.from({ length: n }, (_, i) => ({
      t: i * 33,
      pts: motionPoints(person({ cx: 0.5 + (i % 2 ? jitter : -jitter) })),
    }))

  it('steady person is still', () => {
    const s = samples(30, 0.001)
    expect(isStill(s, s.at(-1)!.t, 0.75)).toBe(true)
  })
  it('swaying person is not', () => {
    const s = samples(30, 0.02)
    expect(isStill(s, s.at(-1)!.t, 0.75)).toBe(false)
  })
  it('too little history is never still', () => {
    const s = samples(4, 0)
    expect(isStill(s, s.at(-1)!.t, 0.75)).toBe(false)
  })
})

describe('multi-frame aggregation', () => {
  it('median removes a single outlier frame', () => {
    const frames = [person(), person(), person({ cx: 0.7 }), person(), person()]
    const agg = medianLandmarks(frames)
    expect(agg).toHaveLength(33)
    expect(agg[LM.nose].x).toBeCloseTo(0.5, 3)
  })
  it('spread is near zero for identical frames and grows with jitter', () => {
    const same = [person(), person(), person()]
    expect(landmarkSpread(same, medianLandmarks(same))).toBe(0)
    const shaky = [person({ cx: 0.49 }), person(), person({ cx: 0.51 })]
    expect(landmarkSpread(shaky, medianLandmarks(shaky))).toBeGreaterThan(0)
  })
})
