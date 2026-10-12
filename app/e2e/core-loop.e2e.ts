// The core loop, end to end: onboarding → build a plan → train the next day → finish →
// the plan rotates → the next workout suggests more weight → beating it is a personal record.
import { expect, test, type Locator, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Confirm dialogs (finish workout, etc.) are part of the flow: accept them.
  page.on('dialog', (d) => void d.accept())
})

// Read DOM text (textContent), not innerText: the theme uppercases labels with CSS.

/** Fail on any uncaught page error or console error. */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  return errors
}

async function onboard(page: Page) {
  await page.goto('./')
  await expect(page).toHaveURL(/#\/welcome/)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: /let's go/i }).click()
  await expect(page).not.toHaveURL(/welcome/)
}

/** "3 × 6–10 reps @ RPE 7.5 · rest 2.5 min" → { sets: 3, repMax: 10 } */
async function readTarget(card: Locator) {
  const text = (await card.getByText(/\d+ × \d+–\d+ reps/).first().textContent()) ?? ''
  const [, sets, , repMax] = text.match(/(\d+) × (\d+)–(\d+)/)!
  return { sets: Number(sets), repMax: Number(repMax) }
}

async function logButton(card: Locator) {
  return card.getByRole('button', { name: /^✓ Log/ })
}

test('plan → workout → progression → personal record', async ({ page }) => {
  const errors = watchErrors(page)
  await onboard(page)

  // Build the default plan (3 days, commercial gym).
  await page.getByRole('link', { name: /build my plan/i }).click()
  await page.getByRole('button', { name: /^build plan$/i }).click()
  await expect(page.getByRole('button', { name: /^start$/i }).first()).toBeVisible()

  // Today offers the first plan day.
  await page.getByRole('link', { name: 'Today' }).click()
  const startDay = page.getByRole('button', { name: /^Start .+ · ~\d+ min$/ })
  await expect(startDay).toBeVisible()
  const firstDay = ((await startDay.textContent()) ?? '').match(/^Start (.+?) ·/)![1]
  await startDay.click()
  await expect(page).toHaveURL(/#\/workout/)

  // First exercise: first time, so the user picks a weight. Type it and log straight away
  // (regression: on iPhone the typed value used to be lost if the field hadn't blurred).
  const card = page.locator('article.entry').first()
  const exerciseName = ((await card.locator('h3').textContent()) ?? '').trim()
  await expect(card.getByText(/first time/i)).toBeVisible()
  const { sets, repMax } = await readTarget(card)
  await card.getByRole('textbox', { name: 'kg' }).fill('60')
  for (let i = 0; i < sets; i++) {
    const log = await logButton(card)
    // First Log: a script click keeps focus in the kg field, like an iPhone tap on a button,
    // so the typed value must already be saved without a blur.
    if (i === 0) await log.evaluate((b: HTMLElement) => b.click())
    else await log.click()
    // Rest starts after each working set; skip it to keep going.
    await page.getByRole('button', { name: 'Skip' }).click()
  }
  await expect(card.getByText(new RegExp(`All ${sets} sets done`))).toBeVisible()
  await expect(card.getByText(`60 kg × ${repMax}`)).toHaveCount(sets)

  // Finish → summary suggests more weight next time.
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page).toHaveURL(/#\/session\//)
  const nextTime = page.locator('section', { has: page.getByRole('heading', { name: 'Next time' }) })
  await expect(nextTime).toContainText(exerciseName)
  await expect(nextTime).toContainText(/\+\d+(\.\d+)? kg/)

  // The plan rotates to its next day.
  await page.getByRole('link', { name: 'Today' }).click()
  const nextStart = page.getByRole('button', { name: /^Start .+ · ~\d+ min$/ })
  await expect(nextStart).toBeVisible()
  expect(((await nextStart.textContent()) ?? '').match(/^Start (.+?) ·/)![1]).not.toBe(firstDay)

  // Free workout with the same exercise: the suggestion is heavier than 60 kg.
  await page.getByRole('button', { name: /free workout/i }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByPlaceholder(/search/i).fill(exerciseName)
  await page.locator('.pick-item', { hasText: exerciseName }).first().click()
  const card2 = page.locator('article.entry').first()
  const suggestion = card2.locator('.suggestion')
  await expect(suggestion).toContainText(/You hit/)
  const suggestedKg = Number(((await suggestion.textContent()) ?? '').match(/([\d.]+) kg ×/)![1])
  expect(suggestedKg).toBeGreaterThan(60)
  await expect(card2.getByRole('textbox', { name: 'kg' })).toHaveValue(String(suggestedKg))

  // Lift it: heaviest weight so far is a personal record.
  await (await logButton(card2)).click()
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page).toHaveURL(/#\/session\//)
  const prs = page.locator('section', { has: page.getByRole('heading', { name: /personal records/i }) })
  await expect(prs).toContainText(exerciseName)
  await expect(prs).toContainText(`${suggestedKg} kg`)

  // History lists both workouts.
  await page.getByRole('link', { name: 'History' }).click()
  await expect(page.locator('a.list-card[href*="session"]')).toHaveCount(2)

  expect(errors).toEqual([])
})

test('a double tap on Start makes one workout', async ({ page }) => {
  await onboard(page)
  await page.getByRole('button', { name: /free workout/i }).dblclick()
  await expect(page).toHaveURL(/#\/workout/)
  const active = await page.evaluate(() => new Promise<number>((resolve) => {
    const req = indexedDB.open('gymbro')
    req.onsuccess = () => {
      const all = req.result.transaction('sessions').objectStore('sessions').getAll()
      all.onsuccess = () => resolve(all.result.filter((s: { endedAt?: number }) => !s.endedAt).length)
    }
  }))
  expect(active).toBe(1)
})
