import { expect, test } from '@playwright/test'
import { isMobile } from './helpers'

test('el inicio y el buscador global llevan a la guía de un país', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.locator('.home-hero h1')).toBeVisible()
  await page.locator('.search-btn').click()
  await page.locator('.palette-input input').fill('hungr')
  await expect(page.locator('.palette-item').first()).toContainText('Hungría')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/pais\/hu/)
  await expect(page.locator('.guide-name h1')).toHaveText('Hungría')
})

test('el menú lateral del móvil se abre, navega y se cierra', async ({ page }) => {
  test.skip(!isMobile(page), 'solo en el móvil')
  await page.goto('/#/pais/hu')
  await expect(page.locator('.nav')).toBeHidden()
  await page.locator('.menu-btn').click()
  await expect(page.locator('.drawer.open')).toHaveCount(1)
  await expect(page.locator('.drawer-item.on')).toContainText('Países')
  await page.locator('.drawer-item', { hasText: 'Catálogo' }).click()
  await expect(page).toHaveURL(/#\/catalogo/)
  await expect(page.locator('.drawer.open')).toHaveCount(0)
})

test('volver atrás conserva la posición de la lista', async ({ page }) => {
  await page.goto('/#/paises')
  await expect(page.locator('.country-item').first()).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 1800))
  await page.waitForTimeout(400)
  const before = await page.evaluate(() => window.scrollY)
  // un país que ya está en pantalla (sin que la prueba desplace la página)
  await page.evaluate(() => (document.elementFromPoint(200, 400)?.closest('a') as HTMLAnchorElement).click())
  await expect(page).toHaveURL(/#\/pais\//)
  await page.goBack()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 10)
})

test('ninguna vista se desborda de lado', async ({ page }) => {
  for (const h of ['#/', '#/paises', '#/pais/hu', '#/catalogo', '#/guardados', '#/entrenar', '#/explorar', '#/duelo?a=hu&b=sk', '#/buscar', '#/geografia?pais=it', '#/mapas']) {
    await page.goto('/' + h)
    await page.waitForTimeout(1500)
    const [w, sw] = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth])
    expect(sw, `ancho de ${h}`).toBeLessThanOrEqual(w)
  }
})
