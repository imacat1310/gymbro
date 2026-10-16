// Pelvic tilt from two hip stickers (ADR-023) and the posture → corrective coverage rule.
import { describe, expect, it } from 'vitest'
import { EXERCISE_BY_ID, performableExercises } from '../data/exercises'
import type { PostureScan, ViewCapture } from '../db/db'
import { bodyPlanInput, CORRECTIVES } from './bodyInput'
import { body, cap, H, HPX, project, W } from './fixtures/posture'
import { analyzeScan, FINDING_INFO, pelvicTiltDeg, type FindingCode } from './posture'
import { LM } from './pose'

/**
 * Side-view capture with stickers tilted `deg` (+ = front lower). `imgRot` rotates the whole image like a rolled
 * phone (same convention as project()).
 */
function sideWithPelvis(deg: number, view: 'side' | 'side_right' = 'side', opts: { imgRot?: number; roll?: number } = {}): ViewCapture {
  const lms = project(body(), view, { rotateDeg: opts.imgRot })
  const hip = lms[view === 'side' ? LM.leftHip : LM.rightHip]
  const facing = view === 'side' ? 1 : -1 // left side view faces image +x
  const half = 70 // px between each sticker and the hip centre, about the size of a real pelvis at scan distance
  const r = (deg * Math.PI) / 180
  const toNorm = (px: number, py: number) => {
    // Rotate like project() does for a rolled phone: by −imgRot around the image centre.
    const t = ((opts.imgRot ?? 0) * Math.PI) / 180
    const dx = px - W / 2, dy = py - HPX / 2
    return t
      ? { x: (W / 2 + dx * Math.cos(-t) - dy * Math.sin(-t)) / W, y: (HPX / 2 + dx * Math.sin(-t) + dy * Math.cos(-t)) / HPX }
      : { x: px / W, y: py / HPX }
  }
  // Undo the roll for the hip centre, place stickers level-relative, then roll them with the image.
  const t = ((opts.imgRot ?? 0) * Math.PI) / 180
  const hx = hip.x * W - W / 2, hy = hip.y * HPX - HPX / 2
  const cx = W / 2 + hx * Math.cos(t) - hy * Math.sin(t), cy = HPX / 2 + hx * Math.sin(t) + hy * Math.cos(t)
  const front = toNorm(cx + facing * half * Math.cos(r), cy + half * Math.sin(r))
  const back = toNorm(cx - facing * half * Math.cos(r), cy - half * Math.sin(r))
  return cap(lms, { nearSide: view === 'side' ? 'left' : 'right', pelvis: { front, back }, tilt: { rollDeg: opts.roll ?? 0, pitchDeg: 0 } })
}

const scanWith = (views: PostureScan['views'], camera: 'user' | 'environment' = 'user'): PostureScan =>
  ({ id: 's', takenAt: 0, heightCm: H, camera, appVersion: 'test', views })
const tilt = (s: PostureScan) => analyzeScan(s).findings.find((f) => f.code === 'anterior_pelvic_tilt' || f.code === 'posterior_pelvic_tilt')

describe('pelvic tilt (ADR-023)', () => {
  it('measures the sticker line against horizontal, + = anterior', () => {
    expect(pelvicTiltDeg(sideWithPelvis(12), 'user')).toBeCloseTo(12, 0)
    expect(pelvicTiltDeg(sideWithPelvis(-6), 'user')).toBeCloseTo(-6, 0)
    expect(pelvicTiltDeg(sideWithPelvis(12, 'side_right'), 'user')).toBeCloseTo(12, 0)
  })

  it('a typical 5–15° forward tilt is reported but not flagged', () => {
    expect(tilt(scanWith({ side: sideWithPelvis(11) }))).toMatchObject({ code: 'anterior_pelvic_tilt', value: 11, severity: 'none', unit: '°' })
  })

  it('grades forward and backward tilt', () => {
    expect(tilt(scanWith({ side: sideWithPelvis(22) }))).toMatchObject({ code: 'anterior_pelvic_tilt', severity: 'moderate' })
    expect(tilt(scanWith({ side: sideWithPelvis(27) }))!.severity).toBe('marked')
    expect(tilt(scanWith({ side: sideWithPelvis(-7) }))).toMatchObject({ code: 'posterior_pelvic_tilt', value: 7, severity: 'moderate' })
  })

  for (const camera of ['user', 'environment'] as const) {
    it(`corrects for a rolled phone (${camera} camera)`, () => {
      const roll = 4
      const imgRot = camera === 'user' ? roll : -roll
      const level = tilt(scanWith({ side: sideWithPelvis(12, 'side', { imgRot, roll }) }, camera))!
      expect(level.value).toBeCloseTo(12, 0)
      const ignored = tilt(scanWith({ side: sideWithPelvis(12, 'side', { imgRot, roll: 0 }) }, camera))!
      expect(Math.abs(ignored.value - 12)).toBeGreaterThan(3)
    })
  }

  it('averages both sides; agreement raises confidence, disagreement lowers it', () => {
    const one = tilt(scanWith({ side: sideWithPelvis(18) }))!
    const agree = tilt(scanWith({ side: sideWithPelvis(18), side_right: sideWithPelvis(20, 'side_right') }))!
    const disagree = tilt(scanWith({ side: sideWithPelvis(18), side_right: sideWithPelvis(4, 'side_right') }))!
    expect(agree.value).toBeCloseTo(19, 0)
    expect(agree.confidence).toBeGreaterThan(one.confidence)
    expect(disagree.confidence).toBeLessThan(one.confidence)
    expect(agree.views).toEqual(['side', 'side_right'])
  })

  it('without stickers: no tilt finding, and a note explaining how to measure it', () => {
    const r = analyzeScan(scanWith({ side: cap(project(body(), 'side'), { nearSide: 'left' }) }))
    expect(r.findings.some((f) => f.code.includes('pelvic_tilt'))).toBe(false)
    expect(r.notes.join(' ')).toMatch(/Pelvic tilt wasn.t measured/)
  })
})

describe('every posture finding has a corrective that needs no equipment', () => {
  for (const code of Object.keys(FINDING_INFO) as FindingCode[]) {
    it(code, () => {
      const options = CORRECTIVES[code]
      for (const id of options) expect(EXERCISE_BY_ID.has(id), `${code}: unknown exercise ${id}`).toBe(true)
      const bodyweight = new Set(performableExercises([]).map((e) => e.id))
      expect(options.some((id) => bodyweight.has(id)), `${code}: ${options.join(', ')}`).toBe(true)
    })
  }
})

describe('pelvic tilt reaches the plan', () => {
  const full = (deg: number): PostureScan => ({
    ...scanWith({ front: cap(project(body(), 'front')), side: sideWithPelvis(deg), back: cap(project(body(), 'back')) }),
  })
  it('a forward tilt adds hip-flexor and core correctives, and glute/abs priority', () => {
    const input = bodyPlanInput({ scan: full(23) })!
    expect(input.correctives.some((c) => c.options.includes('couch_stretch') && /tilted forward/i.test(c.reason))).toBe(true)
    expect(input.strengthen.map((s) => s.muscle)).toEqual(expect.arrayContaining(['glutes']))
  })
  it('a backward tilt adds the hamstring stretch', () => {
    const input = bodyPlanInput({ scan: full(-8) })!
    expect(input.correctives.some((c) => c.options[0] === 'hamstring_stretch')).toBe(true)
  })
  it('a typical tilt adds nothing', () => {
    const input = bodyPlanInput({ scan: full(10) })
    expect(input?.correctives.some((c) => /tilted/i.test(c.reason)) ?? false).toBe(false)
  })
})
