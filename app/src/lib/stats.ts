import { EXERCISE_BY_ID } from '../data/exercises'
import type { SetLog } from '../db/db'
import { e1rm } from './progression'

/** Total kg moved in working sets of rep-based exercises. */
export function volumeKg(sets: SetLog[]) {
  return sets.reduce((sum, s) => {
    const ex = EXERCISE_BY_ID.get(s.exerciseId)
    return s.kind === 'working' && ex?.measure === 'reps' ? sum + s.weightKg * s.reps : sum
  }, 0)
}

export function bestE1rm(sets: SetLog[]) {
  return sets.reduce((best, s) => (s.kind === 'working' ? Math.max(best, e1rm(s.weightKg, s.reps, s.rpe)) : best), 0)
}

export interface PR {
  exerciseId: string
  kind: 'e1rm' | 'weight'
  value: number
  previous: number
}

/** Personal records set in `sessionSets` compared with everything logged before `before`. */
export function findPRs(sessionSets: SetLog[], earlierSets: SetLog[]): PR[] {
  const prs: PR[] = []
  const ids = new Set(sessionSets.filter((s) => s.kind === 'working').map((s) => s.exerciseId))
  for (const id of ids) {
    const ex = EXERCISE_BY_ID.get(id)
    if (!ex || ex.measure !== 'reps') continue
    const now = sessionSets.filter((s) => s.exerciseId === id && s.kind === 'working')
    const prev = earlierSets.filter((s) => s.exerciseId === id && s.kind === 'working')
    if (prev.length === 0) continue
    const nowBest = bestE1rm(now)
    const prevBest = bestE1rm(prev)
    if (nowBest > prevBest + 0.01) prs.push({ exerciseId: id, kind: 'e1rm', value: nowBest, previous: prevBest })
    const nowTop = Math.max(...now.map((s) => s.weightKg))
    const prevTop = Math.max(...prev.map((s) => s.weightKg))
    if (nowTop > prevTop && nowTop > 0) prs.push({ exerciseId: id, kind: 'weight', value: nowTop, previous: prevTop })
  }
  return prs
}
