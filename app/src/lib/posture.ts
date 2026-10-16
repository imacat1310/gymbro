// Posture metrics → findings (features/02-posture-scan.md, ADR-009). Deterministic and on-device: computed from
// stored landmarks whenever a report is shown, so improving the maths re-analyses old scans too.
// Screening language only (SAFETY_PRIVACY.md): tendencies, never diagnoses.
import type { Landmark } from '@mediapipe/tasks-vision'
import type { Muscle } from '../data/exercises'
import type { PostureScan, ViewCapture } from '../db/db'
import { LM } from './pose'

export type Severity = 'none' | 'mild' | 'moderate' | 'marked'
export type Side = 'left' | 'right'
export type FindingCode =
  | 'shoulder_height_asymmetry' | 'pelvic_height_asymmetry' | 'lateral_trunk_shift' | 'head_tilt'
  | 'knee_valgus_static' | 'knee_varus_static' | 'forward_head' | 'rounded_shoulders' | 'knee_hyperextension'
  | 'shoulder_forward_asymmetry' | 'anterior_pelvic_tilt' | 'posterior_pelvic_tilt'

export interface Finding {
  code: FindingCode
  value: number
  unit: string
  severity: Severity
  /** 0–1. Below SHOW_AS_POSSIBLE the report says "possible"; below HIDE it isn't shown as a finding. */
  confidence: number
  side?: Side
  views: ('front' | 'side' | 'side_right' | 'back')[]
}

export interface Proportions {
  /** Thigh (hip→knee) ÷ torso (shoulders→hips). */
  femurTorso?: number
  /** Shoulder width ÷ hip width (joint centres, so larger than tape-measure ratios). */
  shoulderHip?: number
}

export interface PostureReport {
  findings: Finding[]
  proportions: Proportions
  /** Shown as a "see a professional" card (SAFETY_PRIVACY.md referral triggers). */
  referral?: string
  /** Things that limited the analysis (missing views, no level data…). */
  notes: string[]
}

export const SHOW_AS_POSSIBLE = 0.5
export const HIDE_BELOW = 0.3

/** Spec thresholds: [mild, moderate, marked]. */
const THRESHOLDS: Record<FindingCode, { at: [number, number, number]; below?: true }> = {
  shoulder_height_asymmetry: { at: [1, 2, 3] },
  pelvic_height_asymmetry: { at: [1, 1.5, 2.5] },
  lateral_trunk_shift: { at: [1.5, 3, 4.5] },
  head_tilt: { at: [3, 5, 8] },
  knee_valgus_static: { at: [5, 10, 15] },
  knee_varus_static: { at: [5, 10, 15] },
  // Craniovertebral angle: smaller is worse.
  forward_head: { at: [50, 45, 40], below: true },
  rounded_shoulders: { at: [2, 4, 6] },
  // Spec gives > 185°; moderate and marked step by 5°.
  knee_hyperextension: { at: [185, 190, 195] },
  // One shoulder further forward than the other, left vs right side photos (GymBro convention, no validated cut-off).
  shoulder_forward_asymmetry: { at: [2, 3, 4] },
  // ADR-023: most people tilt forward 5–15°, so that range isn't flagged. Posterior = front point higher than back.
  anterior_pelvic_tilt: { at: [16, 20, 25] },
  posterior_pelvic_tilt: { at: [0, 5, 10] },
}

/** How far each metric can be trusted from 2D landmarks alone, before per-scan quality. */
const RELIABILITY: Record<FindingCode, number> = {
  shoulder_height_asymmetry: 0.85,
  lateral_trunk_shift: 0.8,
  head_tilt: 0.75,
  pelvic_height_asymmetry: 0.65, // hip landmarks are estimated joint centres
  knee_valgus_static: 0.7,
  knee_varus_static: 0.7,
  knee_hyperextension: 0.65,
  rounded_shoulders: 0.6,
  forward_head: 0.55, // uses the shoulder instead of C7: an approximation (spec)
  shoulder_forward_asymmetry: 0.55, // two separate photos, standing and distance can differ between them
  anterior_pelvic_tilt: 0.7, // sticker-based; placement (palpation) is the main error
  posterior_pelvic_tilt: 0.7,
}

export function grade(code: FindingCode, value: number): Severity {
  const { at, below } = THRESHOLDS[code]
  const past = (t: number) => (below ? value < t : value > t)
  return past(at[2]) ? 'marked' : past(at[1]) ? 'moderate' : past(at[0]) ? 'mild' : 'none'
}

interface P { x: number; y: number; v: number }

const deg = (r: number) => (r * 180) / Math.PI
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v, b.v) })
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * Landmarks in pixels, rotated so true vertical (from the phone's tilt at capture) is the image's y axis.
 * Device axes: x right, y up. Back camera: image x = device x. Front camera (un-mirrored frame): image x = −device x.
 * Image y points down. So gravity's line tilts from image-down by +roll (front) or −roll (back).
 */
export function uprightPoints(cap: ViewCapture, camera: 'user' | 'environment'): P[] {
  const roll = cap.tilt?.rollDeg ?? 0
  const t = ((camera === 'user' ? roll : -roll) * Math.PI) / 180
  const cos = Math.cos(t), sin = Math.sin(t)
  const cx = cap.width / 2, cy = cap.height / 2
  return cap.landmarks.map((l: Landmark) => {
    const x = l.x * cap.width - cx, y = l.y * cap.height - cy
    return { x: x * cos - y * sin + cx, y: x * sin + y * cos + cy, v: l.visibility }
  })
}

/** One normalized raw-frame point rotated upright like uprightPoints (pixels). */
function uprightPoint(cap: ViewCapture, camera: 'user' | 'environment', p: { x: number; y: number }): { x: number; y: number } {
  const roll = cap.tilt?.rollDeg ?? 0
  const t = ((camera === 'user' ? roll : -roll) * Math.PI) / 180
  const cx = cap.width / 2, cy = cap.height / 2
  const x = p.x * cap.width - cx, y = p.y * cap.height - cy
  return { x: x * Math.cos(t) - y * Math.sin(t) + cx, y: x * Math.sin(t) + y * Math.cos(t) + cy }
}

/**
 * Sagittal pelvic tilt in degrees from the two hip stickers (ADR-023): the front–back line against horizontal,
 * corrected for phone roll. Positive = anterior (front point lower). Undefined without markers.
 */
export function pelvicTiltDeg(cap: ViewCapture, camera: 'user' | 'environment'): number | undefined {
  if (!cap.pelvis) return undefined
  const f = uprightPoint(cap, camera, cap.pelvis.front), b = uprightPoint(cap, camera, cap.pelvis.back)
  const run = Math.abs(f.x - b.x)
  if (run < 1) return undefined
  return (Math.atan2(f.y - b.y, run) * 180) / Math.PI
}

/** cm per pixel from the user's height and the crown-to-heel span (crown estimated above the face). */
export function cmPerPx(pts: P[], heightCm: number): number {
  const faceTop = Math.min(...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => pts[i].y))
  const shoulders = mid(pts[LM.leftShoulder], pts[LM.rightShoulder])
  const crown = faceTop - 0.5 * Math.max(0, shoulders.y - pts[LM.nose].y)
  const feet = Math.max(...[LM.leftHeel, LM.rightHeel, LM.leftFootIndex, LM.rightFootIndex].map((i) => pts[i].y))
  return heightCm / Math.max(1, feet - crown)
}

/** In a raw frame a person facing the camera has their left side at higher x; facing away, at lower x. */
function bySide(pts: P[], a: number, b: number, view: 'front' | 'back'): { left: P; right: P } {
  const [lo, hi] = pts[a].x < pts[b].x ? [pts[a], pts[b]] : [pts[b], pts[a]]
  return view === 'front' ? { left: hi, right: lo } : { left: lo, right: hi }
}

interface Raw { code: FindingCode; signed: number; unit: string; vis: number; view: 'front' | 'side' | 'side_right' | 'back' }

/** Frontal-plane metrics. Signed values: positive = towards / higher on the person's left. */
function frontal(pts: P[], view: 'front' | 'back', cm: number): Raw[] {
  const out: Raw[] = []
  const sh = bySide(pts, LM.leftShoulder, LM.rightShoulder, view)
  const hip = bySide(pts, LM.leftHip, LM.rightHip, view)
  // Image y grows downwards: left higher ⇔ smaller y.
  out.push({ code: 'shoulder_height_asymmetry', signed: (sh.right.y - sh.left.y) * cm, unit: 'cm', vis: Math.min(sh.left.v, sh.right.v), view })
  out.push({ code: 'pelvic_height_asymmetry', signed: (hip.right.y - hip.left.y) * cm, unit: 'cm', vis: Math.min(hip.left.v, hip.right.v), view })
  const shift = (mid(sh.left, sh.right).x - mid(hip.left, hip.right).x) * cm
  out.push({ code: 'lateral_trunk_shift', signed: view === 'front' ? shift : -shift, unit: 'cm', vis: Math.min(sh.left.v, sh.right.v, hip.left.v, hip.right.v), view })

  if (view === 'front') {
    const ear = bySide(pts, LM.leftEar, LM.rightEar, view)
    // Positive when the head tilts towards the left (left ear lower).
    const tilt = deg(Math.atan2(ear.left.y - ear.right.y, Math.abs(ear.left.x - ear.right.x)))
    out.push({ code: 'head_tilt', signed: tilt, unit: '°', vis: Math.min(ear.left.v, ear.right.v), view })

    const midX = mid(hip.left, hip.right).x
    const knee = bySide(pts, LM.leftKnee, LM.rightKnee, view)
    const ankle = bySide(pts, LM.leftAnkle, LM.rightAnkle, view)
    for (const s of ['left', 'right'] as const) {
      const H = hip[s], K = knee[s], A = ankle[s]
      const lineX = H.x + ((A.x - H.x) * (K.y - H.y)) / Math.max(1, A.y - H.y)
      const off = K.x - lineX
      const inward = Math.sign(off) === Math.sign(midX - lineX)
      // Deviation from a straight hip-knee-ankle line, in degrees.
      const devDeg = 180 - deg(Math.acos(Math.max(-1, Math.min(1,
        ((H.x - K.x) * (A.x - K.x) + (H.y - K.y) * (A.y - K.y)) / (Math.hypot(H.x - K.x, H.y - K.y) * Math.hypot(A.x - K.x, A.y - K.y))))))
      const vis = Math.min(H.v, K.v, A.v)
      const sign = s === 'left' ? 1 : -1
      out.push({ code: inward ? 'knee_valgus_static' : 'knee_varus_static', signed: sign * devDeg, unit: '°', vis, view })
    }
  }
  return out
}

/** Sagittal-plane metrics from the side view, using whichever side faced the camera. */
function sagittal(pts: P[], cm: number, view: 'side' | 'side_right' = 'side'): Raw[] {
  const near = (a: number, b: number) => (pts[a].v >= pts[b].v ? pts[a] : pts[b])
  const E = near(LM.leftEar, LM.rightEar), S = near(LM.leftShoulder, LM.rightShoulder)
  const H = near(LM.leftHip, LM.rightHip), K = near(LM.leftKnee, LM.rightKnee), A = near(LM.leftAnkle, LM.rightAnkle)
  // Facing direction: the nose is in front of the ear.
  const f = Math.sign(pts[LM.nose].x - E.x) || 1
  const out: Raw[] = []
  const cva = deg(Math.atan2(S.y - E.y, (E.x - S.x) * f))
  out.push({ code: 'forward_head', signed: cva, unit: '°', vis: Math.min(E.v, S.v), view })
  out.push({ code: 'rounded_shoulders', signed: (S.x - H.x) * f * cm, unit: 'cm', vis: Math.min(S.v, H.v), view })
  const lineX = H.x + ((A.x - H.x) * (K.y - H.y)) / Math.max(1, A.y - H.y)
  const behind = (K.x - lineX) * -f > 0
  const bend = 180 - deg(Math.acos(Math.max(-1, Math.min(1,
    ((H.x - K.x) * (A.x - K.x) + (H.y - K.y) * (A.y - K.y)) / (Math.hypot(H.x - K.x, H.y - K.y) * Math.hypot(A.x - K.x, A.y - K.y))))))
  out.push({ code: 'knee_hyperextension', signed: behind ? 180 + bend : 180 - bend, unit: '°', vis: Math.min(H.v, K.v, A.v), view })
  return out
}

/** Confidence from landmark visibility, capture steadiness, level data and the metric's own reliability. */
function confidence(code: FindingCode, vis: number, cap: ViewCapture): number {
  let c = RELIABILITY[code] * clamp01((vis - 0.4) / 0.5)
  if (cap.spread > 0.01) c *= 0.7
  else if (cap.spread > 0.005) c *= 0.9
  if (!cap.tilt) c *= code === 'forward_head' || code === 'rounded_shoulders' ? 0.9 : 0.6
  return c
}

const r1 = (v: number) => Math.round(v * 10) / 10

export function analyzeScan(scan: PostureScan): PostureReport {
  const notes: string[] = []
  const findings: Finding[] = []
  const proportions: Proportions = {}
  if (!scan.heightCm) notes.push('No height was given, so distances in cm could not be measured.')
  const height = scan.heightCm ?? 0

  const raws: { raw: Raw; cap: ViewCapture }[] = []
  for (const view of ['front', 'back'] as const) {
    const cap = scan.views[view]
    if (!cap) continue
    const pts = uprightPoints(cap, scan.camera)
    for (const raw of frontal(pts, view, height ? cmPerPx(pts, height) : 0)) raws.push({ raw, cap })
    if (!cap.tilt) notes.push(`The ${view} photo has no level reading from the phone, so left/right comparisons are less certain.`)
  }
  // Side views: the left side ('side') and, when scanned, the right side. Each sees only its near side.
  for (const v of ['side', 'side_right'] as const) {
    const cap = scan.views[v]
    if (!cap) continue
    const pts = uprightPoints(cap, scan.camera)
    for (const raw of sagittal(pts, height ? cmPerPx(pts, height) : 0, v)) raws.push({ raw, cap })
  }
  if (!scan.views.side && !scan.views.side_right) notes.push('No side photo: head, shoulder and knee alignment were not measured.')
  else if (!scan.views.side || !scan.views.side_right) notes.push('Only one side was scanned, so left and right shoulder position weren\'t compared. Add the right side next time.')

  // Left vs right shoulder depth: how much further forward one shoulder sits than the other (cm, positive = left).
  const leftRound = raws.find((r) => r.raw.code === 'rounded_shoulders' && r.raw.view === 'side')
  const rightRound = raws.find((r) => r.raw.code === 'rounded_shoulders' && r.raw.view === 'side_right')
  if (leftRound && rightRound && height) {
    const weaker = leftRound.raw.vis <= rightRound.raw.vis ? leftRound : rightRound
    raws.push({ raw: { code: 'shoulder_forward_asymmetry', signed: leftRound.raw.signed - rightRound.raw.signed, unit: 'cm', vis: weaker.raw.vis, view: 'side' }, cap: weaker.cap })
  }

  // Merge per code. Front and back (and left and right side) measure the same things; averaging them steadies the
  // result, and agreement between the two views raises confidence. Knees: keep the worse leg.
  const codes = [...new Set(raws.map((r) => r.raw.code))]
  for (const code of codes) {
    const items = raws.filter((r) => r.raw.code === code)
    const cmBased = items[0].raw.unit === 'cm'
    if (cmBased && !height) continue
    let value: number, signed: number, conf: number
    const views = [...new Set(items.map((i) => i.raw.view))]
    if (code === 'knee_valgus_static' || code === 'knee_varus_static' || code === 'knee_hyperextension') {
      // One value per leg (or a single side-view value): report the leg that deviates more.
      const pick = items.reduce((a, b) => (Math.abs(b.raw.signed - (code === 'knee_hyperextension' ? 180 : 0)) > Math.abs(a.raw.signed - (code === 'knee_hyperextension' ? 180 : 0)) ? b : a))
      signed = pick.raw.signed
      value = code === 'knee_hyperextension' ? signed : Math.abs(signed)
      conf = confidence(code, pick.raw.vis, pick.cap)
    } else {
      signed = items.reduce((s, i) => s + i.raw.signed, 0) / items.length
      // Angles are reported as they are; cm offsets as a distance with a side.
      value = code === 'forward_head' ? signed : Math.abs(signed)
      conf = Math.max(...items.map((i) => confidence(code, i.raw.vis, i.cap)))
      if (items.length === 2) {
        const [a, b] = items.map((i) => i.raw.signed)
        if (Math.sign(a) !== Math.sign(b) && Math.min(Math.abs(a), Math.abs(b)) > 0.5) conf *= 0.6 // views disagree
        else if (Math.abs(a - b) < 1) conf = Math.min(1, conf + 0.1)
      }
    }
    const sideOf: Side | undefined = ['forward_head', 'rounded_shoulders', 'knee_hyperextension'].includes(code) ? undefined
      : signed > 0 ? 'left' : signed < 0 ? 'right' : undefined
    findings.push({ code, value: r1(value), unit: items[0].raw.unit, severity: grade(code, value), confidence: Math.round(conf * 100) / 100, side: sideOf, views })
  }

  // Valgus and varus come from the same measurement; keep only the worse one.
  const valgus = findings.find((f) => f.code === 'knee_valgus_static'), varus = findings.find((f) => f.code === 'knee_varus_static')
  if (valgus && varus) findings.splice(findings.indexOf(valgus.value >= varus.value ? varus : valgus), 1)

  // Pelvic tilt from stickers (ADR-023): average the side views that have them.
  const tilts = (['side', 'side_right'] as const)
    .map((v) => ({ v, cap: scan.views[v] }))
    .filter((x): x is { v: 'side' | 'side_right'; cap: ViewCapture } => !!x.cap)
    .map((x) => ({ ...x, deg: pelvicTiltDeg(x.cap, scan.camera) }))
    .filter((x): x is { v: 'side' | 'side_right'; cap: ViewCapture; deg: number } => x.deg !== undefined)
  if (tilts.length) {
    const deg = tilts.reduce((a, t) => a + t.deg, 0) / tilts.length
    const code: FindingCode = deg >= 0 ? 'anterior_pelvic_tilt' : 'posterior_pelvic_tilt'
    let conf = Math.max(...tilts.map((t) => {
      const hip = t.cap.landmarks[t.cap.nearSide === 'right' ? LM.rightHip : LM.leftHip]
      return confidence(code, hip?.visibility ?? 0, t.cap)
    }))
    if (tilts.length === 2) conf = Math.abs(tilts[0].deg - tilts[1].deg) <= 4 ? Math.min(1, conf + 0.1) : conf * 0.6
    const value = Math.abs(deg)
    findings.push({ code, value: r1(value), unit: '°', severity: grade(code, value), confidence: Math.round(conf * 100) / 100, views: tilts.map((t) => t.v) })
  } else if (scan.views.side || scan.views.side_right) {
    notes.push('Pelvic tilt wasn\'t measured: put stickers on the front and back hip points before the side photo, then tap them on the review screen.')
  }

  const front = scan.views.front
  if (front) {
    const pts = uprightPoints(front, scan.camera)
    const sh = mid(pts[LM.leftShoulder], pts[LM.rightShoulder]), hp = mid(pts[LM.leftHip], pts[LM.rightHip])
    const thigh = (Math.hypot(pts[LM.leftHip].x - pts[LM.leftKnee].x, pts[LM.leftHip].y - pts[LM.leftKnee].y)
      + Math.hypot(pts[LM.rightHip].x - pts[LM.rightKnee].x, pts[LM.rightHip].y - pts[LM.rightKnee].y)) / 2
    const torso = Math.hypot(sh.x - hp.x, sh.y - hp.y)
    const shW = Math.abs(pts[LM.leftShoulder].x - pts[LM.rightShoulder].x), hipW = Math.abs(pts[LM.leftHip].x - pts[LM.rightHip].x)
    if (torso > 0) proportions.femurTorso = Math.round((thigh / torso) * 100) / 100
    if (hipW > 0) proportions.shoulderHip = Math.round((shW / hipW) * 100) / 100
  }

  return { findings, proportions, referral: referralFor(findings), notes }
}

/**
 * SAFETY_PRIVACY.md referral triggers: shoulder height difference > 2.5 cm together with a lateral trunk shift,
 * or a marked trunk shift on its own. Only on findings confident enough to show.
 */
export function referralFor(findings: Finding[]): string | undefined {
  const f = (c: FindingCode) => findings.find((x) => x.code === c && x.confidence >= SHOW_AS_POSSIBLE)
  const shoulder = f('shoulder_height_asymmetry'), shift = f('lateral_trunk_shift')
  if ((shoulder && shoulder.value > 2.5 && shift && shift.severity !== 'none') || shift?.severity === 'marked') {
    return 'Your shoulders and trunk appear noticeably uneven. Patterns like this are worth having checked by a physiotherapist or doctor before you load your spine heavily. It may well be nothing, and a professional can tell you for sure.'
  }
  return undefined
}

/** Plain-language text and the training response per finding (spec mapping table). */
export const FINDING_INFO: Record<FindingCode, { title: string; metric: string; what: string; response: string; tentative?: true }> = {
  anterior_pelvic_tilt: {
    title: 'Pelvis tilted forward',
    metric: 'Pelvic tilt (front point lower)',
    what: 'The front of the pelvis sits lower than the back, measured from your two hip stickers. Most people tilt forward 5–15°; above about 16° is a tendency worth balancing, not a problem on its own.',
    response: 'Hip-flexor stretches, glute and deep-core work (glute bridges, dead bugs) and a pelvic-tilt drill to feel the range.',
  },
  posterior_pelvic_tilt: {
    title: 'Pelvis tilted backward',
    metric: 'Pelvic tilt (front point higher)',
    what: 'The front of the pelvis sits higher than the back (a flatter lower back), measured from your two hip stickers. Less common than a forward tilt.',
    response: 'Hamstring stretches, a pelvic-tilt drill, and back-extensor control such as bird dogs.',
  },
  shoulder_height_asymmetry: {
    title: 'Uneven shoulder height',
    metric: 'Shoulder height difference',
    what: 'One shoulder sits higher than the other. Small differences are very common, often from a dominant side.',
    response: 'One-sided exercises, starting with the weaker side, and suitcase carries.',
  },
  pelvic_height_asymmetry: {
    title: 'Uneven hip height',
    metric: 'Hip height difference',
    what: 'One hip appears higher. Can come from posture habits, muscle balance or leg length; photos only estimate this.',
    response: 'Single-leg work (split squats, single-leg RDLs) and side planks on both sides.',
  },
  lateral_trunk_shift: {
    title: 'Trunk shifted to one side',
    metric: 'Trunk shift',
    what: 'Your upper body sits slightly to one side of your hips.',
    response: 'Side-lying stretch on the tight side; side planks with an extra set on the weaker side, Copenhagen planks.',
  },
  head_tilt: {
    title: 'Head tilted to one side',
    metric: 'Head tilt',
    what: 'Your head leans slightly towards one shoulder.',
    response: 'Neck mobility and awareness; often improves with the upper-back work in your plan.',
  },
  knee_valgus_static: {
    title: 'Knees angle inwards',
    metric: 'Knee alignment (front)',
    what: 'Standing, your knees sit inside the line from hip to ankle.',
    response: 'Glute med work (banded walks, side-lying abduction), split squats, ankle mobility; cue "knees out" when squatting.',
  },
  knee_varus_static: {
    title: 'Knees angle outwards',
    metric: 'Knee alignment (front)',
    what: 'Standing, your knees sit outside the line from hip to ankle.',
    response: 'Usually structural; train through a comfortable range and keep knees tracking over toes.',
  },
  forward_head: {
    title: 'Forward head posture',
    metric: 'Head position (side, ear–shoulder angle)',
    what: 'Your head sits in front of your shoulders when seen from the side (approximate, measured from ear to shoulder).',
    response: 'Chin tucks and deep neck flexor holds, upper-trap stretch; keep a neutral neck on pulls.',
  },
  rounded_shoulders: {
    title: 'Rounded shoulders',
    metric: 'Shoulder position (side)',
    what: 'Your shoulders sit in front of your hips when seen from the side.',
    response: 'Pec doorway stretch, thoracic extension; face pulls, band pull-aparts, rear delt flies; pull at least as much as you push.',
  },
  shoulder_forward_asymmetry: {
    title: 'One shoulder further forward',
    metric: 'Shoulder depth, left vs right (side photos)',
    what: 'Seen from each side, one shoulder sits further forward than the other. Common with one-sided sports and a rotated upper back; photos only estimate it.',
    // Compares two separate photos with no validated cut-off: always worded as "possible".
    tentative: true,
    response: 'Stretch the chest and front of the shoulder on the forward side; rear delt and lower-trap work, starting with that side.',
  },
  knee_hyperextension: {
    title: 'Knees lock back',
    metric: 'Knee angle (side)',
    what: 'Seen from the side, your knees bend slightly backwards when standing straight.',
    response: 'Stand with soft knees; hamstring and calf strengthening; avoid locking out hard under load.',
  },
}

/**
 * Muscles to strengthen and areas to stretch per finding (spec mapping table; Janda-style patterns).
 * Muscle ids match the exercise database, so the plan builder can use them as priorities.
 */
export const FINDING_MUSCLES: Record<FindingCode, { strengthen: Muscle[]; stretch: string[] }> = {
  anterior_pelvic_tilt: { strengthen: ['glutes', 'abs'], stretch: ['Hip flexors (front of the hip)', 'Quads'] },
  posterior_pelvic_tilt: { strengthen: ['hip_flexors', 'lower_back'], stretch: ['Hamstrings'] },
  forward_head: { strengthen: ['neck', 'lower_trap', 'upper_back'], stretch: ['Upper traps / side of the neck', 'Chest'] },
  rounded_shoulders: { strengthen: ['rear_delt', 'lower_trap', 'upper_back'], stretch: ['Chest (pecs)', 'Front of the shoulders'] },
  shoulder_height_asymmetry: { strengthen: ['lower_trap', 'obliques'], stretch: [] },
  pelvic_height_asymmetry: { strengthen: ['glute_med', 'obliques'], stretch: ['Side of the trunk (QL) on the higher side'] },
  lateral_trunk_shift: { strengthen: ['obliques', 'glute_med'], stretch: ['Side of the trunk (QL) on the tight side'] },
  head_tilt: { strengthen: ['neck'], stretch: ['Side of the neck'] },
  knee_valgus_static: { strengthen: ['glute_med', 'glutes'], stretch: ['Calves (ankle mobility)', 'Adductors'] },
  knee_varus_static: { strengthen: ['adductors', 'glute_med'], stretch: [] },
  knee_hyperextension: { strengthen: ['hamstrings', 'calves'], stretch: [] },
  shoulder_forward_asymmetry: { strengthen: ['rear_delt', 'lower_trap'], stretch: ['Chest and front of the shoulder on the forward side'] },
}

const SEVERITY_WEIGHT: Record<Severity, number> = { none: 0, mild: 1, moderate: 2, marked: 3 }

export interface MuscleFocus {
  muscle: Muscle
  /** Sum of severity weights of the findings that call for it: higher = more important. */
  score: number
  because: FindingCode[]
}

/** Combine confident findings into a ranked "strengthen" list and a "stretch" list. */
export function muscleFocus(findings: Finding[]): { strengthen: MuscleFocus[]; stretch: string[] } {
  const byMuscle = new Map<Muscle, MuscleFocus>()
  const stretch = new Set<string>()
  for (const f of findings) {
    if (f.severity === 'none' || f.confidence < SHOW_AS_POSSIBLE) continue
    const map = FINDING_MUSCLES[f.code]
    for (const m of map.strengthen) {
      const cur = byMuscle.get(m) ?? { muscle: m, score: 0, because: [] }
      cur.score += SEVERITY_WEIGHT[f.severity]
      cur.because.push(f.code)
      byMuscle.set(m, cur)
    }
    map.stretch.forEach((x) => stretch.add(x))
  }
  return { strengthen: [...byMuscle.values()].sort((a, b) => b.score - a.score), stretch: [...stretch] }
}
