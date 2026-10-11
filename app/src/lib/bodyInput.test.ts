import { describe, expect, it } from 'vitest'
import { GYM_PRESETS } from '../data/equipment'
import { EXERCISE_BY_ID } from '../data/exercises'
import { STRESS_EXERCISE_IDS, stressedAreas } from '../data/stress'
import type { Assessment, BodyComp } from '../db/db'
import { bodyPlanInput } from './bodyInput'
import { body, scan } from './fixtures/posture'
import { buildPlan, type PlanInput } from './planner'
import { LM } from './pose'

const commercial = GYM_PRESETS.find((p) => p.id === 'commercial')!.equipment
const base: PlanInput = {
  profile: { goal: 'hypertrophy', experience: 'intermediate', intensity: 'moderate' },
  daysPerWeek: 3, sessionMinutes: 60, equipment: commercial, limitations: [], priorities: [],
}
const T = Date.UTC(2026, 9, 11)

/** Rounded shoulders (moderate) + forward head. */
function roundedScan() {
  const b = body()
  b.pts[LM.leftShoulder].f += 4.5; b.pts[LM.rightShoulder].f += 4.5
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) b.pts[i].f += 18
  return { ...scan(b), id: 'scan1', takenAt: T }
}
/** Uneven shoulders + trunk shift: triggers the posture referral. */
function referralScan() {
  const b = body(); b.pts[LM.leftShoulder].y += 3
  for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) b.pts[i].x += 2
  return { ...scan(b), id: 'scan2', takenAt: T }
}
const trunk = (upper: number, id = 't1'): Assessment => ({ id, type: 'trunk_rotation', takenAt: T, trunk: { regions: { upper }, offsetDeg: 0 } })
const comp = (values: BodyComp['values']): BodyComp => ({ id: 'c1', measuredAt: T, values, source: 'manual', createdAt: T })

describe('bodyPlanInput', () => {
  it('no body data → undefined (the planner behaves as before)', () => {
    expect(bodyPlanInput({})).toBeUndefined()
  })

  it('a well-aligned scan adds nothing but its source', () => {
    const r = bodyPlanInput({ scan: { ...scan(body()), id: 's', takenAt: T } })!
    expect(r.correctives).toEqual([])
    expect(r.strengthen).toEqual([])
    expect(r.pause).toBeUndefined()
    expect(r.sources[0]).toMatch(/^posture scan/)
  })

  it('rounded shoulders → pec stretch / wall slide correctives and upper-back muscles to strengthen', () => {
    const r = bodyPlanInput({ scan: roundedScan() })!
    expect(r.correctives[0].options[0]).toBe('doorway_pec_stretch')
    expect(r.correctives[0].reason).toMatch(/rounded shoulders, moderate/)
    expect(r.strengthen.map((s) => s.muscle)).toEqual(expect.arrayContaining(['lower_trap']))
    expect(r.strengthen.length).toBeLessThanOrEqual(2)
  })

  it('posture referral → pause until acknowledged', () => {
    const s = referralScan()
    expect(bodyPlanInput({ scan: s })!.pause?.sources).toEqual([{ kind: 'posture', id: 'scan2', takenAt: T }])
    expect(bodyPlanInput({ scan: s, acks: { scan2: T } })!.pause).toBeUndefined()
  })

  it('trunk rotation ≥ 7° → pause; 5–6.9° → symmetric core correctives only', () => {
    expect(bodyPlanInput({ trunk: trunk(7.4) })!.pause?.reason).toMatch(/7\.4°/)
    const borderline = bodyPlanInput({ trunk: trunk(5.6) })!
    expect(borderline.pause).toBeUndefined()
    expect(borderline.correctives[0].options).toEqual(['pallof_press', 'bird_dog', 'side_plank'])
    expect(bodyPlanInput({ trunk: trunk(3) })!.correctives).toEqual([])
  })

  it('InBody: a 5%+ lean-mass gap marks the weaker side; small gaps are ignored', () => {
    const r = bodyPlanInput({ comp: comp({ leanLeftArm: 3.0, leanRightArm: 3.3, leanLeftLeg: 9.5, leanRightLeg: 9.6 }) })!
    expect(r.weakSide).toEqual({ arm: { side: 'left', diffPct: 9.1 } })
  })

  it('latestAt is the newest record used', () => {
    expect(bodyPlanInput({ comp: { ...comp({}), measuredAt: T + 5 }, trunk: trunk(2) })!.latestAt).toBe(T + 5)
  })
})

describe('buildPlan with body data', () => {
  const ids = (p: ReturnType<typeof buildPlan>) => p.days.flatMap((d) => d.items.map((i) => i.exerciseId))

  it('pause: no exercise that loads the lower back, and the notes say why', () => {
    const p = buildPlan({ ...base, body: bodyPlanInput({ trunk: trunk(8) }) })
    expect(ids(p).filter((id) => stressedAreas(id).includes('lower_back'))).toEqual([])
    expect(p.notes[0]).toMatch(/spinal loading is paused/)
    // Without the pause, the same plan does include spinal loading.
    expect(ids(buildPlan(base)).some((id) => STRESS_EXERCISE_IDS.includes(id) && stressedAreas(id).includes('lower_back'))).toBe(true)
  })

  it('corrective block: correctives appear across the week with the finding as the reason, and survive time trimming', () => {
    const p = buildPlan({ ...base, sessionMinutes: 45, body: bodyPlanInput({ scan: roundedScan() }) })
    const corr = p.days.flatMap((d) => d.items).filter((i) => i.reason.startsWith('Posture scan'))
    expect(corr.length).toBeGreaterThanOrEqual(3)
    expect(new Set(corr.map((c) => c.exerciseId)).size).toBeGreaterThanOrEqual(2)
    expect(corr.every((c) => c.target.sets === 2)).toBe(true)
    expect(p.notes.some((n) => /Corrective block/.test(n))).toBe(true)
  })

  it('non-mobility correctives (glute bridge, side plank) also stay at 2 easy sets', () => {
    const b = body(); b.pts[LM.leftKnee].x -= 4
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) b.pts[i].x += 2
    const p = buildPlan({ ...base, body: bodyPlanInput({ scan: { ...scan(b), id: 's', takenAt: T } }) })
    const corr = p.days.flatMap((d) => d.items).filter((i) => i.corrective)
    expect(corr.length).toBeGreaterThan(0)
    expect(corr.every((c) => c.target.sets === 2)).toBe(true)
  })

  it('muscles to strengthen get an accessory with the reason', () => {
    const p = buildPlan({ ...base, body: bodyPlanInput({ scan: roundedScan() }) })
    const s = p.days.flatMap((d) => d.items).find((i) => i.reason.startsWith('Strengthens'))
    expect(s?.reason).toMatch(/Posture scan: /)
  })

  it('weaker side: one-sided leg exercises start with it', () => {
    const p = buildPlan({ ...base, daysPerWeek: 4, body: bodyPlanInput({ comp: comp({ leanLeftLeg: 9.0, leanRightLeg: 10.0 }) }) })
    const uni = p.days.flatMap((d) => d.items).filter((i) => EXERCISE_BY_ID.get(i.exerciseId)!.unilateral && /leg/.test(i.reason))
    const note = p.notes.find((n) => /left leg has 10% less lean mass/.test(n))
    expect(uni.length > 0 || !!note).toBe(true)
    for (const u of uni) expect(u.reason).toMatch(/Start with your left leg and add 1 set on it/)
  })

  it('the notes name the body data used', () => {
    const p = buildPlan({ ...base, body: bodyPlanInput({ scan: roundedScan(), comp: comp({ weightKg: 70 }) }) })
    expect(p.notes.some((n) => /^Built with your posture scan \(.+\), InBody \(.+\)\.$/.test(n))).toBe(true)
  })

  it('same body data → same plan (deterministic)', () => {
    const b = bodyPlanInput({ scan: roundedScan(), trunk: trunk(5.5) })
    expect(buildPlan({ ...base, body: b })).toEqual(buildPlan({ ...base, body: b }))
  })
})
