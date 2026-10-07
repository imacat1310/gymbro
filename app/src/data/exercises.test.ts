import { describe, expect, it } from 'vitest'
import { EQUIPMENT_BY_ID, GYM_PRESETS, expandEquipment } from './equipment'
import { EXERCISES, performableExercises } from './exercises'

const ids = (equipment: string[]) => performableExercises(equipment).map((e) => e.id)

describe('exercise data integrity', () => {
  it('has unique ids', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length)
  })
  it('only references known equipment', () => {
    for (const e of EXERCISES) for (const g of e.requires) for (const id of g) {
      expect(EQUIPMENT_BY_ID.has(id), `${e.id} requires unknown ${id}`).toBe(true)
    }
  })
  it('presets only reference known equipment', () => {
    for (const p of GYM_PRESETS) for (const id of p.equipment) expect(EQUIPMENT_BY_ID.has(id)).toBe(true)
  })
})

describe('performableExercises', () => {
  it('bodyweight-only still has exercises', () => {
    const list = ids([])
    expect(list).toContain('push_up')
    expect(list).not.toContain('barbell_back_squat')
  })
  it('a power rack counts as squat stands', () => {
    expect(ids(['barbell', 'power_rack'])).toContain('barbell_back_squat')
  })
  it('an adjustable bench counts as a flat bench', () => {
    expect(ids(['dumbbells', 'adjustable_bench'])).toContain('db_bench_press')
  })
  it('bench press needs a rack and a bench', () => {
    expect(ids(['barbell', 'flat_bench'])).not.toContain('barbell_bench_press')
    expect(ids(['barbell', 'flat_bench', 'power_rack'])).toContain('barbell_bench_press')
  })
  it('a functional trainer unlocks cable work', () => {
    const list = ids(['functional_trainer'])
    expect(list).toContain('cable_fly')
    expect(list).toContain('face_pull')
  })
  it('commercial gym covers almost everything', () => {
    const commercial = GYM_PRESETS.find((p) => p.id === 'commercial')!
    expect(performableExercises(commercial.equipment).length).toBeGreaterThan(EXERCISES.length * 0.9)
  })
})

describe('expandEquipment', () => {
  it('follows implications transitively', () => {
    expect([...expandEquipment(['functional_trainer'])].sort()).toEqual(['cable_crossover', 'cable_station', 'functional_trainer'])
  })
})
