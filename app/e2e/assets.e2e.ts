// The large self-hosted runtimes (pose, OCR) load from versioned paths, and caches left by older versions
// are deleted at startup (developer review, step 3).
import { expect, test } from '@playwright/test'

test('caches from older runtime versions are deleted at startup', async ({ page }) => {
  await page.goto('./')
  const stale = ['pose-assets', 'ocr-assets', 'pose-assets-0.9.0-00000000', 'ocr-assets-6.0.0-core6.0.0']
  await page.evaluate(async (names) => {
    for (const n of names) await (await caches.open(n)).put('/x', new Response('old'))
  }, stale)
  await page.reload()
  // Pruning runs right after startup; wait until none of the stale caches is left.
  await expect.poll(async () => (await page.evaluate(() => caches.keys())).filter((n) => stale.includes(n))).toEqual([])
})

test.describe('pose runtime', () => {
  // Only Chromium can feed a fake camera headlessly.
  test.skip(({ browserName }) => browserName !== 'chromium', 'needs a fake camera')
  // The fake camera itself is set up in playwright.config.ts (Chromium launch flags).
  test.use({ permissions: ['camera'] })

  test('loads the WASM runtime and model from versioned, self-hosted paths', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const wasm = page.waitForResponse((r) => /\/gymbro\/mediapipe\/\d+\.\d+\.\d+\/wasm\/vision_wasm_\w+\.wasm$/.test(r.url()))
    const model = page.waitForResponse((r) => /\/gymbro\/models\/pose_landmarker_\w+\.task$/.test(r.url()))
    await page.goto('./#/profile/pose')
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    expect((await wasm).status()).toBe(200)
    expect((await model).status()).toBe(200)
    // Running: the stop button replaces start once the camera and model are up.
    await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible({ timeout: 30_000 })
    expect(errors).toEqual([])
  })
})
