// Form score and tip choice (features/04-form-check.md "Form score"): 100 − Σ weight × severity × share of reps.
import type { Fault, FaultCode, FaultSeverity } from './types'

const WEIGHT: Record<FaultCode, number> = {
  shallow: 15, forward_lean: 15, heel_rise: 10, fast_descent: 5, fatigue_breakdown: 10, knee_cave: 20, hip_shift: 15,
}
const SEVERITY: Record<FaultSeverity, number> = { mild: 1, moderate: 2, safety: 3 }
const RANK: Record<FaultSeverity, number> = { safety: 0, moderate: 1, mild: 2 }

/** Score below this holds back the next load increase. */
export const BLOCK_BELOW = 60

export function formScore(faults: Fault[], repCount: number): number {
  const penalty = faults.reduce((sum, f) => sum + WEIGHT[f.code] * SEVERITY[f.severity] * Math.min(1, f.reps.length / Math.max(1, repCount)), 0)
  return Math.max(0, Math.min(100, Math.round(100 - penalty)))
}

/** Most important first: safety, then severity, then weight × reps affected. */
export function rankFaults(faults: Fault[]): Fault[] {
  return [...faults].sort((a, b) =>
    RANK[a.severity] - RANK[b.severity] || WEIGHT[b.code] * b.reps.length - WEIGHT[a.code] * a.reps.length)
}

/** "reps 5–8", "rep 3", "reps 1, 4 and 6" */
export function repList(reps: number[]): string {
  if (reps.length === 1) return `rep ${reps[0]}`
  const consecutive = reps.every((r, i) => i === 0 || r === reps[i - 1] + 1)
  if (consecutive) return `reps ${reps[0]}–${reps[reps.length - 1]}`
  return `reps ${reps.slice(0, -1).join(', ')} and ${reps[reps.length - 1]}`
}
