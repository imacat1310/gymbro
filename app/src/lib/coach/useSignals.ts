import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getActivePlan, getBodyPlanInput } from '../../db/repo'
import { deriveSignals } from './signals'

/** Live coach signals from everything logged on this phone. */
export function useSignals() {
  return useLiveQuery(async () => {
    const [sessions, sets, plan, body] = await Promise.all([db.sessions.toArray(), db.sets.toArray(), getActivePlan(), getBodyPlanInput()])
    return deriveSignals({ sessions, sets, plan, body, now: Date.now() })
  }, [])
}
