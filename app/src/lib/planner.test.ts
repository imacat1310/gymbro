import { describe, expect, it } from 'vitest'
import { GYM_PRESETS } from '../data/equipment'
import { EXERCISE_BY_ID, performableExercises } from '../data/exercises'
import { isContraindicated } from '../data/stress'
import { buildPlan, chooseSplit, estimateMinutes, MAX_PRESSES_PER_DAY, pressAngle, PRIORITY_CHOICES, redundantPress, substituteForGym, type PlanInput } from './planner'
import { BEGINNER_RPE_CAP } from './targets'

const preset = (id: string) => GYM_PRESETS.find((p) => p.id === id)!.equipment
const base: PlanInput = {
  profile: { goal: 'hypertrophy', experience: 'intermediate', intensity: 'moderate' },
  daysPerWeek: 4,
  sessionMinutes: 75,
  equipment: preset('commercial'),
  limitations: [],
  priorities: [],
}
const allItems = (p: ReturnType<typeof buildPlan>) => p.days.flatMap((d) => d.items)

describe('chooseSplit', () => {
  it('follows the split table', () => {
    expect(chooseSplit(3, base.profile).name).toBe('Full body ×3')
    expect(chooseSplit(4, base.profile).name).toBe('Upper / Lower')
    expect(chooseSplit(6, base.profile).templates).toHaveLength(6)
  })
  it('caps beginners at 5 days unless intensity is hard or max', () => {
    const beginner = { ...base.profile, experience: 'beginner' as const }
    const s = chooseSplit(6, beginner)
    expect(s.templates).toHaveLength(5)
    expect(s.note).toMatch(/Capped/)
    expect(chooseSplit(6, { ...beginner, intensity: 'hard' }).templates).toHaveLength(6)
  })
})

describe('buildPlan', () => {
  it('is deterministic', () => {
    expect(buildPlan(base)).toEqual(buildPlan(base))
  })

  it('only uses exercises possible at the gym', () => {
    for (const gym of ['commercial', 'hotel', 'home_barbell', 'home_dumbbell', 'bodyweight']) {
      const equipment = preset(gym)
      const possible = new Set(performableExercises(equipment).map((e) => e.id))
      const plan = buildPlan({ ...base, equipment })
      for (const i of allItems(plan)) expect(possible.has(i.exerciseId), `${gym}: ${i.exerciseId}`).toBe(true)
      expect(allItems(plan).length, gym).toBeGreaterThan(0)
    }
  })

  it('never includes contraindicated exercises', () => {
    const limitations = ['lower_back', 'knee', 'shoulder'] as const
    const plan = buildPlan({ ...base, limitations: [...limitations] })
    for (const i of allItems(plan)) expect(isContraindicated(i.exerciseId, [...limitations]), i.exerciseId).toBe(false)
    expect(plan.notes.join(' ')).toMatch(/physiotherapist/)
  })

  it('fits the session length', () => {
    for (const minutes of [30, 45, 60]) {
      const plan = buildPlan({ ...base, sessionMinutes: minutes })
      for (const d of plan.days) expect(d.estMinutes, `${d.name} @ ${minutes}`).toBeLessThanOrEqual(minutes + 8)
    }
  })

  it('keeps main lifts when trimming', () => {
    const plan = buildPlan({ ...base, sessionMinutes: 30 })
    for (const d of plan.days) expect(d.items.some((i) => i.role === 'main'), d.name).toBe(true)
  })

  it('adds work for priority muscles', () => {
    const without = buildPlan(base).weeklySets.glutes ?? 0
    const plan = buildPlan({ ...base, priorities: ['glutes'] })
    expect(plan.weeklySets.glutes ?? 0).toBeGreaterThan(without)
    expect(allItems(plan).some((i) => i.reason.includes('Priority: glutes'))).toBe(true)
  })

  it('pulls at least as much as it pushes', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const plan = buildPlan({ ...base, daysPerWeek: days })
      const sets = (pats: string[]) => allItems(plan)
        .filter((i) => pats.includes(EXERCISE_BY_ID.get(i.exerciseId)!.pattern)).reduce((a, i) => a + i.target.sets, 0)
      const balancers = allItems(plan).filter((i) => i.reason.includes('Balances')).reduce((a, i) => a + i.target.sets, 0)
      expect(sets(['h_pull', 'v_pull']) + balancers, `${days} days`).toBeGreaterThanOrEqual(sets(['h_push', 'v_push']))
    }
  })

  it('caps beginner RPE', () => {
    const plan = buildPlan({ ...base, profile: { goal: 'strength', experience: 'beginner', intensity: 'max' } })
    for (const i of allItems(plan)) expect(i.target.targetRpe).toBeLessThanOrEqual(BEGINNER_RPE_CAP)
  })

  it('respects excluded exercises', () => {
    const first = allItems(buildPlan(base))[0].exerciseId
    expect(allItems(buildPlan({ ...base, exclude: [first] })).some((i) => i.exerciseId === first)).toBe(false)
  })

  it('offers alternatives for swapping', () => {
    expect(allItems(buildPlan(base)).filter((i) => i.role === 'main').every((i) => i.alternatives.length > 0)).toBe(true)
  })
})

describe('substituteForGym', () => {
  it('keeps the exercise when possible, otherwise swaps within the pattern', () => {
    const plan = buildPlan(base)
    const bench = allItems(plan).find((i) => EXERCISE_BY_ID.get(i.exerciseId)!.pattern === 'h_push' && i.role === 'main')!
    expect(substituteForGym(bench, preset('commercial'), [])).toBe(bench.exerciseId)
    const swapped = substituteForGym(bench, preset('home_dumbbell'), [])!
    expect(EXERCISE_BY_ID.get(swapped)!.pattern).toBe('h_push')
    expect(performableExercises(preset('home_dumbbell')).some((e) => e.id === swapped)).toBe(true)
  })
})

describe('estimateMinutes', () => {
  it('includes warm-up time', () => expect(estimateMinutes([])).toBe(5))
})

describe('no redundant presses in a session (user report: barbell + dumbbell bench, same angle)', () => {
  const ex = (id: string) => EXERCISE_BY_ID.get(id)!
  it('press angles: flat, incline, dips, overhead', () => {
    expect(pressAngle(ex('barbell_bench_press'))).toBe('flat')
    expect(pressAngle(ex('db_bench_press'))).toBe('flat')
    expect(pressAngle(ex('close_grip_bench'))).toBe('flat')
    expect(pressAngle(ex('incline_db_press'))).toBe('incline')
    expect(pressAngle(ex('dip'))).toBe('decline')
    expect(pressAngle(ex('seated_db_press'))).toBe('overhead')
    expect(pressAngle(ex('cable_fly'))).toBeUndefined()
  })
  it('an accessory may change angle but not repeat it, and never adds a third horizontal press', () => {
    expect(redundantPress(ex('db_bench_press'), [ex('barbell_bench_press')])).toBe(true)
    expect(redundantPress(ex('incline_db_press'), [ex('barbell_bench_press')])).toBe(false)
    expect(redundantPress(ex('dip'), [ex('barbell_bench_press'), ex('incline_db_press')])).toBe(true)
    expect(redundantPress(ex('cable_fly'), [ex('barbell_bench_press'), ex('incline_db_press')])).toBe(false)
    expect(MAX_PRESSES_PER_DAY).toBe(2)
  })

  it('holds across gyms, schedules and every priority muscle', () => {
    const problems: string[] = []
    for (const gym of GYM_PRESETS) for (const daysPerWeek of [3, 4, 5, 6]) for (const experience of ['beginner', 'intermediate'] as const)
      for (const m of [undefined, ...PRIORITY_CHOICES]) {
        const plan = buildPlan({ ...base, profile: { ...base.profile, experience }, daysPerWeek, equipment: gym.equipment, priorities: m ? [m] : [] })
        for (const d of plan.days) {
          const angles = d.items.map((i) => pressAngle(EXERCISE_BY_ID.get(i.exerciseId)!)).filter(Boolean)
          const horizontal = angles.filter((a) => a === 'flat' || a === 'incline' || a === 'decline').length
          const where = `${gym.id} ${daysPerWeek}d ${experience} ${m ?? '-'} ${d.name}`
          if (angles.length !== new Set(angles).size) problems.push(`${where}: same press angle twice`)
          if (horizontal > MAX_PRESSES_PER_DAY) problems.push(`${where}: ${horizontal} horizontal presses`)
          for (const i of d.items) {
            const pattern = EXERCISE_BY_ID.get(i.exerciseId)!.pattern
            if (i.reason.startsWith('Priority') && ['conditioning', 'power', 'agility'].includes(pattern)) problems.push(`${where}: ${i.exerciseId} as a muscle priority`)
          }
        }
      }
    expect(problems).toEqual([])
  })
})
