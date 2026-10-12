import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getActivePlan, getBodyPlanInput } from '../../db/repo'
import { deriveSignals } from './signals'

/** Live coach signals from everything logged on this phone. */
export function useSignals() {
  return useLiveQuery(async () => {
    const [sessions, sets, plan, body, goals, comps] = await Promise.all([db.sessions.toArray(), db.sets.toArray(), getActivePlan(), getBodyPlanInput(), db.goals.toArray(), db.bodyComps.toArray()])
    const now = Date.now()
    const { evaluateGoal } = await import('../progress/goals')
    return deriveSignals({ sessions, sets, plan, body, goals: goals.map((g) => ({ ...evaluateGoal(g, sets, comps, now), kind: g.kind })), now })
  }, [])
}
