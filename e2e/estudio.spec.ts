import { expect, test } from '@playwright/test'

test('guardar lo esencial de un país, verlo en Guardados y repasar uno', async ({ page }) => {
  await page.goto('/#/guardados')
  await expect(page.locator('.study-empty h2')).toContainText('Aún no has guardado nada')
  await page.goto('/#/pais/hu')
  await page.locator('button', { hasText: 'Estudiar lo esencial' }).click()
  await expect(page.locator('.study-all-done')).toContainText('añadidas')
  await page.goto('/#/guardados')
  await expect(page.locator('.saved-card').first()).toBeVisible()
  expect(await page.locator('.saved-card').count()).toBeGreaterThan(5)
  await page.locator('.saved-card').first().click()
  await expect(page.locator('.saved-sheet')).toBeVisible()
  await page.locator('.saved-sheet textarea').fill('mi nota')
  await page.locator('.saved-sheet button', { hasText: 'Repasar solo esto' }).click()
  await expect(page.locator('.question')).toBeVisible()
})

test('Entrenar explica sus tres formas de practicar', async ({ page }) => {
  await page.goto('/#/entrenar')
  await expect(page.locator('.train-choice h2')).toHaveText(['Repasar lo guardado', 'Práctica libre', 'Examen de un país'])
  await page.locator('.train-choice a', { hasText: 'Empezar' }).click()
  await expect(page.locator('h1')).toHaveText('Práctica libre')
  await expect(page.locator('.back-link')).toBeVisible()
})

test('una sesión de repaso avanza con el teclado y guarda las respuestas', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 760, 'atajos de teclado: en escritorio')
  await page.goto('/#/pais/hu')
  await page.locator('button', { hasText: 'Estudiar lo esencial' }).click()
  await page.goto('/#/entrenar')
  await page.locator('.train-choice-main .btn-primary').click()
  await expect(page.locator('.question')).toBeVisible()
  const first = await page.locator('.study .num').textContent()
  await page.keyboard.press('1')
  await page.locator('.feedback').waitFor()
  await page.keyboard.press('Space')
  await expect(page.locator('.study .num')).not.toHaveText(first ?? '')
})
