import { describe, expect, it } from 'vitest'
import { GYM_PRESETS } from '../data/equipment'
import { EXERCISE_BY_ID, performableExercises } from '../data/exercises'
import { stressedAreas } from '../data/stress'
import { ADVANCED_ONLY, FOCUS, FOCUS_ORDER, type FocusId } from './focus'
import { buildPlan, type PlanInput } from './planner'

const preset = (id: string) => GYM_PRESETS.find((p) => p.id === id)!.equipment
const base: PlanInput = {
  profile: { goal: 'athletic', experience: 'intermediate', intensity: 'moderate' },
  daysPerWeek: 3, sessionMinutes: 60, equipment: preset('commercial'), limitations: [], priorities: [],
}
const dayWith = (focus: FocusId, over: Partial<PlanInput> = {}) => buildPlan({ ...base, ...over, dayFocus: [focus] }).days[0]

describe('focus definitions', () => {
  it('every listed exercise exists', () => {
    const missing = FOCUS_ORDER.flatMap((f) => FOCUS[f].slots.flatMap((s) => s.ids)).filter((id) => !EXERCISE_BY_ID.has(id))
    expect(missing).toEqual([])
  })
  it('every focus builds a usable day at every gym preset', () => {
    for (const g of GYM_PRESETS) for (const f of FOCUS_ORDER) {
      const d = dayWith(f, { equipment: g.equipment })
      const can = new Set(performableExercises(g.equipment).map((e) => e.id))
      expect(d.items.length, `${f} @ ${g.id}`).toBeGreaterThanOrEqual(4)
      expect(d.items.every((i) => can.has(i.exerciseId)), `${f} @ ${g.id}`).toBe(true)
    }
  })
})

describe('focus days', () => {
  it('basketball: starts with a jump, ends with ankle, hamstring and hip prevention', () => {
    const d = dayWith('basketball')
    expect(d.name).toBe('Basketball day')
    expect(EXERCISE_BY_ID.get(d.items[0].exerciseId)!.pattern).toBe('power')
    expect(d.items[0].reason).toMatch(/^Basketball: vertical jump power/)
    const reasons = d.items.map((i) => i.reason).join(' | ')
    expect(reasons).toMatch(/Achilles/)
    expect(reasons).toMatch(/hamstring injury prevention/)
  })
  it('badminton: rotator cuff, wrist and Achilles work', () => {
    const ids = dayWith('badminton').items.map((i) => i.exerciseId)
    expect(ids).toEqual(expect.arrayContaining(['band_external_rotation', 'wrist_curl', 'single_leg_calf_raise']))
  })
  it('power work is low-rep with full rest; mobility is easy', () => {
    const jump = dayWith('basketball').items[0]
    expect(jump.target).toMatchObject({ repMin: 3, repMax: 5, restSec: 90 })
    expect(dayWith('mobility').items.every((i) => i.target.targetRpe <= 7)).toBe(true)
  })
  it('a knee limitation removes jumps and the day is still built', () => {
    const d = dayWith('basketball', { limitations: ['knee'] })
    expect(d.items.some((i) => stressedAreas(i.exerciseId).includes('knee'))).toBe(false)
    expect(d.items.length).toBeGreaterThanOrEqual(4)
  })
  it('the safety pause (lower back) removes push press and slams', () => {
    const d = dayWith('power', { limitations: ['lower_back'] })
    expect(d.items.some((i) => stressedAreas(i.exerciseId).includes('lower_back'))).toBe(false)
  })
  it('beginners get easier options (no Nordic curls, box jumps or push press)', () => {
    const d = dayWith('basketball', { profile: { ...base.profile, experience: 'beginner' } })
    expect(d.items.some((i) => ADVANCED_ONLY.has(i.exerciseId))).toBe(false)
    expect(d.items[0].target.sets).toBe(2)
  })
  it('focus work keeps its prescribed sets (no volume top-ups)', () => {
    const d = dayWith('swimming')
    expect(d.items.every((i) => i.fixed)).toBe(true)
  })
  it('other days keep their standard templates; deterministic', () => {
    const p = buildPlan({ ...base, dayFocus: [undefined, 'badminton', null] })
    expect(p.days.map((d) => d.name)).toEqual(['Full body A', 'Badminton day', 'Full body C'])
    expect(buildPlan({ ...base, dayFocus: [undefined, 'badminton'] })).toEqual(buildPlan({ ...base, dayFocus: [undefined, 'badminton'] }))
  })
  it('a bodyweight-only gym still gets a real sport day', () => {
    const d = dayWith('basketball', { equipment: preset('bodyweight') })
    expect(d.items.map((i) => i.exerciseId)).toEqual(expect.arrayContaining(['squat_jump']))
  })
})
