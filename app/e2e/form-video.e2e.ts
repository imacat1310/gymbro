// Form check from a camera-roll video (ADR-022). A real video with a person isn't committed (licensing, size):
// set FORM_VIDEO=/path/to/video to run the full analysis locally; the broken-file case runs everywhere.
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

test('a file that is not a readable video gets a clear message', async ({ page }) => {
  const bad = join(tmpdir(), 'gymbro-not-a-video.mp4')
  writeFileSync(bad, 'this is not a video')
  await page.goto('./#/form/barbell_back_squat')
  await page.locator('input[type=file][accept="video/*"]').setInputFiles(bad)
  await expect(page.getByRole('heading', { name: /Couldn.t read the video/ })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: 'Start camera' })).toBeVisible()
})

test('a real video is analysed frame by frame into a report', async ({ page }) => {
  test.skip(!process.env.FORM_VIDEO, 'set FORM_VIDEO to a local video of a squat')
  test.setTimeout(240_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('./#/form/barbell_back_squat')
  await page.getByRole('button', { name: 'Side view' }).click()
  await page.locator('input[type=file][accept="video/*"]').setInputFiles(process.env.FORM_VIDEO!)
  await expect(page.getByText(/frame \d+ of \d+/)).toBeVisible({ timeout: 60_000 })
  // Either a scored report or a clear "no reps / not visible" result, never a hang or crash.
  await expect(page.locator('.form-score, h2:has-text("No reps found"), h2:has-text("see you clearly")').first()).toBeVisible({ timeout: 200_000 })
  console.log('RESULT', (await page.locator('main').textContent())?.replace(/\s+/g, ' ').slice(0, 400))
  expect(errors).toEqual([])
})
