import { describe, expect, it } from 'vitest'
import { parseDate, parseInBody } from './inbody'

// Text the way OCR returns an InBody 570 sheet: sections in reading order, values on the label's line.
const SHEET_570 = `
InBody570
ID 12345 Height 178cm Age 34 Gender Male Test Date / Time 2026.03.14 08:12

Body Composition Analysis
Total Body Water (L) 45.1 (40.3~49.3)
Protein (kg) 12.2 (10.8~13.2)
Minerals (kg) 4.10 (3.73~4.55)
Body Fat Mass (kg) 14.6 (8.9~17.8)
Weight (kg) 76.0 (62.2~84.2)

Muscle-Fat Analysis
Weight 55 70 85 100 115 130 145 160 175 190 205 % 76.0 kg
SMM 70 80 90 100 110 120 130 140 150 160 170 % 35.4 kg
Body Fat Mass 40 60 80 100 160 220 280 340 400 460 520 % 14.6 kg

Obesity Analysis
BMI (Body Mass Index) 10.0 15.0 18.5 21.0 25.0 30.0 35.0 40.0 45.0 50.0 55.0 24.0
PBF (Percent Body Fat) 0.0 5.0 10.0 15.0 20.0 25.0 30.0 35.0 40.0 45.0 50.0 19.2

Segmental Lean Analysis
Right Arm 3.62 kg 106.2 %
Left Arm 3.55 kg 104.1 %
Trunk 27.4 kg 101.8 %
Right Leg 9.71 kg 99.6 %
Left Leg 9.65 kg 99.0 %

ECW/TBW Analysis
ECW/TBW 0.320 0.340 0.360 0.380 0.390 0.400 0.410 0.420 0.430 0.440 0.450 0.379

Segmental Fat Analysis
Right Arm 0.8 kg 98.5 %
Left Arm 0.8 kg 99.1 %
Trunk 7.1 kg 120.3 %

InBody Score 81/100 Points
Target Weight 74.1 kg Weight Control -1.9 kg
Basal Metabolic Rate 1734 kcal
Visceral Fat Level 6
`

describe('parseInBody: InBody 570 sheet', () => {
  const r = parseInBody(SHEET_570)

  it('reads the main values, ignoring normal ranges and bar-chart scales', () => {
    expect(r.values).toMatchObject({
      weightKg: 76, smmKg: 35.4, bodyFatKg: 14.6, pbf: 19.2, bmi: 24, tbwL: 45.1,
      bmrKcal: 1734, visceralFat: 6, score: 81,
    })
  })
  it('reads ECW/TBW from the end of its bar-chart line', () => {
    expect(r.values.ecwTbw).toBe(0.379)
  })
  it('reads segmental lean mass, not segmental fat', () => {
    expect(r.values).toMatchObject({ leanRightArm: 3.62, leanLeftArm: 3.55, leanTrunk: 27.4, leanRightLeg: 9.71, leanLeftLeg: 9.65 })
  })
  it('does not take "Target Weight" as the weight', () => {
    expect(r.values.weightKg).not.toBe(74.1)
  })
  it('lists found fields and the test date', () => {
    expect(r.found).toHaveLength(15)
    expect(new Date(r.date!).toISOString().slice(0, 10)).toBe('2026-03-14')
    expect(r.convertedFromLb).toBe(false)
  })
})

describe('parseInBody: OCR noise and partial sheets', () => {
  it('tolerates comma decimals, "Skeleta1" and missing spaces', () => {
    const r = parseInBody('Skeleta1 Muscle Mass 33,9 kg\nBodyFatMass 18.0 kg\nWeight 80.2')
    expect(r.values).toMatchObject({ smmKg: 33.9, bodyFatKg: 18, weightKg: 80.2 })
  })
  it('drops misreads outside human ranges', () => {
    const r = parseInBody('Weight 9999 kg\nPercent Body Fat 0.4 %\nVisceral Fat Level 66')
    expect(r.values).toEqual({})
    expect(r.found).toEqual([])
  })
  it('reads "762" as 76.2 (lost decimal point) and marks it uncertain', () => {
    const r = parseInBody('Weight 762 kg\nPercent Body Fat 192 %')
    expect(r.values).toEqual({ weightKg: 76.2, pbf: 19.2 })
    expect(r.uncertain).toEqual(['weightKg', 'pbf'])
  })
  it('drops body fat values that contradict each other', () => {
    const r = parseInBody('Weight 80.0\nBody Fat Mass 16.0\nPercent Body Fat 35.0')
    expect(r.values.weightKg).toBe(80)
    expect(r.values.bodyFatKg).toBeUndefined()
    expect(r.values.pbf).toBeUndefined()
  })
  it('a photo with no InBody text gives nothing', () => {
    expect(parseInBody('Grocery list: eggs 12, milk 2').found).toEqual([])
  })
})

describe('parseInBody: patterns seen in real OCR output', () => {
  // Lines as Tesseract returned them from a photographed sheet (E2E, 2026-10-11).
  const OCR = `Body Fat Mass                       40 60 80 100 160 220 280 340 400                                        I                129 kg
BMI (Body Mass Index)          100 15.0 185 21.0 250 30.0 350 40.0                             EE         22.3 kg/m?
Segmental Lean Analysis
Right Arm                          311kg                                                  104.0 %
Trunk                                 248kg                                                    100.4 %
Right Leg                             8.62 kg                                                      98.7 %
ECWITBW                  0.320 0.340 0.360 0.380 0.390 0.400 0.410 0.420                     —           0.381`
  const r = parseInBody(OCR)

  it('garbled chart ticks: reads the measurement from the end of the line', () => {
    expect(r.values.bmi).toBe(22.3)
    expect(r.values.ecwTbw).toBe(0.381)
  })
  it('dropped decimal points are recovered and marked uncertain', () => {
    expect(r.values).toMatchObject({ bodyFatKg: 12.9, leanRightArm: 3.11, leanTrunk: 24.8, leanRightLeg: 8.62 })
    expect(r.uncertain.sort()).toEqual(['bodyFatKg', 'leanRightArm', 'leanTrunk'].sort())
  })
  it('values printed with their decimals are not marked uncertain', () => {
    expect(r.uncertain).not.toContain('leanRightLeg')
    expect(r.uncertain).not.toContain('bmi')
  })
  it('whole numbers that fit as they are stay as they are', () => {
    expect(parseInBody('Weight 100').values.weightKg).toBe(100)
    expect(parseInBody('Basal Metabolic Rate 1620 kcal').uncertain).toEqual([])
  })
})

describe('parseInBody: pound sheets', () => {
  it('converts masses to kg and leaves percentages alone', () => {
    const r = parseInBody('Weight 167.6 lbs\nSkeletal Muscle Mass 78.0 lbs\nBody Fat Mass 32.2 lbs\nPBF 19.2\nRight Arm 7.98 lbs\nSegmental Lean Analysis\nRight Arm 7.98 lbs')
    expect(r.convertedFromLb).toBe(true)
    expect(r.values.weightKg).toBeCloseTo(76, 0)
    expect(r.values.smmKg).toBeCloseTo(35.4, 0)
    expect(r.values.pbf).toBe(19.2)
    expect(r.values.leanRightArm).toBeCloseTo(3.62, 1)
  })
})

describe('parseDate', () => {
  it('reads ISO-ish and day-first dates', () => {
    expect(new Date(parseDate('Test Date 2026.03.14')!).getMonth()).toBe(2)
    expect(new Date(parseDate('14/03/2026 08:12')!).getDate()).toBe(14)
  })
  it('rejects impossible and future dates', () => {
    expect(parseDate('2026.13.40')).toBeUndefined()
    expect(parseDate('2099.01.01')).toBeUndefined()
  })
})
