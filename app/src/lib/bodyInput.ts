// Body data → plan input (plan builder v2, ADR-014). Pure: takes the latest posture scan, trunk test and InBody
// result and turns them into what the planner acts on, each with the reason to show the user.
import type { Muscle } from '../data/exercises'
import type { Assessment, BodyComp, PostureScan } from '../db/db'
import { analyzeScan, FINDING_INFO, muscleFocus, SHOW_AS_POSSIBLE, type Finding, type FindingCode, type Severity } from './posture'
import { summarize } from './trunk'

export type Side = 'left' | 'right'
export type Limb = 'arm' | 'leg'

export interface ReferralSource { kind: 'posture' | 'trunk'; id: string; takenAt: number }

export interface BodyPlanInput {
  /** Muscles to give extra work, most important first (at most 2). */
  strengthen: { muscle: Muscle; reason: string }[]
  /** Corrective / mobility needs: the first performable exercise of `options` is used. Most important first. */
  correctives: { options: string[]; reason: string }[]
  /** A referral that hasn't been acknowledged: heavy spinal loading is left out (SAFETY_PRIVACY.md). */
  pause?: { reason: string; sources: ReferralSource[] }
  /** Weaker side per limb from segmental lean mass. */
  weakSide: Partial<Record<Limb, { side: Side; diffPct: number }>>
  /** "Posture scan (11 Oct)" etc., for the plan notes. */
  sources: string[]
  /** Newest body data used; a plan built before newer data is offered a rebuild. */
  latestAt: number
}

/** Finding → corrective options, in order of preference (features/02-posture-scan.md mapping table). */
const CORRECTIVES: Record<FindingCode, string[]> = {
  forward_head: ['chin_tuck'],
  rounded_shoulders: ['doorway_pec_stretch', 'wall_slide', 'prone_y_raise', 'thoracic_extension'],
  shoulder_height_asymmetry: ['suitcase_carry', 'side_plank'],
  lateral_trunk_shift: ['side_plank', 'copenhagen_plank', 'suitcase_carry'],
  pelvic_height_asymmetry: ['side_plank', 'banded_lateral_walk', 'glute_bridge'],
  head_tilt: ['chin_tuck'],
  knee_valgus_static: ['banded_lateral_walk', 'glute_bridge'],
  knee_varus_static: [],
  knee_hyperextension: ['glute_bridge'],
  shoulder_forward_asymmetry: ['doorway_pec_stretch', 'band_external_rotation', 'prone_y_raise'],
}
/** Symmetric core work after a trunk-rotation reading in the re-test band (ADR-010: no side-specific advice). */
const TRUNK_CORRECTIVES = ['pallof_press', 'bird_dog', 'side_plank']

/** Lean-mass difference between sides worth acting on (our cut-off; small differences are normal). */
export const WEAK_SIDE_PCT = 5
const MAX_CORRECTIVES = 4

const SEVERITY_RANK: Record<Severity, number> = { marked: 0, moderate: 1, mild: 2, none: 3 }
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export interface BodyData {
  scan?: PostureScan
  trunk?: Assessment
  comp?: BodyComp
  /** Referral acknowledgements: record id → when acknowledged. */
  acks?: Record<string, number>
}

export function bodyPlanInput({ scan, trunk, comp, acks = {} }: BodyData): BodyPlanInput | undefined {
  if (!scan && !trunk && !comp) return undefined
  const sources: string[] = []
  const strengthen: BodyPlanInput['strengthen'] = []
  const correctives: BodyPlanInput['correctives'] = []
  const pauseSources: ReferralSource[] = []
  const pauseWhy: string[] = []
  let latestAt = 0

  if (scan) {
    latestAt = Math.max(latestAt, scan.takenAt)
    sources.push(`posture scan (${day(scan.takenAt)})`)
    const report = analyzeScan(scan)
    const flagged = report.findings
      .filter((f) => f.severity !== 'none' && f.confidence >= SHOW_AS_POSSIBLE)
      .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.confidence - a.confidence)
    const label = (f: Finding) => `${FINDING_INFO[f.code].title.toLowerCase()}${f.side ? ` (${f.side})` : ''}, ${f.severity}`
    for (const f of flagged) {
      if (CORRECTIVES[f.code].length) correctives.push({ options: CORRECTIVES[f.code], reason: `Posture scan: ${label(f)}` })
    }
    for (const m of muscleFocus(flagged).strengthen.slice(0, 2)) {
      const f = flagged.find((x) => m.because.includes(x.code))!
      strengthen.push({ muscle: m.muscle, reason: `Posture scan: ${label(f)}` })
    }
    if (report.referral && !acks[scan.id]) {
      pauseSources.push({ kind: 'posture', id: scan.id, takenAt: scan.takenAt })
      pauseWhy.push(`your posture scan (${day(scan.takenAt)}) showed uneven shoulders and trunk`)
    }
  }

  if (trunk) {
    latestAt = Math.max(latestAt, trunk.takenAt)
    sources.push(`trunk rotation test (${day(trunk.takenAt)})`)
    const { grade, worst } = summarize(trunk.trunk)
    if (grade === 'refer' && !acks[trunk.id]) {
      pauseSources.push({ kind: 'trunk', id: trunk.id, takenAt: trunk.takenAt })
      pauseWhy.push(`your trunk rotation test (${day(trunk.takenAt)}) read ${Math.abs(worst!.deg).toFixed(1)}°`)
    }
    if (grade !== 'normal' && worst) {
      correctives.push({ options: TRUNK_CORRECTIVES, reason: `Trunk rotation test: ${Math.abs(worst.deg).toFixed(1)}°, core work for both sides` })
    }
  }

  const weakSide: BodyPlanInput['weakSide'] = {}
  if (comp) {
    latestAt = Math.max(latestAt, comp.measuredAt)
    sources.push(`InBody (${day(comp.measuredAt)})`)
    const v = comp.values
    const pairs: [Limb, number | undefined, number | undefined][] = [['arm', v.leanLeftArm, v.leanRightArm], ['leg', v.leanLeftLeg, v.leanRightLeg]]
    for (const [limb, l, r] of pairs) {
      if (!l || !r) continue
      const diffPct = (Math.abs(l - r) / Math.max(l, r)) * 100
      if (diffPct >= WEAK_SIDE_PCT) weakSide[limb] = { side: l < r ? 'left' : 'right', diffPct: Math.round(diffPct * 10) / 10 }
    }
  }

  return {
    strengthen,
    correctives: correctives.slice(0, MAX_CORRECTIVES),
    pause: pauseSources.length ? { reason: pauseWhy.join(' and '), sources: pauseSources } : undefined,
    weakSide,
    sources,
    latestAt,
  }
}
