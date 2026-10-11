// InBody result sheet → values (ADR-008). OCR text is noisy, so each field is found by its printed label,
// read as the first plausible number after it, and dropped if it falls outside a human range.
// Everything here is a suggestion: the user reviews every value before it is saved.

export type InBodyField =
  | 'weightKg' | 'smmKg' | 'bodyFatKg' | 'pbf' | 'bmi' | 'visceralFat' | 'bmrKcal' | 'score' | 'tbwL' | 'ecwTbw'
  | 'leanRightArm' | 'leanLeftArm' | 'leanTrunk' | 'leanRightLeg' | 'leanLeftLeg'

export type InBodyValues = Partial<Record<InBodyField, number>>

interface FieldDef {
  label: string
  unit: string
  /** Plausible range; anything outside is treated as a misread. */
  min: number
  max: number
  /** Decimal places shown and stored. */
  dp: number
  group: 'main' | 'segmental' | 'extra'
}

export const FIELDS: Record<InBodyField, FieldDef> = {
  weightKg: { label: 'Weight', unit: 'kg', min: 25, max: 300, dp: 1, group: 'main' },
  smmKg: { label: 'Skeletal muscle mass', unit: 'kg', min: 8, max: 80, dp: 1, group: 'main' },
  bodyFatKg: { label: 'Body fat mass', unit: 'kg', min: 1, max: 200, dp: 1, group: 'main' },
  pbf: { label: 'Body fat', unit: '%', min: 2, max: 70, dp: 1, group: 'main' },
  bmi: { label: 'BMI', unit: '', min: 10, max: 70, dp: 1, group: 'main' },
  visceralFat: { label: 'Visceral fat level', unit: '', min: 1, max: 20, dp: 0, group: 'extra' },
  bmrKcal: { label: 'Basal metabolic rate', unit: 'kcal', min: 700, max: 4000, dp: 0, group: 'extra' },
  score: { label: 'InBody score', unit: '/100', min: 30, max: 120, dp: 0, group: 'extra' },
  tbwL: { label: 'Total body water', unit: 'L', min: 15, max: 90, dp: 1, group: 'extra' },
  ecwTbw: { label: 'ECW/TBW', unit: '', min: 0.3, max: 0.45, dp: 3, group: 'extra' },
  leanRightArm: { label: 'Right arm', unit: 'kg', min: 0.5, max: 10, dp: 2, group: 'segmental' },
  leanLeftArm: { label: 'Left arm', unit: 'kg', min: 0.5, max: 10, dp: 2, group: 'segmental' },
  leanTrunk: { label: 'Trunk', unit: 'kg', min: 8, max: 60, dp: 1, group: 'segmental' },
  leanRightLeg: { label: 'Right leg', unit: 'kg', min: 3, max: 25, dp: 2, group: 'segmental' },
  leanLeftLeg: { label: 'Left leg', unit: 'kg', min: 3, max: 25, dp: 2, group: 'segmental' },
}

export const FIELD_ORDER = Object.keys(FIELDS) as InBodyField[]
const MASS_FIELDS: InBodyField[] = ['weightKg', 'smmKg', 'bodyFatKg', 'leanRightArm', 'leanLeftArm', 'leanTrunk', 'leanRightLeg', 'leanLeftLeg']
const LB_PER_KG = 2.20462

const NUM_RE = /\d{1,4}(?:[.,]\d{1,3})?/g
// Normal ranges printed next to values ("(55.8~75.4)", "55.8–75.4") are never the measurement.
const RANGE_RE = /\(?\s*\d{1,4}(?:[.,]\d{1,3})?\s*[~–-]\s*\d{1,4}(?:[.,]\d{1,3})?\s*\)?/g

/** Labels as printed on InBody 270/570/770 sheets, with common OCR slips (e.g. "Skeleta1"). */
const LABELS: [InBodyField, string][] = [
  ['smmKg', String.raw`skelet[a@][l1i]\s*musc[l1i]e\s*mass|\bSMM\b`],
  ['bodyFatKg', String.raw`body\s*fat\s*mass|\bBFM\b`],
  ['pbf', String.raw`percent\s*body\s*fat|\bPBF\b`],
  ['bmi', String.raw`\bBMI\b(?:\s*\(?\s*body\s*mass\s*index\s*\)?)?`],
  ['visceralFat', String.raw`visceral\s*fat\s*(?:level|area)`],
  ['bmrKcal', String.raw`basal\s*metabolic\s*rate|\bBMR\b`],
  ['score', String.raw`in\s*body\s*score`],
  ['tbwL', String.raw`total\s*body\s*water|\bTBW\b(?!\s*[/\\])`],
  ['ecwTbw', String.raw`ECW\s*[/\\Il1|]\s*TBW`],
  // "Weight" also appears in "Target Weight" and "Weight Control": skip those.
  ['weightKg', String.raw`(?<!target\s{0,3})(?<!fat\s{0,3}free\s{0,3})\bweight\b(?!\s*control)`],
]

const SEGMENTS: [InBodyField, string][] = [
  ['leanRightArm', String.raw`right\s*arm`],
  ['leanLeftArm', String.raw`left\s*arm`],
  ['leanTrunk', String.raw`trunk`],
  ['leanRightLeg', String.raw`right\s*leg`],
  ['leanLeftLeg', String.raw`left\s*leg`],
]

const toNum = (s: string) => parseFloat(s.replace(',', '.'))
const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp

/** Bar-chart lines print a row of scale ticks (often garbled by OCR) before the measurement. */
const CHART_MIN_NUMBERS = 5

interface Reading { v: number; inferred: boolean }

/**
 * Interpret one number token for `field`. InBody prints decimal values with their decimals, so a whole number
 * where decimals are expected usually lost its point in OCR ("311" for 3.11): that reading is marked inferred.
 */
function interpret(token: string, field: InBodyField, scale: number): Reading | undefined {
  const { min, max, dp } = FIELDS[field]
  const inRange = (v: number) => v >= min && v <= max
  const v = toNum(token) / scale
  if (dp > 0 && !/[.,]/.test(token) && token.length >= 3) {
    // Try the decimal places the field normally has, then fewer (a 2-dp field can print as 1 dp).
    for (let k = dp; k >= 1; k--) {
      const fixed = v / 10 ** k
      if (inRange(fixed) && (k === dp || !inRange(v))) return { v: fixed, inferred: true }
    }
  }
  return inRange(v) ? { v, inferred: false } : undefined
}

/**
 * The value for `field`: on the rest of the line after its label, the first number that fits.
 * On a bar-chart line the measurement is printed at the end, so read backwards.
 * `scale` converts the printed unit to ours (2.20462 for pound sheets).
 */
function valueAfter(text: string, label: string, field: InBodyField, scale = 1): Reading | undefined {
  for (const m of text.matchAll(new RegExp(`(?:${label})([^\n]*)`, 'gi'))) {
    const tokens = [...m[1].replace(RANGE_RE, ' ').matchAll(NUM_RE)].map((x) => x[0])
    for (const t of tokens.length >= CHART_MIN_NUMBERS ? tokens.reverse() : tokens) {
      const r = interpret(t, field, scale)
      if (r) return r
    }
  }
  return undefined
}

/** The sheet's test date, if printed (2026.03.14, 2026-03-14 or 14.03.2026). */
export function parseDate(text: string): number | undefined {
  const iso = text.match(/\b(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})\b/)
  const eu = text.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})\b/)
  const parts = iso ? [+iso[1], +iso[2], +iso[3]] : eu ? [+eu[3], +eu[2], +eu[1]] : null
  if (!parts) return undefined
  const [y, mo, d] = parts
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined
  const t = new Date(y, mo - 1, d, 12).getTime()
  return t <= Date.now() + 86_400_000 ? t : undefined
}

export interface ParseResult {
  values: InBodyValues
  /** Fields that were read from the text (the rest are for the user to fill in). */
  found: InBodyField[]
  /** Found, but the decimal point had to be inferred: highlighted for a closer check. */
  uncertain: InBodyField[]
  /** True when the sheet was in pounds and masses were converted to kg. */
  convertedFromLb: boolean
  date?: number
}

export function parseInBody(raw: string): ParseResult {
  // Normalise: unify whitespace inside lines, keep line breaks (values sit on the same line as labels).
  const text = raw.replace(/[ \t ]+/g, ' ').replace(/\r/g, '')
  const lb = (text.match(/\blbs?\b/gi)?.length ?? 0) > (text.match(/\bkg\b/gi)?.length ?? 0)

  const values: InBodyValues = {}
  const uncertain = new Set<InBodyField>()
  const put = (field: InBodyField, r: Reading | undefined) => {
    if (!r) return
    values[field] = round(r.v, FIELDS[field].dp)
    if (r.inferred) uncertain.add(field)
  }
  for (const [field, label] of LABELS) put(field, valueAfter(text, label, field, lb && MASS_FIELDS.includes(field) ? LB_PER_KG : 1))

  // Segmental lean mass: inside the "Segmental Lean Analysis" block, before the fat block if there is one.
  const start = text.search(/segmental\s*lean/i)
  if (start >= 0) {
    const rest = text.slice(start)
    const end = rest.slice(10).search(/segmental\s*fat|body\s*composition\s*history|ECW\s*[/\\Il1|]\s*TBW\s*analysis/i)
    const block = end >= 0 ? rest.slice(0, end + 10) : rest
    for (const [field, label] of SEGMENTS) put(field, valueAfter(block, label, field, lb ? LB_PER_KG : 1))
  }

  // Cross-check: PBF should match fat mass / weight. If both are read but disagree a lot, trust neither.
  const { weightKg, bodyFatKg, pbf } = values
  if (weightKg && bodyFatKg && pbf && Math.abs((bodyFatKg / weightKg) * 100 - pbf) > 3) {
    delete values.bodyFatKg
    delete values.pbf
  }

  const found = FIELD_ORDER.filter((f) => values[f] !== undefined)
  return { values, found, uncertain: found.filter((f) => uncertain.has(f)), convertedFromLb: lb, date: parseDate(text) }
}
