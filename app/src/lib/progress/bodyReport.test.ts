import { describe, expect, it } from 'vitest'
import type { Assessment, BodyComp } from '../../db/db'
import { body, scan } from '../fixtures/posture'
import { LM } from '../pose'
import { bodyReport } from './bodyReport'

const DAY = 86_400_000
const T = new Date(2026, 8, 1).getTime()
const comp = (day: number, values: BodyComp['values']): BodyComp => ({ id: `c${day}`, measuredAt: T + day * DAY, values, source: 'manual', createdAt: 0 })
const rounded = (cm: number) => { const b = body(); b.pts[LM.leftShoulder].f += cm; b.pts[LM.rightShoulder].f += cm; return b }
const scanAt = (day: number, b = body()) => ({ ...scan(b), id: `s${day}`, takenAt: T + day * DAY })
const trunk = (deg: number): Assessment => ({ id: 't', type: 'trunk_rotation', takenAt: T, trunk: { regions: { upper: deg }, offsetDeg: 0 } })

describe('bodyReport', () => {
  it('nothing logged → everything listed as missing', () => {
    const r = bodyReport({ scans: [], comps: [], trunks: [] })
    expect(r.missing).toEqual(['inbody', 'posture', 'trunk'])
    expect(r.latestAt).toBeUndefined()
  })

  it('composition: latest values, change since the first, and trend series', () => {
    const r = bodyReport({ scans: [], comps: [comp(0, { weightKg: 75, smmKg: 33, pbf: 19 }), comp(30, { weightKg: 74, smmKg: 33.5 }), comp(60, { weightKg: 74.2, smmKg: 34, pbf: 17.5 })], trunks: [] })
    expect(r.composition!.values.smmKg).toBe(34)
    expect(r.composition!.changeSinceFirst).toMatchObject({ weightKg: -0.8, smmKg: 1, pbf: -1.5 })
    expect(r.series.map((s) => [s.field, s.points.length])).toEqual([['weightKg', 3], ['smmKg', 3], ['pbf', 2]])
  })

  it('left/right lean mass: 5%+ gap names the weaker side and adds it to the focus', () => {
    const r = bodyReport({ scans: [], comps: [comp(0, { leanLeftArm: 3.2, leanRightArm: 3.25, leanLeftLeg: 9.0, leanRightLeg: 10.0 })], trunks: [] })
    expect(r.limbs).toEqual([
      { limb: 'arm', left: 3.2, right: 3.25, diffPct: 1.5, weaker: undefined },
      { limb: 'leg', left: 9, right: 10, diffPct: 10, weaker: 'left' },
    ])
    expect(r.focus.strengthen.find((s) => s.muscle === 'quads')!.because).toEqual(['left leg has 10% less lean mass'])
  })

  it('InBody without segmental values → segmental listed as missing', () => {
    expect(bodyReport({ scans: [], comps: [comp(0, { weightKg: 70 })], trunks: [] }).missing).toContain('segmental')
  })

  it('posture: compared with the previous scan (improved / new / resolved)', () => {
    const prev = rounded(4.5) // rounded shoulders, moderate
    const next = rounded(2.5) // mild now
    next.pts[LM.rightEar].y -= 1.5; next.pts[LM.leftEar].y += 1.5 // new head tilt
    const r = bodyReport({ scans: [scanAt(0, prev), scanAt(40, next)], comps: [], trunks: [] })
    const by = Object.fromEntries(r.posture!.findings.map((f) => [f.code, f.trend]))
    expect(by.rounded_shoulders).toBe('improved')
    expect(by.head_tilt).toBe('new')
    expect(r.posture!.previousAt).toBe(T)

    const r2 = bodyReport({ scans: [scanAt(0, prev), scanAt(40)], comps: [], trunks: [] })
    expect(r2.posture!.findings.find((f) => f.code === 'rounded_shoulders')!.trend).toBe('resolved')
  })

  it('a single scan has no trends; focus lists muscles with the finding as the reason', () => {
    const r = bodyReport({ scans: [scanAt(0, rounded(4.5))], comps: [], trunks: [] })
    expect(r.posture!.findings[0].trend).toBeUndefined()
    expect(r.focus.strengthen[0].because).toContain('Rounded shoulders')
    expect(r.focus.stretch).toContain('Chest (pecs)')
  })

  it('trunk test: latest grade and worst region', () => {
    expect(bodyReport({ scans: [], comps: [], trunks: [trunk(7.2)] }).trunk).toMatchObject({ grade: 'refer', worstDeg: 7.2, region: 'upper' })
  })
})
