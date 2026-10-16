import { describe, expect, it } from 'vitest'
import { body, cap, HPX, project, W } from './fixtures/posture'
import { hipCrop, tapToPoint } from './pelvis'
import { LM } from './pose'

describe('hip sticker tapping (ADR-023)', () => {
  const side = cap(project(body(), 'side'), { nearSide: 'left' })
  const crop = hipCrop(side)

  it('zooms into a square around the near hip, inside the photo', () => {
    const hip = side.landmarks[LM.leftHip]
    expect(crop.x).toBeLessThanOrEqual(hip.x * W)
    expect(crop.x + crop.size).toBeGreaterThanOrEqual(hip.x * W)
    expect(crop.y).toBeLessThanOrEqual(hip.y * HPX)
    expect(crop.y + crop.size).toBeGreaterThanOrEqual(hip.y * HPX)
    expect(crop.x).toBeGreaterThanOrEqual(0)
    expect(crop.x + crop.size).toBeLessThanOrEqual(W)
  })

  it('a tap in the middle of the crop lands on the crop centre', () => {
    const p = tapToPoint(0.5, 0.5, crop, false, W, HPX)
    expect(p.x * W).toBeCloseTo(crop.x + crop.size / 2)
    expect(p.y * HPX).toBeCloseTo(crop.y + crop.size / 2)
  })

  it('mirrored display: a tap on the left of the screen is the right of the raw photo', () => {
    const shownLeft = tapToPoint(0.1, 0.5, crop, true, W, HPX)
    const rawRight = tapToPoint(0.9, 0.5, crop, false, W, HPX)
    expect(shownLeft.x).toBeCloseTo(rawRight.x)
    expect(shownLeft.y).toBeCloseTo(rawRight.y)
  })

  it('a hip near the photo edge still gets a crop inside the photo', () => {
    const edge = cap(project(body(), 'side').map((l) => ({ ...l, x: l.x - 0.45 })), { nearSide: 'left' })
    const c = hipCrop(edge)
    expect(c.x).toBe(0)
    expect(c.size).toBeGreaterThan(0)
  })
})
