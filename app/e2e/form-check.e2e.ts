// Form check (ADR-022): entry point from the workout, setup, camera guidance. The analysis itself is unit-tested
// with synthetic sets (a fake camera can't show a person squatting).
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.goto('./')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: /let's go/i }).click()
  // Wait for onboarding's own redirect to Today, so it can't override the test's next navigation.
  await expect(page.getByText('Ready to train?')).toBeVisible()
})

test('a squat in the workout links to its form check, with personalisation info', async ({ page }) => {
  await page.getByRole('button', { name: /free workout/i }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByPlaceholder(/search/i).fill('Goblet squat')
  await page.locator('.pick-item', { hasText: 'Goblet squat' }).first().click()
  await page.getByRole('link', { name: 'Check form' }).click()
  await expect(page).toHaveURL(/#\/form\/goblet_squat\?session=/)
  await expect(page.getByRole('heading', { name: 'Form check' })).toBeVisible()
  await expect(page.getByText(/No body data yet/)).toBeVisible()
  await page.getByRole('button', { name: 'Front view' }).click()
  await expect(page.getByText(/Knees tracking/)).toBeVisible()
})

test.describe('camera', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'needs a fake camera')
  test.use({ permissions: ['camera'] })

  test('guides the user into position and only allows recording when ready', async ({ page }) => {
    // Loading the pose model on CI's software WebGL is slow.
    test.setTimeout(90_000)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('./#/form/barbell_back_squat')
    await page.getByRole('button', { name: 'Start camera' }).click()
    // The fake camera shows no person: the hint asks them to step in, and Record stays disabled.
    await expect(page.locator('.hud')).toContainText(/Step into view/, { timeout: 75_000 })
    await expect(page.getByRole('button', { name: 'Get in position' })).toBeDisabled()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Start camera' })).toBeVisible()
    expect(errors).toEqual([])
  })
})

test('exercises without a form check say so', async ({ page }) => {
  await page.goto('./#/form/barbell_bench_press')
  await expect(page.getByText(/No form check for this exercise yet/)).toBeVisible()
})
