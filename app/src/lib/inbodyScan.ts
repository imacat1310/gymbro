// Position-aware InBody reading (ADR-008 rev. 2). Line-by-line text breaks on real sheets: two columns share
// lines, chart scales sit beside values, and OCR splits numbers ("80." "6"). So:
//  1. per OCR pass, find each label's box and take the best number beside it in the same column (size, decimals,
//     range, not a chart tick); the segmental figure is read by position;
//  2. pool candidates from all passes and the text parser;
//  3. resolve with the sheet's own arithmetic: water + protein + minerals + fat = weight, PBF = fat ÷ weight,
//     BMI = weight ÷ height². What can't be confirmed is marked "check"; what is derived, "calculated".
// Pure functions (no DOM) so they can be unit-tested with synthetic word boxes.
import { FIELDS, FIELD_ORDER, parseInBody, type InBodyField, type InBodyValues } from './inbody'

export interface Word { text: string; x0: number; y0: number; x1: number; y1: number; conf: number }
export interface Pass {
  text: string
  words: Word[]
  width: number
  height: number
  /** Page tilt in radians (positive = text runs downhill to the right). */
  skew?: number
}

/** Straighten word boxes for a tilted photo, so a label and a value far to its right stay on one row. */
export function deskew(words: Word[], skew: number, width: number): Word[] {
  if (!skew) return words
  const t = Math.tan(skew)
  return words.map((w) => {
    const dy = ((w.x0 + w.x1) / 2 - width / 2) * t
    return { ...w, y0: w.y0 - dy, y1: w.y1 - dy }
  })
}

export type Status = 'read' | 'check' | 'calculated'

export interface ScanResult {
  values: InBodyValues
  status: Partial<Record<InBodyField, Status>>
  date?: number
  /** Height printed on the sheet, used for the BMI check. */
  sheetHeightCm?: number
  convertedFromLb: boolean
}

const h = (w: Word) => w.y1 - w.y0
const cy = (w: Word) => (w.y0 + w.y1) / 2
const toNum = (s: string) => parseFloat(s.replace(',', '.'))

/** OCR often splits one number into two words ("80." + "6", "19." + "7"): join them back. */
export function mergeFragments(words: Word[]): Word[] {
  const sorted = [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
  const out: Word[] = []
  const used = new Set<Word>()
  for (const w of sorted) {
    if (used.has(w)) continue
    let cur = w
    for (;;) {
      if (!/^\d{1,3}[.,]$/.test(cur.text)) break
      const next = sorted.find((n) => !used.has(n) && n !== cur && /^\d/.test(n.text)
        && n.x0 >= cur.x1 - 2 && n.x0 - cur.x1 < 1.2 * h(cur) && Math.abs(cy(n) - cy(cur)) < 0.5 * h(cur))
      if (!next) break
      used.add(next)
      cur = { text: cur.text + next.text, x0: cur.x0, y0: Math.min(cur.y0, next.y0), x1: next.x1, y1: Math.max(cur.y1, next.y1), conf: Math.min(cur.conf, next.conf) }
    }
    out.push(cur)
  }
  return out
}

/** A number token, ignoring stray units and punctuation; ranges and bracketed reference values are not numbers. */
export function numberOf(text: string): { v: number; decimal: boolean } | null {
  // "(37.4", "45.8)", "8.0~16.0" are parts of printed reference ranges.
  if (/~/.test(text) || /^\(/.test(text) || /\d\)$/.test(text)) return null
  const m = text.match(/^[|[(:"'“—-]?(\d{1,4}(?:[.,]\d{1,3})?)(?:kg|ke|kc|xg|g|%|cm|kcal|[|\]):;,'"!.])*$/i)
  return m ? { v: toNum(m[1]), decimal: /[.,]\d/.test(m[1]) } : null
}

/** The word right after `w` on the same line, if close enough to belong to the same phrase. */
function nextOnLine(words: Word[], w: Word): Word | undefined {
  return words.filter((n) => n !== w && n.x0 >= w.x1 - 0.3 * h(w) && n.x0 - w.x1 < 2.5 * h(w) && Math.abs(cy(n) - cy(w)) < 0.6 * Math.max(h(n), h(w)))
    .sort((p, q) => p.x0 - q.x0)[0]
}
function prevOnLine(words: Word[], w: Word): Word | undefined {
  return words.filter((n) => n !== w && n.x1 <= w.x0 + 0.3 * h(w) && w.x0 - n.x1 < 2.5 * h(w) && Math.abs(cy(n) - cy(w)) < 0.6 * Math.max(h(n), h(w)))
    .sort((p, q) => q.x1 - p.x1)[0]
}

/**
 * Boxes of every phrase matching `re`. Each word starts a chain of following words on the same line; the label
 * must match from the start of the chain. `notAfter` rejects phrases preceded by a word like "Target".
 */
function find(words: Word[], re: RegExp, notAfter?: RegExp): Word[] {
  const out: Word[] = []
  const head = new RegExp(`^(?:${re.source})`, 'i')
  for (const w of words) {
    const chain = [w]
    while (chain.length < 6) {
      const n = nextOnLine(words, chain.at(-1)!)
      if (!n) break
      chain.push(n)
    }
    const text = chain.map((c) => c.text).join(' ')
    const m = text.match(head)
    if (!m || m[0].length < Math.min(2, w.text.length)) continue
    if (notAfter && prevOnLine(words, w) && notAfter.test(prevOnLine(words, w)!.text)) continue
    let len = 0
    const used = chain.filter((c) => { const inside = len < m[0].length; len += c.text.length + 1; return inside })
    out.push(box(used))
  }
  return out
}

const box = (ws: Word[]): Word => ({ text: ws.map((w) => w.text).join(' '), x0: Math.min(...ws.map((w) => w.x0)), y0: Math.min(...ws.map((w) => w.y0)), x1: Math.max(...ws.map((w) => w.x1)), y1: Math.max(...ws.map((w) => w.y1)), conf: 0 })

type Field = InBodyField | 'proteinKg' | 'mineralKg'

const LABEL_RE: Partial<Record<Field, RegExp>> = {
  tbwL: /total\s*body\s*water/,
  proteinKg: /\bprotein\b/,
  mineralKg: /\bminerals?\b/,
  bodyFatKg: /body\s*fat\s*mass/,
  weightKg: /weight\b(?!\s*control)/,
  smmKg: /\bSMM\b|skelet[a@][l1i]\s*musc[l1i]e\s*mass/,
  bmi: /\bBMI\b/,
  pbf: /\bPBF\b|percent\s*body\s*fat/,
  bmrKcal: /basal\s*metabolic\s*rate/,
  ecwTbw: /ECW\s*[/\\Il1|]\s*TBW/,
}
const RANGES: Record<'proteinKg' | 'mineralKg', [number, number]> = { proteinKg: [3, 30], mineralKg: [1, 9] }
const rangeOf = (f: Field): [number, number] => (f === 'proteinKg' || f === 'mineralKg' ? RANGES[f] : [FIELDS[f].min, FIELDS[f].max])
const dpOf = (f: Field) => (f === 'proteinKg' ? 1 : f === 'mineralKg' ? 2 : FIELDS[f].dp)
/** Printed chart scales (BMI and PBF bars): a reading equal to a tick is far more likely to be the tick. */
const TICKS: Partial<Record<Field, number[]>> = {
  bmi: [10, 15, 18.5, 21, 22, 25, 30, 35, 40, 45, 50, 55],
  pbf: [0, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30, 33, 35, 38, 40, 43, 45, 48, 50],
}
const RIGHT_COLUMN = /in\s*body\s*score|weight\s*control|obesity\s*evaluation|research\s*parameters|calorie\s*expenditure|waist[-\s]*hip|visceral\s*fat/

export type Candidates = Partial<Record<Field, number[]>>

/** Candidate values from one OCR pass, by label position. */
export function candidatesFromWords(pass: Pass): Candidates {
  const words = mergeFragments(deskew(pass.words.filter((w) => w.text.trim()), pass.skew ?? 0, pass.width))
  const out: Candidates = {}
  const add = (f: Field, v: number) => { (out[f] ??= []).push(v) }

  // The right-hand column (score, weight control, research parameters…) starts where its headers do.
  const rightHeads = find(words, RIGHT_COLUMN).filter((b) => b.x0 > pass.width * 0.5)
  const colX = rightHeads.length ? Math.min(...rightHeads.map((b) => b.x0)) - 0.01 * pass.width : Infinity
  // Rows below "Body Composition History" repeat old values: ignore them.
  const historyY = find(words, /composition\s*history/)[0]?.y0 ?? Infinity

  for (const [f, re] of Object.entries(LABEL_RE) as [Field, RegExp][]) {
    for (const a of find(words, re, f === 'weightKg' ? /^(target|free)$/i : undefined)) {
      if (a.y0 >= historyY) continue
      const inLeft = a.x0 < colX
      const ah = h(a)
      const [min, max] = rangeOf(f)
      const cands = words
        .filter((w) => w.x0 > a.x1 && (inLeft ? w.x1 <= colX : true)
          && cy(w) >= a.y0 - 0.35 * ah && cy(w) <= a.y1 + 0.35 * ah)
        .map((w) => ({ w, n: numberOf(w.text) }))
        .filter((c): c is { w: Word; n: { v: number; decimal: boolean } } => !!c.n && c.n.v >= min && c.n.v <= max)
        .filter((c) => !TICKS[f]?.includes(c.n.v))
      if (!cands.length) continue
      // Decimal values over integer ticks; then the larger print; then the one nearest the label's middle.
      const pool = dpOf(f) > 0 && cands.some((c) => c.n.decimal) ? cands.filter((c) => c.n.decimal) : cands
      pool.sort((p, q) => h(q.w) - h(p.w) || Math.abs(cy(p.w) - cy(a)) - Math.abs(cy(q.w) - cy(a)))
      add(f, pool[0].n.v)
    }
  }

  // InBody score: printed large below its label ("84/100 Points"); digits may come out as separate words.
  for (const a of find(words, /in\s*body\s*score/)) {
    const below = words.filter((w) => w.y0 > a.y0 && w.y0 < a.y1 + 5 * h(a) && w.x0 > a.x0 - h(a) && w.x0 < a.x0 + 0.25 * pass.width)
      .sort((p, q) => p.x0 - q.x0)
    const big = below.filter((w) => h(w) > 1.4 * h(a) && /^\d/.test(w.text))
    const digits = big.map((w) => w.text.replace(/\D.*$/, '')).join('')
    const v = parseInt(digits.slice(0, 3), 10)
    if (v >= 30 && v <= 120) add('score', v)
    else if (parseInt(digits.slice(0, 2), 10) >= 30) add('score', parseInt(digits.slice(0, 2), 10))
  }

  // Visceral fat: "Level 6" printed under the label (a "Low 10 High" scale sits next to it).
  for (const a of find(words, /visceral\s*fat\s*level/)) {
    const lvl = words.find((w) => /^level$/i.test(w.text) && w.y0 > a.y0 && w.y0 < a.y1 + 6 * h(a) && Math.abs(w.x0 - a.x0) < 0.2 * pass.width)
    const val = lvl && words.find((w) => w.x0 > lvl.x1 && w.x0 - lvl.x1 < 6 * h(lvl) && Math.abs(cy(w) - cy(lvl)) < 0.6 * h(lvl) && /^\d{1,2}$/.test(w.text))
    if (val) add('visceralFat', parseInt(val.text, 10))
    else {
      // "Level" may be lost; then take a lone small integer below the label, left of the scale.
      const lone = words.filter((w) => /^\d{1,2}$/.test(w.text) && w.y0 > a.y1 && w.y0 < a.y1 + 6 * h(a) && w.x0 < a.x0 + 0.08 * pass.width && w.x0 > a.x0 - 0.02 * pass.width)
      if (lone.length === 1) add('visceralFat', parseInt(lone[0].text, 10))
    }
  }

  // Segmental lean mass, labelled table (InBody 570/770: "Right Arm 3.11 kg"): the value beside each label.
  // Inside the lean block when its header was read; otherwise the first occurrence (the lean table comes first).
  const leanHead = find(words, /segmental\s*lean/)[0]
  const SEG: [InBodyField, RegExp][] = [
    ['leanRightArm', /right\s*arm/], ['leanLeftArm', /left\s*arm/], ['leanTrunk', /trunk/], ['leanRightLeg', /right\s*leg/], ['leanLeftLeg', /left\s*leg/],
  ]
  const fatBelow = leanHead && find(words, /segmental\s*fat|ECW\s*[/\\Il1|]\s*TBW\s*analysis|composition\s*history/).find((b) => b.y0 > leanHead.y1 + h(leanHead))
  const blockTop = leanHead ? leanHead.y1 : -Infinity
  const blockBottom = leanHead ? (fatBelow ? fatBelow.y0 : leanHead.y1 + 0.25 * pass.height) : historyY
  let labelled = false
  for (const [field, re] of SEG) {
    const a = find(words, re).filter((b) => b.y0 > blockTop && b.y1 < blockBottom).sort((p, q) => p.y0 - q.y0)[0]
    if (!a) continue
    const c = words.filter((w) => w.x0 > a.x1 && w.x0 - a.x1 < 0.3 * pass.width && Math.abs(cy(w) - cy(a)) < 0.5 * h(a))
      .map((w) => ({ w, n: numberOf(w.text) }))
      .filter((x) => x.n?.decimal && x.n.v >= FIELDS[field].min && x.n.v <= FIELDS[field].max)
      .sort((p, q) => p.w.x0 - q.w.x0)[0]
    if (c?.n) { add(field, c.n.v); labelled = true }
  }

  // Segmental lean figure (InBody 270 style): five kg values placed on a body outline, "Left" on the image left.
  const lean = leanHead
  if (lean && !labelled) {
    const fat = find(words, /segmental\s*fat/).find((b) => Math.abs(b.y0 - lean.y0) < 3 * h(lean) && b.x0 > lean.x1)
    const x0 = lean.x0 - 0.03 * pass.width, x1 = fat ? fat.x0 - 0.01 * pass.width : Math.min(colX, lean.x0 + 0.4 * pass.width)
    const yTop = lean.y1, yBottom = Math.min(historyY, lean.y1 + 0.3 * pass.height)
    const inFig = words.filter((w) => w.x0 >= x0 && w.x1 <= x1 && w.y0 > yTop && w.y1 < yBottom)
      .map((w) => ({ w, n: numberOf(w.text) })).filter((c) => c.n?.decimal) as { w: Word; n: { v: number; decimal: boolean } }[]
    if (inFig.length) {
      // Arms and legs sit symmetrically, so the figure's centre line is midway between the outermost values.
      const xs = inFig.map(({ w }) => cx(w))
      const midX = (Math.min(...xs) + Math.max(...xs)) / 2
      // Trunk: on the centre line. Arms above it, legs below it; left/right by side of the centre line.
      const trunk = inFig.filter(({ w, n }) => Math.abs(cx(w) - midX) < 0.035 * pass.width && n.v >= FIELDS.leanTrunk.min && n.v <= FIELDS.leanTrunk.max)
        .sort((p, q) => Math.abs(cx(p.w) - midX) - Math.abs(cx(q.w) - midX))[0]
      if (trunk) add('leanTrunk', trunk.n.v)
      const ys = inFig.map(({ w }) => cy(w))
      const refY = trunk ? cy(trunk.w) : (Math.min(...ys) + Math.max(...ys)) / 2
      const side = (field: InBodyField, left: boolean, above: boolean) => {
        const c = inFig.filter(({ w, n }) => (cx(w) < midX) === left && Math.abs(cx(w) - midX) >= 0.035 * pass.width
          && (above ? cy(w) < refY : cy(w) > refY) && n.v >= FIELDS[field].min && n.v <= FIELDS[field].max)
          .sort((p, q) => p.w.y0 - q.w.y0)[0] // the kg value sits above its % value
        if (c) add(field, c.n.v)
      }
      side('leanLeftArm', true, true); side('leanRightArm', false, true)
      side('leanLeftLeg', true, false); side('leanRightLeg', false, false)
    }
  }
  return out
}

const cx = (w: Word) => (w.x0 + w.x1) / 2

/** Height printed in the sheet header ("Height 168cm"). */
export function sheetHeight(text: string): number | undefined {
  const m = text.match(/\b(1[2-9]\d|2[0-2]\d)\s*cm\b/i)
  return m ? parseInt(m[1], 10) : undefined
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp

/** Most common value among candidates, with how many sources agree. */
function vote(vals: number[] = []): { v: number; n: number } | undefined {
  const counts = new Map<number, number>()
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: { v: number; n: number } | undefined
  for (const [v, n] of counts) if (!best || n > best.n) best = { v, n }
  return best
}

/** Combine OCR passes into one checked reading. `profileHeightCm` is a fallback for the BMI check. */
export function resolveScan(passes: Pass[], profileHeightCm?: number): ScanResult {
  const all: Candidates = {}
  const push = (c: Candidates) => { for (const [f, vs] of Object.entries(c) as [Field, number[]][]) (all[f] ??= []).push(...vs) }
  let convertedFromLb = false, date: number | undefined, heightCm: number | undefined
  for (const p of passes) {
    push(candidatesFromWords(p))
    const t = parseInBody(p.text)
    convertedFromLb ||= t.convertedFromLb
    date ??= t.date
    heightCm ??= sheetHeight(p.text)
    // Text-line values count as candidates, but values it had to guess a decimal point for don't.
    push(Object.fromEntries(t.found.filter((f) => !t.uncertain.includes(f)).map((f) => [f, [t.values[f]!]])))
  }

  const values: InBodyValues = {}
  const status: Partial<Record<InBodyField, Status>> = {}
  const set = (f: InBodyField, v: number, s: Status) => { values[f] = round(v, FIELDS[f].dp); status[f] = s }

  // 1. Body composition table: water + protein + minerals + fat mass = weight.
  const uniq = (f: Field) => [...new Set(all[f] ?? [])]
  let composition: { tbw: number; p: number; m: number; fat: number; w: number } | undefined
  for (const w of uniq('weightKg')) for (const fat of uniq('bodyFatKg')) for (const tbw of uniq('tbwL'))
    for (const p of uniq('proteinKg')) for (const m of uniq('mineralKg')) {
      if (!composition && Math.abs(tbw + p + m + fat - w) <= 0.25) composition = { tbw, p, m, fat, w }
    }
  if (composition) {
    set('weightKg', composition.w, 'read'); set('bodyFatKg', composition.fat, 'read'); set('tbwL', composition.tbw, 'read')
  }

  // 2. Everything else: agreement between sources → read; a single source → check.
  for (const f of FIELD_ORDER) {
    if (values[f] !== undefined || f === 'bmi' || f === 'pbf' || f === 'smmKg') continue
    const b = vote(all[f])
    if (b) set(f, b.v, b.n >= 2 ? 'read' : 'check')
  }

  const weight = values.weightKg, fat = values.bodyFatKg
  // 3. Percent body fat = fat ÷ weight.
  const pbfCalc = weight && fat ? (fat / weight) * 100 : undefined
  const pbfRead = (all.pbf ?? []).find((v) => pbfCalc === undefined || Math.abs(v - pbfCalc) <= 0.3)
  if (pbfRead !== undefined && pbfCalc !== undefined) set('pbf', pbfRead, 'read')
  else if (pbfCalc !== undefined) set('pbf', pbfCalc, 'calculated')
  else if (pbfRead !== undefined) set('pbf', pbfRead, 'check')

  // 4. BMI = weight ÷ height².
  const hgt = heightCm ?? profileHeightCm
  const bmiCalc = weight && hgt ? weight / (hgt / 100) ** 2 : undefined
  const bmiRead = (all.bmi ?? []).find((v) => bmiCalc === undefined || Math.abs(v - bmiCalc) <= 0.2)
  if (bmiRead !== undefined && bmiCalc !== undefined) set('bmi', bmiRead, 'read')
  else if (bmiCalc !== undefined) set('bmi', bmiCalc, 'calculated')
  else if (bmiRead !== undefined) set('bmi', bmiRead, 'check')

  // 5. Skeletal muscle is typically 45–65% of fat-free mass; outside that, it's a misread.
  const ffm = weight && fat ? weight - fat : undefined
  const smmOk = (all.smmKg ?? []).filter((v) => !ffm || (v / ffm >= 0.45 && v / ffm <= 0.65))
  const smm = vote(smmOk)
  if (smm) set('smmKg', smm.v, smm.n >= 2 ? 'read' : 'check')

  return { values, status, date, sheetHeightCm: heightCm, convertedFromLb }
}
