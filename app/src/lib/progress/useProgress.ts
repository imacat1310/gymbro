import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getActivePlan, getBodyData } from '../../db/repo'
import { computeProgress } from './level'

/** Live level, stats, weekly activity and badges from everything logged on this phone. */
export function useProgress() {
  return useLiveQuery(async () => {
    const [sessions, sets, plan, plans, data] = await Promise.all([db.sessions.toArray(), db.sets.toArray(), getActivePlan(), db.plans.toArray(), getBodyData()])
    const [{ analyzeScan, SHOW_AS_POSSIBLE }, { summarize }, { bodyPlanInput }] = await Promise.all([import('../posture'), import('../trunk'), import('../bodyInput')])
    const findings = data.scan
      ? analyzeScan(data.scan).findings.filter((f) => f.severity !== 'none' && f.confidence >= SHOW_AS_POSSIBLE).map((f) => ({ severity: f.severity as 'mild' | 'moderate' | 'marked' }))
      : []
    const body = bodyPlanInput({ ...data, acks: {} })
    const hasBody = !!(data.scan || data.trunk || data.comp?.values.leanLeftArm || data.comp?.values.leanLeftLeg)
    const byPlan = new Map(plans.map((p) => [p.id, p]))
    const focusSessionIds = new Set(sessions.filter((s) => s.planId && s.dayIndex !== undefined && byPlan.get(s.planId)?.dayFocus?.[s.dayIndex]).map((s) => s.id))
    return computeProgress({
      sessions, sets, now: Date.now(),
      planDays: plan?.days.length, sessionMinutes: plan?.schedule.sessionMinutes,
      bodyweightKg: data.comp?.values.weightKg,
      balance: hasBody ? { findings, trunk: data.trunk ? summarize(data.trunk.trunk).grade : undefined, weakSides: Object.keys(body?.weakSide ?? {}).length } : undefined,
      hasPostureScan: !!data.scan, hasInBody: !!data.comp, focusSessionIds,
    })
  }, [])
}
