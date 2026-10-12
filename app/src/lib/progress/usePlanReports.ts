import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getSettings } from '../../db/repo'
import { planReport } from './planReport'

/** Live reports for every plan (or one), newest first. */
export function usePlanReports(planId?: string) {
  return useLiveQuery(async () => {
    const [plans, sessions, sets, comps, scans, goals, settings] = await Promise.all([
      planId ? db.plans.where('id').equals(planId).toArray() : db.plans.toArray(),
      db.sessions.toArray(), db.sets.toArray(), db.bodyComps.toArray(), db.postureScans.orderBy('takenAt').toArray(), db.goals.toArray(), getSettings(),
    ])
    const [{ analyzeScan, SHOW_AS_POSSIBLE }, { evaluateGoal }] = await Promise.all([import('../posture'), import('./goals')])
    const now = Date.now()
    const scanFindings = scans.map((s) => ({ takenAt: s.takenAt, findings: analyzeScan(s).findings.filter((f) => f.severity !== 'none' && f.confidence >= SHOW_AS_POSSIBLE).length }))
    const goalStatus = goals.map((g) => evaluateGoal(g, sets, comps, now))
    return plans
      .map((plan) => ({ plan, report: planReport({ plan, goal: plan.goal ?? settings.profile.goal, sessions, sets, comps, scans: scanFindings, goals: goalStatus, now }) }))
      .sort((a, b) => b.plan.createdAt - a.plan.createdAt)
  }, [planId])
}
