// Body data → form-check profile (ADR-022 decision 3). Pure.
import type { Area } from '../../data/stress'
import { bodyPlanInput, type BodyData } from '../bodyInput'
import { analyzeScan, HIDE_BELOW } from '../posture'
import type { FormProfile } from './types'

export function formProfile(data: BodyData, limitations: Area[] = []): FormProfile {
  const report = data.scan ? analyzeScan(data.scan) : undefined
  const staticValgus = !!report?.findings.some((f) => f.code === 'knee_valgus_static' && f.severity !== 'none' && f.confidence >= HIDE_BELOW)
  const weakLeg = bodyPlanInput(data)?.weakSide.leg
  return {
    femurTorso: report?.proportions.femurTorso,
    staticValgus,
    weakLeg: weakLeg ? { side: weakLeg.side, diffPct: weakLeg.diffPct } : undefined,
    limitations,
  }
}
