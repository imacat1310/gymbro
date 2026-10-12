// Manual gym setup helpers (ADR-021): how many exercises each missing item would unlock, so the setup can point at
// what matters. Pure; uses the same equipment → exercise mapping as everything else.
import { EQUIPMENT } from '../data/equipment'
import { performableExercises } from '../data/exercises'

/** Exercises gained by adding each item the gym doesn't have yet (0 if nothing new). */
export function unlockCounts(equipment: string[]): Map<string, number> {
  const base = performableExercises(equipment).length
  const owned = new Set(equipment)
  return new Map(EQUIPMENT.filter((e) => !owned.has(e.id)).map((e) => [e.id, performableExercises([...equipment, e.id]).length - base]))
}

/** The missing items that would unlock the most exercises. */
export function topUnlocks(equipment: string[], k = 3): { id: string; gain: number }[] {
  return [...unlockCounts(equipment)].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k).map(([id, gain]) => ({ id, gain }))
}

/** Case-insensitive match on name and hint. */
export function matchesSearch(e: { name: string; hint?: string }, q: string): boolean {
  const s = q.trim().toLowerCase()
  return !s || e.name.toLowerCase().includes(s) || (e.hint ?? '').toLowerCase().includes(s)
}
