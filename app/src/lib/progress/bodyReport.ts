// Full body report (Design.md "Profile: body full report", ADR-020). Pure: combines every posture scan, InBody result
// and trunk test into one picture, including what changed since the previous measurement.
import type { Muscle } from '../../data/exercises'
import type { Assessment, BodyComp, PostureScan } from '../../db/db'
import type { InBodyField } from '../inbody'
import { analyzeScan, FINDING_INFO, muscleFocus, SHOW_AS_POSSIBLE, type Finding, type FindingCode, type Severity } from '../posture'
import { summarize, type TrunkGrade } from '../trunk'
import { WEAK_SIDE_PCT, type Limb, type Side } from '../bodyInput'

export type Trend = 'improved' | 'worse' | 'same' | 'new' | 'resolved'

export interface FindingRow {
  code: FindingCode
  title: string
  severity: Severity
  side?: Side
  value: number
  unit: string
  tentative: boolean
  /** Compared with the previous scan. */
  trend?: Trend
}

export interface LimbBalance { limb: Limb; left: number; right: number; diffPct: number; weaker?: Side }

export interface Series { field: InBodyField; points: { x: number; y: number }[]; first: number; last: number }

export interface BodyReport {
  latestAt?: number
  composition?: { at: number; values: BodyComp['values']; changeSinceFirst: Partial<Record<InBodyField, number>>; firstAt: number }
  series: Series[]
  limbs: LimbBalance[]
  posture?: { at: number; id: string; findings: FindingRow[]; previousAt?: number; referral?: string; femurTorso?: number }
  trunk?: { at: number; grade: TrunkGrade; worstDeg: number; region: 'upper' | 'lower' }
  focus: { strengthen: { muscle: Muscle; because: string[] }[]; stretch: string[] }
  missing: ('posture' | 'inbody' | 'segmental' | 'trunk')[]
}

const SEV_RANK: Record<Severity, number> = { none: 0, mild: 1, moderate: 2, marked: 3 }
const confident = (fs: Finding[]) => fs.filter((f) => f.severity !== 'none' && f.confidence >= SHOW_AS_POSSIBLE)
const SERIES_FIELDS: InBodyField[] = ['weightKg', 'smmKg', 'pbf']
const r1 = (v: number) => Math.round(v * 10) / 10

export function bodyReport({ scans, comps, trunks }: { scans: PostureScan[]; comps: BodyComp[]; trunks: Assessment[] }): BodyReport {
  const sScans = [...scans].sort((a, b) => a.takenAt - b.takenAt)
  const sComps = [...comps].sort((a, b) => a.measuredAt - b.measuredAt)
  const sTrunks = [...trunks].sort((a, b) => a.takenAt - b.takenAt)
  const missing: BodyReport['missing'] = []

  // ---- Body composition ----
  let composition: BodyReport['composition']
  const series: Series[] = []
  if (sComps.length) {
    const last = sComps.at(-1)!, first = sComps[0]
    const changeSinceFirst: Partial<Record<InBodyField, number>> = {}
    if (sComps.length > 1) {
      for (const k of Object.keys(last.values) as InBodyField[]) {
        const a = first.values[k], b = last.values[k]
        if (a !== undefined && b !== undefined) changeSinceFirst[k] = r1(b - a)
      }
    }
    composition = { at: last.measuredAt, values: last.values, changeSinceFirst, firstAt: first.measuredAt }
    for (const field of SERIES_FIELDS) {
      const points = sComps.filter((c) => c.values[field] !== undefined).map((c) => ({ x: c.measuredAt, y: c.values[field]! }))
      if (points.length >= 2) series.push({ field, points, first: points[0].y, last: points.at(-1)!.y })
    }
  } else missing.push('inbody')

  // ---- Left/right lean mass ----
  const limbs: LimbBalance[] = []
  const seg = [...sComps].reverse().find((c) => c.values.leanLeftArm !== undefined || c.values.leanLeftLeg !== undefined)
  if (seg) {
    const v = seg.values
    for (const [limb, l, r] of [['arm', v.leanLeftArm, v.leanRightArm], ['leg', v.leanLeftLeg, v.leanRightLeg]] as const) {
      if (!l || !r) continue
      const diffPct = r1((Math.abs(l - r) / Math.max(l, r)) * 100)
      limbs.push({ limb, left: l, right: r, diffPct, weaker: diffPct >= WEAK_SIDE_PCT ? (l < r ? 'left' : 'right') : undefined })
    }
  } else if (sComps.length) missing.push('segmental')

  // ---- Posture: latest scan, compared with the previous one ----
  let posture: BodyReport['posture']
  let flagged: Finding[] = []
  if (sScans.length) {
    const latest = sScans.at(-1)!, prev = sScans.at(-2)
    const now = analyzeScan(latest)
    flagged = confident(now.findings)
    const before = prev ? confident(analyzeScan(prev).findings) : undefined
    const rows: FindingRow[] = flagged.map((f) => {
      const b = before?.find((x) => x.code === f.code)
      const trend: Trend | undefined = !before ? undefined : !b ? 'new'
        : SEV_RANK[f.severity] < SEV_RANK[b.severity] ? 'improved' : SEV_RANK[f.severity] > SEV_RANK[b.severity] ? 'worse' : 'same'
      return { code: f.code, title: FINDING_INFO[f.code].title, severity: f.severity, side: f.side, value: f.value, unit: f.unit, tentative: !!FINDING_INFO[f.code].tentative, trend }
    })
    for (const b of before ?? []) {
      if (!flagged.some((f) => f.code === b.code)) rows.push({ code: b.code, title: FINDING_INFO[b.code].title, severity: 'none', value: b.value, unit: b.unit, tentative: false, trend: 'resolved' })
    }
    rows.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity])
    posture = { at: latest.takenAt, id: latest.id, findings: rows, previousAt: prev?.takenAt, referral: now.referral, femurTorso: now.proportions.femurTorso }
  } else missing.push('posture')

  // ---- Trunk rotation ----
  let trunk: BodyReport['trunk']
  const lastTrunk = sTrunks.at(-1)
  if (lastTrunk) {
    const { grade, worst } = summarize(lastTrunk.trunk)
    if (worst) trunk = { at: lastTrunk.takenAt, grade, worstDeg: worst.deg, region: worst.region }
  } else missing.push('trunk')

  // ---- Focus: posture muscle focus, plus the weaker InBody limb ----
  const mf = muscleFocus(flagged)
  const strengthen = mf.strengthen.map((m) => ({ muscle: m.muscle, because: [...new Set(m.because.map((c) => FINDING_INFO[c].title))] }))
  for (const l of limbs.filter((x) => x.weaker)) {
    const muscles: Muscle[] = l.limb === 'leg' ? ['quads', 'glutes', 'hamstrings'] : ['biceps', 'triceps']
    const why = `${l.weaker} ${l.limb} has ${l.diffPct}% less lean mass`
    for (const m of muscles) {
      const e = strengthen.find((s) => s.muscle === m)
      if (e) e.because.push(why)
      else strengthen.push({ muscle: m, because: [why] })
    }
  }

  const latestAt = Math.max(0, ...[sScans.at(-1)?.takenAt, sComps.at(-1)?.measuredAt, lastTrunk?.takenAt].filter((x): x is number => x !== undefined))
  return { latestAt: latestAt || undefined, composition, series, limbs, posture, trunk, focus: { strengthen, stretch: mf.stretch }, missing }
}
