import { expect, test } from '@playwright/test'
import { isMobile, touchscreen } from './helpers'

test.describe('gestos táctiles', () => {
  test.beforeEach(({ page }) => test.skip(!isMobile(page), 'gestos: en el móvil'))

  test('el visor de fotos: deslizar, doble toque, pellizco y deslizar abajo para cerrar', async ({ page }) => {
    const t = await touchscreen(page)
    await page.goto('/#/explorar')
    await page.locator('.photo-grid .shot').first().click()
    await expect(page.locator('.lbx-count')).toHaveText(/^1 \//)
    await t.swipe(320, 420, 60, 430)
    await expect(page.locator('.lbx-count')).toHaveText(/^2 \//)
    await t.swipe(60, 420, 330, 425)
    await expect(page.locator('.lbx-count')).toHaveText(/^1 \//)
    const zoom = () => page.locator('.lbx-track .lbx-img[style*="scale"]').evaluate((el) => Number((el as HTMLElement).style.transform.match(/scale\(([\d.]+)\)/)?.[1]))
    await t.tap(200, 420)
    await page.waitForTimeout(80)
    await t.tap(200, 420)
    await expect.poll(zoom).toBeGreaterThan(2)
    await t.tap(200, 420)
    await page.waitForTimeout(80)
    await t.tap(200, 420)
    await expect.poll(zoom).toBe(1)
    await t.pinch(200, 420, 25, 105)
    await expect.poll(zoom).toBeGreaterThan(2)
    await t.tap(200, 420)
    await page.waitForTimeout(80)
    await t.tap(200, 420)
    await t.swipe(200, 300, 205, 650)
    await expect(page.locator('.lbx')).toHaveCount(0)
  })

  test('las fichas se cierran arrastrándolas hacia abajo', async ({ page }) => {
    const t = await touchscreen(page)
    await page.goto('/#/catalogo')
    await page.locator('.cat-tile').first().click()
    const head = page.locator('.cat-detail .pm-head')
    await expect(head).toBeVisible()
    await page.waitForTimeout(400)
    const box = (await head.boundingBox())!
    await t.swipe(box.x + box.width / 2, box.y + 14, box.x + box.width / 2, box.y + 74)
    await expect(page.locator('.cat-detail')).toHaveCount(1)
    await t.swipe(box.x + box.width / 2, box.y + 14, box.x + box.width / 2, box.y + 300)
    await expect(page.locator('.cat-detail')).toHaveCount(0)
  })
})
