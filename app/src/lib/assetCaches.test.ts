import { describe, expect, it } from 'vitest'
import { outdatedCaches } from './assetCaches'

describe('outdatedCaches', () => {
  const current = ['pose-assets-1.1.0-ab12cd34', 'ocr-assets-7.0.0-core7.0.0']

  it('removes the unversioned caches from before v0.25 and older versions', () => {
    const names = ['pose-assets', 'ocr-assets', 'pose-assets-1.0.0-ab12cd34', 'pose-assets-1.1.0-00000000', ...current]
    expect(outdatedCaches(names, current)).toEqual(['pose-assets', 'ocr-assets', 'pose-assets-1.0.0-ab12cd34', 'pose-assets-1.1.0-00000000'])
  })

  it('leaves the current caches and caches that are not ours (e.g. the app precache)', () => {
    const names = ['workbox-precache-v2-https://x/', 'pose-assetsX', ...current]
    expect(outdatedCaches(names, current)).toEqual([])
  })
})
