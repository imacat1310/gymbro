// Form check → tracker (ADR-022): a "keep this weight" check holds the next increase, and counted reps fill the
// next set. The camera can't be driven here, so the test injects what a form check produces: a saved report,
// or the navigation the report's "Fill in N reps" button makes. Injected data is written straight to IndexedDB,
// so the page reloads afterwards: Dexie caches query results and only sees writes made through it.
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await page.goto('./')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: /let's go/i }).click()
  await expect(page.getByText('Ready to train?')).toBeVisible()
})

async function freeWorkoutWith(page: Page, name: string) {
  await page.getByRole('button', { name: /free workout/i }).click()
  await page.getByRole('button', { name: '+ Add exercise' }).click()
  await page.getByPlaceholder(/search/i).fill(name)
  await page.locator('.pick-item', { hasText: name }).first().click()
  // The card appears once the exercise is saved; tests read the database after this.
  await expect(page.locator('article.entry', { hasText: name })).toBeVisible()
}

const idb = <T,>(page: Page, fn: string, arg?: unknown) => page.evaluate(({ fn, arg }) => new Promise<T>((resolve, reject) => {
  const req = indexedDB.open('gymbro')
  req.onerror = () => reject(req.error)
  req.onsuccess = () => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function('db', 'arg', 'resolve', fn) as (db: IDBDatabase, arg: unknown, resolve: (v: T) => void) => void
    run(req.result, arg, resolve)
  }
}), { fn, arg })

test('a form check that said "keep this weight" holds back the next increase', async ({ page }) => {
  await freeWorkoutWith(page, 'Goblet squat')
  const card = page.locator('article.entry').first()
  await card.getByRole('textbox', { name: 'kg' }).fill('20')
  for (let i = 0; i < 6 && !(await card.getByText(/All \d+ sets done/).isVisible()); i++) {
    await card.getByRole('button', { name: /^✓ Log/ }).click()
    await page.getByRole('button', { name: 'Skip' }).click()
  }
  // The form check recorded in this workout flagged knee cave and said to keep the weight.
  await idb(page, `
    const tx = db.transaction('formChecks', 'readwrite')
    tx.objectStore('formChecks').put({ id: 'fc1', takenAt: Date.now(), exerciseId: 'goblet_squat', appVersion: 'test',
      report: { exerciseId: 'goblet_squat', view: 'front', reps: [], score: 52, tips: [], notMeasured: [], personal: [],
        blockIncrease: 'Form score 52 is below 60', faults: [{ code: 'knee_cave', severity: 'moderate', reps: [3, 4], value: 15, unit: '°', tip: 'Push your knees out' }] } })
    tx.oncomplete = () => resolve(true)`)
  await page.reload()
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page).toHaveURL(/#\/session\//)
  // The summary's "Next time" applies the same hold.
  await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Next time' }) })).toContainText(/held back/)

  await page.getByRole('link', { name: 'Today' }).click()
  await freeWorkoutWith(page, 'Goblet squat')
  const suggestion = page.locator('article.entry').first().locator('.suggestion')
  await expect(suggestion).toContainText(/held back/)
  await expect(suggestion).toContainText(/scored 52\/100 \(knees moving in\)/)
  await expect(page.locator('article.entry').first().getByRole('textbox', { name: 'kg' })).toHaveValue('20')
})

test('reps counted by a form check fill the next set', async ({ page }) => {
  await freeWorkoutWith(page, 'Goblet squat')
  const entryKey = await idb<string>(page, `
    const req = db.transaction('sessions').objectStore('sessions').getAll()
    req.onsuccess = () => resolve(req.result.find((s) => !s.endedAt).entries[0].key)`)
  // What "Fill in 7 reps" does: back to the workout with the count in the navigation state (router state lives
  // in history.state.usr; a reload makes the router read it).
  await page.evaluate((entryKey) => {
    history.replaceState({ usr: { formReps: { entryKey, reps: 7 } }, key: 'formcheck', idx: 0 }, '', '#/workout')
  }, entryKey)
  await page.reload()
  const card = page.locator('article.entry').first()
  await expect(card.getByText('7 reps counted by your form check')).toBeVisible()
  await expect(card.getByRole('textbox', { name: 'reps' })).toHaveValue('7')
  await card.getByRole('textbox', { name: 'kg' }).fill('16')
  await card.getByRole('button', { name: /^✓ Log/ }).click()
  await expect(card.getByText('16 kg × 7')).toBeVisible()
  await expect(card.getByText('reps counted by your form check')).toHaveCount(0)
})
