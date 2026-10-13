// Form-aware progression (ADR-022): a form check that said "keep this weight" holds back the next increase.
import type { FormReport } from './types'
import { FAULT_TITLE } from './views'

/** A check recorded up to this long before the first logged set still belongs to that workout (warm-up checks). */
const BEFORE_SESSION_MS = 2 * 3600_000

export interface CheckSummary {
  takenAt: number
  report: Pick<FormReport, 'blockIncrease' | 'score' | 'faults'>
}

/**
 * Reason to hold the next load increase, or undefined. Uses the newest form check from the last workout with this
 * exercise (or later); once the exercise has been trained again, an older check no longer applies.
 */
export function formHold(checks: CheckSummary[], lastSessionAt: number | undefined): string | undefined {
  if (lastSessionAt === undefined) return undefined
  const newest = [...checks].sort((a, b) => b.takenAt - a.takenAt)[0]
  if (!newest || newest.takenAt < lastSessionAt - BEFORE_SESSION_MS || !newest.report.blockIncrease) return undefined
  const fault = newest.report.faults[0]
  return `your last form check scored ${newest.report.score}/100${fault ? ` (${FAULT_TITLE[fault.code].toLowerCase()})` : ''}. Own this weight first`
}
