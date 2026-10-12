import { describe, expect, it } from 'vitest'
import type { BodyComp } from '../../db/db'
import { body, scan } from '../fixtures/posture'
import { LM } from '../pose'
import { formProfile } from './profile'

const comp = (values: BodyComp['values']): BodyComp => ({ id: 'c', measuredAt: 1, values, source: 'manual', createdAt: 1 })

describe('formProfile (body data → form check)', () => {
  it('no body data → neutral profile with the injuries passed in', () => {
    expect(formProfile({}, ['knee'])).toEqual({ femurTorso: undefined, staticValgus: false, weakLeg: undefined, limitations: ['knee'] })
  })

  it('takes thigh-to-torso ratio and a static knee-valgus finding from the posture scan', () => {
    const b = body(); b.pts[LM.leftKnee].x -= 4; b.pts[LM.rightKnee].x += 2
    const p = formProfile({ scan: scan(b) })
    expect(p.staticValgus).toBe(true)
    expect(p.femurTorso).toBeGreaterThan(0.5)
    expect(formProfile({ scan: scan(body()) }).staticValgus).toBe(false)
  })

  it('takes the weaker leg from InBody segmental lean mass', () => {
    const p = formProfile({ comp: comp({ leanLeftLeg: 9.0, leanRightLeg: 10.0 }) })
    expect(p.weakLeg).toEqual({ side: 'left', diffPct: expect.any(Number) })
    expect(p.weakLeg!.diffPct).toBeGreaterThanOrEqual(5)
  })
})
