import { describe, expect, it } from 'vitest'
import { squatRecording } from '../fixtures/squat'
import { analyzeSquat, leanLimit } from './squat'
import { EMPTY_PROFILE, type FormProfile } from './types'

const profile = (over: Partial<FormProfile> = {}): FormProfile => ({ ...EMPTY_PROFILE, ...over })
const codes = (r: ReturnType<typeof analyzeSquat>) => r.faults.map((f) => f.code)

describe('reps and a clean set (side view)', () => {
  it('counts reps and finds nothing to fix in a good set', () => {
    const r = analyzeSquat(squatRecording({ view: 'side', reps: 5, depthDeg: 5, leanDeg: 35 }), profile())
    expect(r.error).toBeUndefined()
    expect(r.reps).toHaveLength(5)
    expect(r.faults).toEqual([])
    expect(r.score).toBe(100)
    expect(r.tips[0].text).toMatch(/Solid set: 5 reps/)
    expect(r.blockIncrease).toBeUndefined()
  })

  it('measures depth, lean and tempo close to what was performed', () => {
    // Tempo is the active lowering (5%→95% of hip drop): hip height barely moves at first, so about half of a 2 s descent.
    const r = analyzeSquat(squatRecording({ view: 'side', reps: 3, depthDeg: 8, leanDeg: 40, descentSec: 2 }), profile())
    for (const rep of r.reps) {
      expect(rep.depthDeg!).toBeGreaterThan(3)
      expect(rep.depthDeg!).toBeLessThan(13)
      expect(rep.leanDeg!).toBeGreaterThan(35)
      expect(rep.leanDeg!).toBeLessThan(45)
      expect(rep.descentSec).toBeGreaterThan(0.9)
      expect(rep.descentSec).toBeLessThan(2.1)
    }
  })

  it('copes with landmark jitter', () => {
    const r = analyzeSquat(squatRecording({ view: 'side', reps: 6, noise: 0.004 }), profile())
    expect(r.reps).toHaveLength(6)
  })

  it('says when the person could not be seen, or no reps were done', () => {
    expect(analyzeSquat(squatRecording({ view: 'side', visibility: 0.3 }), profile()).error).toBe('not_visible')
    expect(analyzeSquat(squatRecording({ view: 'side', reps: 0, standSec: 3 }), profile()).error).toBe('no_reps')
  })
})

describe('side-view faults', () => {
  it('flags shallow reps, moderate when well above parallel', () => {
    const r = analyzeSquat(squatRecording({ view: 'side', reps: 4, depthDeg: -22 }), profile())
    const f = r.faults.find((x) => x.code === 'shallow')!
    expect(f.severity).toBe('moderate')
    expect(f.reps).toEqual([1, 2, 3, 4])
    expect(f.tip).toMatch(/reps 1–4/)
  })

  it('does not push depth with a knee limitation', () => {
    const r = analyzeSquat(squatRecording({ view: 'side', reps: 4, depthDeg: -22 }), profile({ limitations: ['knee'] }))
    expect(codes(r)).not.toContain('shallow')
    expect(r.personal.join(' ')).toMatch(/knee/)
  })

  it('heel rise and a fast descent', () => {
    const r = analyzeSquat(squatRecording({ view: 'side', reps: 3, heelRise: 0.08, descentSec: 0.4 }), profile())
    expect(codes(r)).toEqual(expect.arrayContaining(['heel_rise', 'fast_descent']))
    expect(r.faults.find((f) => f.code === 'heel_rise')!.severity).toBe('moderate')
  })

  it('a controlled 1.2 s descent is not "fast"; a 0.5 s drop is', () => {
    expect(codes(analyzeSquat(squatRecording({ view: 'side', reps: 3, descentSec: 1.2 }), profile()))).not.toContain('fast_descent')
    const fast = analyzeSquat(squatRecording({ view: 'side', reps: 3, descentSec: 0.5 }), profile())
    expect(fast.faults.find((f) => f.code === 'fast_descent')!.tip).toMatch(/dropped quickly on reps 1–3/)
  })

  it('fatigue: depth slipping on the last reps holds the weight', () => {
    const r = analyzeSquat(squatRecording({ view: 'side', reps: 6, depthDeg: [8, 8, 6, 2, -6, -8] }), profile())
    expect(codes(r)).toContain('fatigue_breakdown')
    expect(r.blockIncrease).toMatch(/fatigue/)
  })
})

describe('body-adjusted lean limit (ADR-022)', () => {
  it('scales with thigh-to-torso ratio, within bounds, stricter for the lower back', () => {
    expect(leanLimit(profile())).toBe(45)
    expect(leanLimit(profile({ femurTorso: 1.1 }))).toBe(55)
    expect(leanLimit(profile({ femurTorso: 0.7 }))).toBe(38)
    expect(leanLimit(profile({ femurTorso: 2 }))).toBe(60)
    expect(leanLimit(profile({ femurTorso: 1.1, limitations: ['lower_back'] }))).toBe(50)
  })

  it('the same 55° lean is a fault for an average build but normal for long thighs', () => {
    const rec = squatRecording({ view: 'side', reps: 4, leanDeg: 55, femurTorso: 1.1 })
    const average = analyzeSquat(rec, profile())
    expect(codes(average)).toContain('forward_lean')
    expect(average.faults.find((f) => f.code === 'forward_lean')!.tip).toMatch(/chest up/i)

    const long = analyzeSquat(rec, profile({ femurTorso: 1.1 }))
    expect(codes(long)).not.toContain('forward_lean')
    expect(long.personal.join(' ')).toMatch(/Lean limit 55°/)
  })

  it('long thighs past their limit get stance/heel tips, with the reason', () => {
    const r = analyzeSquat(squatRecording({ view: 'side', reps: 3, leanDeg: 66, femurTorso: 1.1 }), profile({ femurTorso: 1.1 }))
    const f = r.faults.find((x) => x.code === 'forward_lean')!
    expect(f.tip).toMatch(/wider stance|plates under your heels/)
    expect(f.why).toMatch(/long relative to your torso/)
  })

  it('a lower-back limitation makes leaning a safety fault that blocks the next increase', () => {
    const r = analyzeSquat(squatRecording({ view: 'side', reps: 3, leanDeg: 47 }), profile({ limitations: ['lower_back'] }))
    const f = r.faults.find((x) => x.code === 'forward_lean')!
    expect(f.severity).toBe('safety')
    expect(r.tips[0].text).toBe(f.tip)
    expect(r.blockIncrease).toBe(f.tip)
  })
})

describe('front view', () => {
  it('a clean set has no knee or hip faults', () => {
    const r = analyzeSquat(squatRecording({ view: 'front', reps: 4 }), profile())
    expect(r.reps).toHaveLength(4)
    expect(r.faults).toEqual([])
  })

  it('knee cave is measured relative to standing alignment (static valgus is not double counted)', () => {
    const r = analyzeSquat(squatRecording({ view: 'front', reps: 4, staticCaveDeg: 6 }), profile({ staticValgus: true }))
    expect(codes(r)).not.toContain('knee_cave')
  })

  it('flags knee cave and says which knee', () => {
    const r = analyzeSquat(squatRecording({ view: 'front', reps: 4, caveDeg: { left: 16, right: 2 } }), profile())
    const f = r.faults.find((x) => x.code === 'knee_cave')!
    expect(f.severity).toBe('moderate')
    expect(f.tip).toMatch(/^Your left knee/)
  })

  it('watches more closely after a static-valgus finding, and explains why', () => {
    const rec = squatRecording({ view: 'front', reps: 4, caveDeg: { left: 7, right: 7 } })
    expect(codes(analyzeSquat(rec, profile()))).not.toContain('knee_cave')
    const watched = analyzeSquat(rec, profile({ staticValgus: true }))
    const f = watched.faults.find((x) => x.code === 'knee_cave')!
    expect(f.why).toMatch(/posture scan/)
  })

  it('links a hip shift to the weaker leg from InBody', () => {
    const rec = squatRecording({ view: 'front', reps: 4, hipShift: -0.3 }) // toward the user's right
    const r = analyzeSquat(rec, profile({ weakLeg: { side: 'left', diffPct: 7 } }))
    const f = r.faults.find((x) => x.code === 'hip_shift')!
    expect(f.tip).toMatch(/onto your right leg/)
    expect(f.tip).toMatch(/single-leg work with your left/)
    expect(f.why).toMatch(/7% less lean mass/)
    const plain = analyzeSquat(rec, profile())
    expect(plain.faults.find((x) => x.code === 'hip_shift')!.why).toBeUndefined()
  })
})

describe('score', () => {
  it('drops with faults and stays within 0–100', () => {
    const r = analyzeSquat(squatRecording({ view: 'side', reps: 4, depthDeg: -25, leanDeg: 70, heelRise: 0.1, descentSec: 0.3 }), profile())
    expect(r.score).toBeLessThan(60)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.blockIncrease).toMatch(/below 60/)
    expect(r.tips).toHaveLength(2)
  })
})
