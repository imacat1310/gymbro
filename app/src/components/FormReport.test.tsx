// Renders the report from real analyses of synthetic sets, so the screen can't crash on any report shape.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { squatRecording } from '../lib/fixtures/squat'
import { analyzeSquat } from '../lib/form/squat'
import { EMPTY_PROFILE } from '../lib/form/types'
import { ReportView } from './FormReport'

const render = (report: ReturnType<typeof analyzeSquat>) =>
  renderToStaticMarkup(<ReportView report={report} recording={null} onAgain={() => {}} onDone={() => {}} />)

describe('form report screen', () => {
  it('a clean side-view set: score, praise, rep table', () => {
    const html = render(analyzeSquat(squatRecording({ view: 'side', reps: 3 }), EMPTY_PROFILE))
    expect(html).toContain('100')
    expect(html).toContain('Solid set: 3 reps')
    expect(html).toContain('Depth')
    expect(html).not.toContain('What we saw')
  })

  it('faults, a personal reason and the safety hold', () => {
    const rec = squatRecording({ view: 'side', reps: 3, leanDeg: 66, femurTorso: 1.1, depthDeg: -20 })
    const html = render(analyzeSquat(rec, { ...EMPTY_PROFILE, femurTorso: 1.1, limitations: ['lower_back'] }))
    expect(html).toContain('What we saw')
    expect(html).toContain('Torso lean')
    expect(html).toContain('Why for you?')
    expect(html).toContain('Next time: keep this weight')
    expect(html).toContain('Personal settings')
  })

  it('front view shows knee and hip columns', () => {
    const html = render(analyzeSquat(squatRecording({ view: 'front', reps: 2, caveDeg: { left: 15, right: 0 } }), EMPTY_PROFILE))
    expect(html).toContain('Knee in L / R')
    expect(html).toContain('Knees moving in')
  })

  it('explains what to change when nothing usable was recorded', () => {
    expect(render(analyzeSquat(squatRecording({ view: 'side', visibility: 0.2 }), EMPTY_PROFILE))).toMatch(/Couldn(&#x27;|')t see you clearly/)
    expect(render(analyzeSquat(squatRecording({ view: 'side', reps: 0, standSec: 3 }), EMPTY_PROFILE))).toContain('No reps found')
  })
})
