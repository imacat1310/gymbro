import { describe, expect, it } from 'vitest'
import { candidatesFromWords, deskew, mergeFragments, numberOf, resolveScan, sheetHeight, type Pass, type Word } from './inbodyScan'

// A synthetic two-column InBody-270-style page (made-up values; no real person's data), 1000×1400 px.
const W = 1000, H = 1400
const word = (text: string, x: number, y: number, hgt = 12): Word => ({ text, x0: x, y0: y, x1: x + text.length * 0.55 * hgt, y1: y + hgt, conf: 90 })
/** Words of a phrase laid out left to right from x. */
function phrase(text: string, x: number, y: number, hgt = 12): Word[] {
  const out: Word[] = []
  let cx = x
  for (const t of text.split(' ')) { const w = word(t, cx, y, hgt); out.push(w); cx = w.x1 + 0.45 * hgt }
  return out
}

function page270(over: Partial<Record<string, Word[]>> = {}): Word[] {
  const L = 80, V = 480, R = 730 // label column, value column, right column
  const parts: Record<string, Word[]> = {
    header: [...phrase('Height', 260, 120), ...phrase('168cm', 260, 140), ...phrase('03. 04. 2026 07:15', 500, 140)],
    tbw: [...phrase('Total amount of water Total Body Water (L)', L, 240), word('41.0', V, 240), word('(36.1~44.1)', 540, 240)],
    protein: [...phrase('Protein (kg)', 300, 270), word('11.1', V, 270), word('(9.7~11.9)', 540, 270)],
    mineral: [...phrase('Mineral (kg)', 300, 300), word('3.80', V, 300), word('(3.35~4.10)', 540, 300)],
    fat: [...phrase('Where my excess energy is stored Body', L, 330), ...phrase('Fat Mass', 330, 326, 16), word('(kg)', 430, 330), word('14.1', V, 330), word('(', 540, 330), word('7.6~15.2)', 552, 330),
      ...phrase('Weight Control -2.0kg', R, 333)],
    weight: [...phrase('Sum of the above Weight (kg)', L, 360), word('70.0', V, 360), word('(53.9~72.9)', 540, 360),
      ...phrase('Target Weight 68.0kg', R, 360)],
    // Right column header above the fat row, slightly higher: the old row grouping split "Fat Mass" here.
    score: [...phrase('InBody Score', R, 250), word('8', R + 20, 280, 26), word('2,', R + 40, 280, 26), ...phrase('/100 Points', R + 70, 290)],
    chartWeight: [...['55', '70', '85', '100', '115', '130', '145'].map((t, i) => word(t, 250 + i * 40, 462, 7)), ...phrase('Weight (kg)', L, 470), word('70.', 400, 472), word('0', 427, 472)],
    chartSmm: [...['70', '80', '90', '100', '110', '120'].map((t, i) => word(t, 250 + i * 40, 502, 7)), ...phrase('SMM (kg)', L, 510), word('31.4', 420, 512)],
    bmi: [...['10.0', '15.0', '18.5', '22.0', '25.0', '30.0'].map((t, i) => word(t, 250 + i * 45, 662, 9)), ...phrase('BMI (kg/m2)', L, 670), word('24.8', 400, 672)],
    research: [...phrase('Research Parameters', R, 680), ...phrase('Basal Metabolic Rate 1615 kcal (1590~1860)', R, 700, 11)],
    visceral: [...phrase('Visceral Fat Level', R, 600), ...phrase('Low 10 High', R + 150, 615, 9), ...phrase('Level 7', R + 30, 632)],
    segHeads: [...phrase('Segmental Lean Analysis', L, 830, 14), ...phrase('Segmental Fat Analysis', 410, 830, 14)],
    // Body outline: arms top left/right, trunk centre, legs bottom left/right; each kg value above its %.
    seg: [word('3.20kg', 110, 880), word('107.5%', 110, 900), word('3.10kg', 250, 880), word('106.8%', 250, 900),
      word('24.6kg', 185, 950), word('103.2%', 185, 970),
      word('9.40kg', 110, 1030), word('110.6%', 110, 1050), word('9.50kg', 250, 1030), word('111.2%', 250, 1050),
      word('0.8kg', 450, 880), word('8.3kg', 520, 950)],
    history: [...phrase('Body Composition History', L, 1180, 14), ...phrase('Weight (kg) 72.4 71.8 71.1 70.6', L, 1210)],
  }
  return Object.entries({ ...parts, ...over }).flatMap(([, ws]) => ws ?? [])
}
const pass = (words: Word[], text = ''): Pass => ({ text: text || words.map((w) => w.text).join(' '), words, width: W, height: H })

describe('building blocks', () => {
  it('numberOf strips units and rejects reference ranges', () => {
    expect(numberOf('14.1')).toEqual({ v: 14.1, decimal: true })
    expect(numberOf('3.20kg')).toEqual({ v: 3.2, decimal: true })
    expect(numberOf('121%')).toEqual({ v: 121, decimal: false })
    expect(numberOf('(37.4')).toBeNull()
    expect(numberOf('45.8)')).toBeNull()
    expect(numberOf('8.0~16.0)')).toBeNull()
  })
  it('mergeFragments joins numbers OCR split in two', () => {
    const m = mergeFragments([word('70.', 400, 472), word('0', 427, 472), word('kg', 460, 472)])
    expect(m.map((w) => w.text)).toEqual(['70.0', 'kg'])
  })
  it('sheetHeight reads the header', () => expect(sheetHeight('Height 168cm Age 41')).toBe(168))
})

describe('candidatesFromWords: InBody 270 layout', () => {
  const c = candidatesFromWords(pass(page270()))
  it('table values beside their labels, not the right column or ranges', () => {
    expect(c.tbwL).toContain(41)
    expect(c.bodyFatKg).toContain(14.1)
    expect(c.proteinKg).toContain(11.1)
    expect(c.mineralKg).toContain(3.8)
    expect(c.weightKg).toContain(70)
  })
  it('"Target Weight" and the history rows are ignored', () => {
    expect(c.weightKg).not.toContain(68)
    expect(c.weightKg).not.toContain(72.4)
  })
  it('chart rows: the value, not the scale ticks', () => {
    expect(c.smmKg).toEqual([31.4])
    expect(c.bmi).toEqual([24.8])
  })
  it('score digits split in two are joined', () => expect(c.score).toEqual([82]))
  it('visceral level from "Level 7", not the "Low 10 High" scale', () => expect(c.visceralFat).toEqual([7]))
  it('BMR in the right column', () => expect(c.bmrKcal).toEqual([1615]))
  it('segmental figure by position, kg not %, lean figure not fat figure', () => {
    expect(c).toMatchObject({ leanLeftArm: [3.2], leanRightArm: [3.1], leanTrunk: [24.6], leanLeftLeg: [9.4], leanRightLeg: [9.5] })
  })
})

describe('resolveScan', () => {
  it('confirms the table with water + protein + minerals + fat = weight, and derives PBF', () => {
    const r = resolveScan([pass(page270())])
    expect(r.values).toMatchObject({ weightKg: 70, bodyFatKg: 14.1, tbwL: 41 })
    expect(r.status).toMatchObject({ weightKg: 'read', bodyFatKg: 'read', tbwL: 'read' })
    expect(r.values.pbf).toBeCloseTo(20.1, 1)
    expect(r.status.pbf).toBe('calculated')
  })
  it('a misread fat value loses to the one that makes the sum work', () => {
    const bad = page270({ chartFat: [...phrase('Body Fat Mass (kg)', 80, 550), word('5,', 400, 552)] })
    const r = resolveScan([pass(bad)])
    expect(r.values.bodyFatKg).toBe(14.1)
  })
  it('BMI read from the chart is confirmed against weight and the printed height', () => {
    const r = resolveScan([pass(page270())])
    expect(r.sheetHeightCm).toBe(168)
    expect(r.values.bmi).toBe(24.8)
    expect(r.status.bmi).toBe('read')
  })
  it('BMI is calculated when the chart value is unreadable, from the profile height if the sheet has none', () => {
    const r = resolveScan([pass(page270({ bmi: [], header: [] }), 'no height here')], 180)
    expect(r.values.bmi).toBeCloseTo(21.6, 1)
    expect(r.status.bmi).toBe('calculated')
  })
  it('a skeletal-muscle reading far outside 45–65% of fat-free mass is rejected', () => {
    const r = resolveScan([pass(page270({ chartSmm: [...phrase('SMM (kg)', 80, 510), word('21.9', 420, 512)] }))])
    expect(r.values.smmKg).toBeUndefined()
  })
  it('agreement across passes → "read"; a single source → "check"', () => {
    const one = resolveScan([pass(page270())])
    expect(one.status.leanTrunk).toBe('check')
    const two = resolveScan([pass(page270()), pass(page270())])
    expect(two.status.leanTrunk).toBe('read')
  })
  it('reads the date with OCR spaces', () => {
    const r = resolveScan([pass(page270(), 'Test Date 03. 04. 2026 07:15 Height 168cm')])
    expect(new Date(r.date!).getDate()).toBe(3)
  })
})

describe('tilted photos and labelled tables', () => {
  it('deskew lines up a label and a far-right value on a 1.5° tilted page', () => {
    const t = Math.tan((1.5 * Math.PI) / 180)
    const tilt = (w: Word): Word => { const dy = ((w.x0 + w.x1) / 2 - W / 2) * t; return { ...w, y0: w.y0 + dy, y1: w.y1 + dy } }
    // Weight's value sits 30 px above SMM's label row once tilted: without deskewing, SMM would take 68.4.
    const ws = [...phrase('Weight (kg)', 80, 470), word('68.4', 820, 470), ...phrase('SMM (kg)', 80, 500), word('31.2', 820, 500)].map(tilt)
    const tilted: Pass = { text: '', words: ws, width: W, height: H, skew: Math.atan(t) }
    expect(candidatesFromWords(tilted).smmKg).toEqual([31.2])
    expect(deskew(ws, Math.atan(t), W)[0].y0).toBeCloseTo(470, 0)
  })
  it('InBody 570-style segmental table: values beside "Right Arm" etc., lean before fat', () => {
    const rows = ['Right Arm 3.11 kg', 'Left Arm 3.05 kg', 'Trunk 24.8 kg', 'Right Leg 8.62 kg', 'Left Leg 8.55 kg']
    const lean = rows.flatMap((r, i) => phrase(r, 80, 900 + i * 25))
    const fat = [...phrase('Segmental Fat Analysis', 80, 1050, 14), ...phrase('Right Arm 0.7 kg', 80, 1080), ...phrase('Trunk 6.2 kg', 80, 1105)]
    // No readable "Segmental Lean" header (white on a dark bar): the first occurrences are used.
    const c = candidatesFromWords(pass([...lean, ...fat]))
    expect(c).toMatchObject({ leanRightArm: [3.11], leanLeftArm: [3.05], leanTrunk: [24.8], leanRightLeg: [8.62], leanLeftLeg: [8.55] })
  })
})
