import { describe, expect, it } from 'vitest'
import { angleAcross, calibrate, gradeAtr, peakOf, sideOf, smoothed, summarize, type Gravity } from './trunk'

const G = 9.81
const rad = (d: number) => (d * Math.PI) / 180
/** Phone flat, screen up, rolled so its top (+y) end is `deg` degrees higher; spec convention (reaction, +z up). */
const lying = (deg: number, alongSpineDeg = 0): Gravity => ({
  x: G * Math.sin(rad(alongSpineDeg)) * Math.cos(rad(deg)),
  y: G * Math.sin(rad(deg)),
  z: G * Math.cos(rad(deg)) * Math.cos(rad(alongSpineDeg)),
})
const flip = (g: Gravity): Gravity => ({ x: -g.x, y: -g.y, z: -g.z })

describe('angleAcross', () => {
  it('flat phone reads 0', () => expect(angleAcross(lying(0))).toBeCloseTo(0))
  it('top end raised 6° → +6 (right side higher)', () => expect(angleAcross(lying(6))).toBeCloseTo(6))
  it('top end lowered 4° → −4 (left side higher)', () => expect(angleAcross(lying(-4))).toBeCloseTo(-4))
  it('same answer when the platform reports gravity with the opposite sign', () => {
    expect(angleAcross(flip(lying(6)))).toBeCloseTo(6)
    expect(angleAcross(flip(lying(-4)))).toBeCloseTo(-4)
  })
  it('a back sloping along the spine does not change the reading', () => {
    expect(angleAcross(lying(6, 30))).toBeCloseTo(6, 0)
  })
  it('phone held upright (not on the back) → null', () => {
    expect(angleAcross({ x: 0, y: G, z: 0.5 })).toBeNull()
    expect(angleAcross(lying(0, 70))).toBeNull()
  })
})

describe('grading and side', () => {
  it('thresholds: <5 normal, 5–6.9 borderline, ≥7 refer', () => {
    expect(gradeAtr(4.9)).toBe('normal')
    expect(gradeAtr(5)).toBe('borderline')
    expect(gradeAtr(6.9)).toBe('borderline')
    expect(gradeAtr(7)).toBe('refer')
  })
  it('side from sign', () => {
    expect(sideOf(3)).toBe('right')
    expect(sideOf(-3)).toBe('left')
    expect(sideOf(0)).toBeUndefined()
  })
})

describe('smoothing and peak', () => {
  it('median ignores a one-sample bump', () => {
    const s = [1, 1.1, 9, 1.2, 1].map((d, i) => ({ t: i * 50, deg: d }))
    expect(smoothed(s, 200)).toBeCloseTo(1.1)
  })
  it('too few samples → null', () => expect(smoothed([{ t: 0, deg: 1 }], 0)).toBeNull())
  it('peak keeps the largest magnitude with its sign', () => {
    let p: number | null = null
    for (const v of [1, -3, 2.5, -2]) p = peakOf(p, v)
    expect(p).toBe(-3)
  })
})

describe('calibrate', () => {
  const n = (v: number, k = 20) => Array.from({ length: k }, (_, i) => v + (i % 2 ? 0.1 : -0.1))
  it('steady readings → median offset (camera bump)', () => {
    const r = calibrate(n(1.8))
    expect('offset' in r && r.offset).toBeCloseTo(1.8, 0)
  })
  it('moving phone is rejected', () => {
    expect(calibrate([...n(0, 10), ...n(3, 10)])).toEqual({ error: 'moving' })
  })
  it('not on a flat surface is rejected', () => expect(calibrate(n(12))).toEqual({ error: 'not_flat' }))
  it('needs enough readings', () => expect(calibrate([0, 0])).toEqual({ error: 'too_few' }))
})

describe('summarize', () => {
  it('worst region decides the grade', () => {
    expect(summarize({ regions: { upper: 7.4, lower: -3 }, offsetDeg: 0 })).toEqual({ worst: { region: 'upper', deg: 7.4 }, grade: 'refer' })
    expect(summarize({ regions: { upper: 2, lower: -5.5 }, offsetDeg: 0 }).grade).toBe('borderline')
  })
  it('no readings → normal with no worst', () => expect(summarize({ regions: {}, offsetDeg: 0 })).toEqual({ grade: 'normal' }))
})
