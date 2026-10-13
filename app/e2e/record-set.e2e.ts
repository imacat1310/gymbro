// Record button next to Log (ADR-022): squats in a plan or free workout can be recorded for a rep count and
// form feedback; the camera opens straight away with the set's weight carried over.
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.goto('./')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: /let's go/i }).click()
  await expect(page.getByText('Ready to train?')).toBeVisible()
})

test('a plan workout offers Record on its squat, next to Log', async ({ page }) => {
  await page.getByRole('link', { name: /build my plan/i }).click()
  await page.getByRole('button', { name: /^build plan$/i }).click()
  await page.getByRole('link', { name: 'Today' }).click()
  await page.getByRole('button', { name: /^Start .+ · ~\d+ min$/ }).click()
  await expect(page).toHaveURL(/#\/workout/)
  const squatCard = page.locator('article.entry').filter({ has: page.getByRole('button', { name: /Record this set/ }) }).first()
  await expect(squatCard).toBeVisible()
  await expect(squatCard.getByRole('button', { name: /^✓ Log/ })).toBeVisible()
  // Exercises without a form check don't get the button.
  const cards = page.locator('article.entry')
  const withRecord = await page.getByRole('button', { name: /Record this set/ }).count()
  expect(withRecord).toBeLessThan(await cards.count())
})

test('Record opens the camera straight away with the weight, and Cancel returns to the workout', async ({ page, browserName }) => {
  // Loading the pose model on CI's software WebGL is slow.
  test.setTimeout(90_000)
  await page.getByRole('button', { name: /free workout/i }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByPlaceholder(/search/i).fill('Goblet squat')
  await page.locator('.pick-item', { hasText: 'Goblet squat' }).first().click()
  const card = page.locator('article.entry', { hasText: 'Goblet squat' })
  await card.getByRole('textbox', { name: 'kg' }).fill('24')
  await card.getByRole('button', { name: /Record this set/ }).click()
  await expect(page).toHaveURL(/#\/form\/goblet_squat\?.*kg=24.*quick=1/)
  // Quick mode: no setup screen; angle and camera can be switched here.
  await expect(page.getByRole('button', { name: 'Start camera' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Front view' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Flip camera' })).toBeVisible()
  if (browserName === 'chromium') {
    // Fake camera, no person: guidance shows and Record waits until in position.
    await expect(page.locator('.hud')).toContainText(/Step into view/, { timeout: 75_000 })
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/#\/workout/)
    await expect(page.locator('article.entry', { hasText: 'Goblet squat' })).toBeVisible()
  }
})

test('a bench press in a free workout has no Record button', async ({ page }) => {
  await page.getByRole('button', { name: /free workout/i }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByPlaceholder(/search/i).fill('Bench press')
  await page.locator('.pick-item', { hasText: 'Bench press' }).first().click()
  const card = page.locator('article.entry', { hasText: 'Bench press' })
  await expect(card.getByRole('button', { name: /^✓ Log/ })).toBeVisible()
  await expect(card.getByRole('button', { name: /Record this set/ })).toHaveCount(0)
})
