import type { Landmark } from '@mediapipe/tasks-vision'
import { describe, expect, it } from 'vitest'
import type { PostureScan, ViewCapture } from '../db/db'
import { analyzeScan, grade, muscleFocus, referralFor, type Finding, type FindingCode } from './posture'
import { LM } from './pose'

// A synthetic 175 cm person in body coordinates (cm): x = towards their left, y = up from the floor,
// f = forwards. Projected into 720×1280 portrait frames the way a camera would see them.
const H = 175, W = 720, HPX = 1280
const S = (0.75 * HPX) / H // px per cm
const FLOOR = 0.08 * HPX + 0.75 * HPX

type Pt = { x: number; y: number; f: number }
interface Body { pts: Pt[] }

function body(): Body {
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

type View = 'front' | 'back' | 'side'
/** Project to normalized landmarks. Side view: the left side faces the camera, facing image +x. */
function project(b: Body, view: View, opts: { rotateDeg?: number; vis?: number } = {}): Landmark[] {
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

const cap = (lms: Landmark[], extra: Partial<ViewCapture> = {}): ViewCapture => ({
  landmarks: lms, worldLandmarks: lms, width: W, height: HPX, tilt: { rollDeg: 0, pitchDeg: 0 }, frames: 5, spread: 0.002, ...extra,
})

function scan(b: Body, opts: { views?: View[]; camera?: 'user' | 'environment'; vis?: number } = {}): PostureScan {
  const views = opts.views ?? ['front', 'side', 'back']
  return {
    id: 's', takenAt: 0, heightCm: H, camera: opts.camera ?? 'user', appVersion: 'test',
    views: Object.fromEntries(views.map((v) => [v, cap(project(b, v, { vis: opts.vis }))])),
  }
}

const find = (fs: Finding[], c: FindingCode) => fs.find((f) => f.code === c)

describe('grade', () => {
  it('uses the spec thresholds, including "smaller is worse" for the craniovertebral angle', () => {
    expect(grade('shoulder_height_asymmetry', 0.8)).toBe('none')
    expect(grade('shoulder_height_asymmetry', 2.5)).toBe('moderate')
    expect(grade('forward_head', 55)).toBe('none')
    expect(grade('forward_head', 42)).toBe('moderate')
    expect(grade('forward_head', 38)).toBe('marked')
  })
})

describe('analyzeScan: a well-aligned person', () => {
  const r = analyzeScan(scan(body()))
  it('finds nothing above "none"', () => {
    expect(r.findings.filter((f) => f.severity !== 'none')).toEqual([])
  })
  it('measures all nine metric families (valgus/varus merged)', () => {
    expect(r.findings.map((f) => f.code).sort()).toHaveLength(8)
  })
  it('no referral and no notes', () => {
    expect(r.referral).toBeUndefined()
    expect(r.notes).toEqual([])
  })
  it('proportions: femur/torso and shoulder/hip', () => {
    // Thigh 0.24 H vs torso 0.30 H; shoulders 40 cm vs hips 20 cm apart.
    expect(r.proportions.femurTorso).toBeCloseTo(0.8, 1)
    expect(r.proportions.shoulderHip).toBeCloseTo(2, 1)
  })
})

describe('analyzeScan: frontal asymmetries', () => {
  it('a left shoulder 2.5 cm higher is moderate, on the left, in both front and back views', () => {
    const b = body(); b.pts[LM.leftShoulder].y += 2.5
    const r = analyzeScan(scan(b))
    const f = find(r.findings, 'shoulder_height_asymmetry')!
    expect(f).toMatchObject({ severity: 'moderate', side: 'left', views: ['front', 'back'] })
    expect(f.value).toBeCloseTo(2.5, 1)
    // Front alone is the same answer: sides come from image position, not MediaPipe's labels.
    expect(find(analyzeScan(scan(b, { views: ['back'] })).findings, 'shoulder_height_asymmetry')).toMatchObject({ side: 'left', severity: 'moderate' })
  })
  it('agreement between front and back raises confidence', () => {
    const b = body(); b.pts[LM.leftShoulder].y += 2.5
    const both = find(analyzeScan(scan(b)).findings, 'shoulder_height_asymmetry')!.confidence
    const one = find(analyzeScan(scan(b, { views: ['front'] })).findings, 'shoulder_height_asymmetry')!.confidence
    expect(both).toBeGreaterThan(one)
  })
  it('trunk shift to the right', () => {
    const b = body()
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) b.pts[i].x -= 3.5
    const f = find(analyzeScan(scan(b)).findings, 'lateral_trunk_shift')!
    expect(f).toMatchObject({ severity: 'moderate', side: 'right' })
  })
  it('knees angled inwards → valgus, worse leg reported', () => {
    const b = body(); b.pts[LM.leftKnee].x -= 4; b.pts[LM.rightKnee].x += 2
    const r = analyzeScan(scan(b))
    expect(find(r.findings, 'knee_varus_static')).toBeUndefined()
    const f = find(r.findings, 'knee_valgus_static')!
    expect(f.side).toBe('left')
    expect(f.value).toBeGreaterThan(10)
    expect(f.severity).toBe('moderate')
  })
  it('head tilted towards the right shoulder', () => {
    const b = body(); b.pts[LM.rightEar].y -= 1.5; b.pts[LM.leftEar].y += 1.5
    expect(find(analyzeScan(scan(b)).findings, 'head_tilt')).toMatchObject({ side: 'right', severity: 'marked' })
  })
})

describe('analyzeScan: phone tilt correction', () => {
  for (const camera of ['user', 'environment'] as const) {
    it(`a level person photographed with the phone rolled 3° (${camera} camera) shows no asymmetry`, () => {
      const roll = 3
      const imgRot = camera === 'user' ? roll : -roll
      const s: PostureScan = {
        id: 's', takenAt: 0, heightCm: H, camera, appVersion: 'test',
        views: { front: cap(project(body(), 'front', { rotateDeg: imgRot }), { tilt: { rollDeg: roll, pitchDeg: 0 } }) },
      }
      expect(find(analyzeScan(s).findings, 'shoulder_height_asymmetry')!.value).toBeLessThan(0.2)
      // Ignoring the tilt would have shown about 2 cm (40 cm shoulders × sin 3°).
      const uncorrected = { ...s, views: { front: { ...s.views.front!, tilt: { rollDeg: 0, pitchDeg: 0 } } } }
      expect(find(analyzeScan(uncorrected).findings, 'shoulder_height_asymmetry')!.value).toBeGreaterThan(1.8)
    })
  }
  it('no level data → a note and lower confidence', () => {
    const b = body(); b.pts[LM.leftShoulder].y += 2.5
    const s = scan(b, { views: ['front'] })
    const noTilt = { ...s, views: { front: { ...s.views.front!, tilt: null } } }
    const r = analyzeScan(noTilt)
    expect(r.notes.some((n) => /level reading/.test(n))).toBe(true)
    expect(find(r.findings, 'shoulder_height_asymmetry')!.confidence).toBeLessThan(find(analyzeScan(s).findings, 'shoulder_height_asymmetry')!.confidence)
  })
})

describe('analyzeScan: side view', () => {
  it('head forward of the shoulders → forward head', () => {
    const b = body()
    // The ear sits ~20 cm above the shoulder landmark, so it must be ~17 cm forward to drop below 50°
    // (this shoulder-based approximation under-detects compared with the clinical C7 measure; ADR-009).
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) b.pts[i].f += 18
    const f = find(analyzeScan(scan(b)).findings, 'forward_head')!
    expect(f.value).toBeLessThan(50)
    expect(f.severity).toBe('mild')
  })
  it('shoulders 4.5 cm in front of the hips → rounded shoulders (moderate)', () => {
    const b = body(); b.pts[LM.leftShoulder].f += 4.5; b.pts[LM.rightShoulder].f += 4.5
    expect(find(analyzeScan(scan(b)).findings, 'rounded_shoulders')).toMatchObject({ severity: 'moderate' })
  })
  it('knees pushed back → hyperextension', () => {
    const b = body(); b.pts[LM.leftKnee].f -= 4; b.pts[LM.rightKnee].f -= 4
    const f = find(analyzeScan(scan(b)).findings, 'knee_hyperextension')!
    expect(f.value).toBeGreaterThan(185)
  })
  it('no side photo → a note, and no side metrics', () => {
    const r = analyzeScan(scan(body(), { views: ['front', 'back'] }))
    expect(find(r.findings, 'forward_head')).toBeUndefined()
    expect(r.notes.some((n) => /No side photo/.test(n))).toBe(true)
  })
})

describe('referral rules (SAFETY_PRIVACY.md)', () => {
  const F = (code: FindingCode, value: number, severity: Finding['severity'], confidence = 0.8): Finding =>
    ({ code, value, unit: 'cm', severity, confidence, views: ['front'] })

  it('shoulder difference > 2.5 cm with a trunk shift → referral', () => {
    expect(referralFor([F('shoulder_height_asymmetry', 2.8, 'moderate'), F('lateral_trunk_shift', 1.8, 'mild')])).toMatch(/physiotherapist/)
  })
  it('a marked trunk shift alone → referral', () => {
    expect(referralFor([F('lateral_trunk_shift', 5, 'marked')])).toBeDefined()
  })
  it('a large shoulder difference without a trunk shift → no referral', () => {
    expect(referralFor([F('shoulder_height_asymmetry', 3.2, 'marked'), F('lateral_trunk_shift', 0.5, 'none')])).toBeUndefined()
  })
  it('exactly 2.5 cm does not trigger (strictly greater)', () => {
    expect(referralFor([F('shoulder_height_asymmetry', 2.5, 'moderate'), F('lateral_trunk_shift', 2, 'mild')])).toBeUndefined()
  })
  it('low-confidence findings never trigger a referral', () => {
    expect(referralFor([F('lateral_trunk_shift', 5, 'marked', 0.4)])).toBeUndefined()
  })
  it('end to end: an uneven, shifted trunk on a scan triggers it', () => {
    const b = body(); b.pts[LM.leftShoulder].y += 3
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) b.pts[i].x += 2
    expect(analyzeScan(scan(b)).referral).toBeDefined()
  })
  it('referral text uses screening language, never a diagnosis', () => {
    const text = referralFor([F('lateral_trunk_shift', 5, 'marked')])!
    expect(text).not.toMatch(/scoliosis|you have|diagnos/i)
  })
})

describe('confidence', () => {
  it('poorly visible landmarks give low confidence', () => {
    const b = body(); b.pts[LM.leftShoulder].y += 2.5
    const f = find(analyzeScan(scan(b, { vis: 0.5 })).findings, 'shoulder_height_asymmetry')!
    expect(f.confidence).toBeLessThan(0.3)
  })
})

describe('muscleFocus', () => {
  const F = (code: FindingCode, severity: Finding['severity'], confidence = 0.8): Finding =>
    ({ code, value: 1, unit: 'cm', severity, confidence, views: ['side'] })

  it('rounded shoulders + forward head → upper back / lower traps first, with stretches', () => {
    const r = muscleFocus([F('rounded_shoulders', 'moderate'), F('forward_head', 'mild')])
    expect(r.strengthen.slice(0, 2).map((m) => m.muscle).sort()).toEqual(['lower_trap', 'upper_back'])
    expect(r.strengthen[0].because).toHaveLength(2)
    expect(r.stretch).toContain('Chest (pecs)')
  })
  it('ignores normal-range and low-confidence findings', () => {
    expect(muscleFocus([F('knee_valgus_static', 'none'), F('rounded_shoulders', 'marked', 0.4)]).strengthen).toEqual([])
  })
  it('every muscle it names exists in the exercise database', async () => {
    const { EXERCISES } = await import('../data/exercises')
    const trained = new Set(EXERCISES.flatMap((e) => [...e.primary, ...e.secondary]))
    const all = muscleFocus((['forward_head', 'rounded_shoulders', 'shoulder_height_asymmetry', 'pelvic_height_asymmetry', 'lateral_trunk_shift', 'head_tilt', 'knee_valgus_static', 'knee_varus_static', 'knee_hyperextension'] as FindingCode[]).map((c) => F(c, 'moderate')))
    expect(all.strengthen.filter((m) => !trained.has(m.muscle)).map((m) => m.muscle)).toEqual([])
  })
})
