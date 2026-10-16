import { expect, test } from '@playwright/test'

test('el catálogo filtra por rasgo y la ficha muestra textos en español', async ({ page }) => {
  await page.goto('/#/catalogo')
  await expect(page.locator('.cat-tile').first()).toBeVisible()
  const all = await page.locator('.cat-tile').count()
  const toggle = page.locator('.cat-facets-toggle')
  if (await toggle.count()) await toggle.click()
  await page.locator('.cat-facet').first().locator('.chip').first().click()
  await expect.poll(() => page.locator('.cat-tile').count()).toBeLessThan(all)
  await page.locator('.cat-tile').first().click()
  await expect(page.locator('.cat-version').first()).toBeVisible()
  await expect(page.locator('.cat-version-text .hint-text').first()).toBeVisible()
})
