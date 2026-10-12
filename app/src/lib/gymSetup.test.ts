import { describe, expect, it } from 'vitest'
import { EQUIPMENT, GYM_PRESETS } from '../data/equipment'
import { performableExercises } from '../data/exercises'
import { matchesSearch, topUnlocks, unlockCounts } from './gymSetup'

describe('gym setup helpers', () => {
  it('every piece of equipment has a recognition hint', () => {
    expect(EQUIPMENT.filter((e) => !e.hint).map((e) => e.id)).toEqual([])
  })
  it('unlock counts: adding dumbbells to an empty gym unlocks many exercises', () => {
    const counts = unlockCounts([])
    expect(counts.get('dumbbells')).toBe(performableExercises(['dumbbells']).length - performableExercises([]).length)
    expect(counts.get('dumbbells')!).toBeGreaterThan(5)
  })
  it('owned items are not listed; implied items unlock nothing new', () => {
    const counts = unlockCounts(['power_rack', 'barbell'])
    expect(counts.has('power_rack')).toBe(false)
    expect(counts.get('squat_stand')).toBe(0) // a power rack already covers it
  })
  it('top unlocks for a home dumbbell gym, biggest first', () => {
    const top = topUnlocks(GYM_PRESETS.find((p) => p.id === 'home_dumbbell')!.equipment)
    expect(top).toHaveLength(3)
    expect(top[0].gain).toBeGreaterThanOrEqual(top[1].gain)
  })
  it('a full commercial gym has little left to unlock', () => {
    const all = EQUIPMENT.map((e) => e.id)
    expect(topUnlocks(all)).toEqual([])
  })
  it('search matches name or hint', () => {
    const lp = EQUIPMENT.find((e) => e.id === 'leg_press')!
    expect(matchesSearch(lp, 'sled')).toBe(true)
    expect(matchesSearch(lp, 'LEG')).toBe(true)
    expect(matchesSearch(lp, 'rings')).toBe(false)
  })
})
