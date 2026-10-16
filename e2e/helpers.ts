import type { CDPSession, Page } from '@playwright/test'

/** Toques reales (varios dedos) por el protocolo del navegador: deslizar, pellizcar. */
export async function touchscreen(page: Page) {
  const cdp: CDPSession = await page.context().newCDPSession(page)
  const send = (type: string, pts: [number, number][]) =>
    cdp.send('Input.dispatchTouchEvent', { type: type as 'touchStart', touchPoints: pts.map(([x, y], id) => ({ x, y, id })) })
  return {
    tap: async (x: number, y: number) => {
      await send('touchStart', [[x, y]])
      await send('touchEnd', [])
    },
    swipe: async (x0: number, y0: number, x1: number, y1: number, steps = 10) => {
      await send('touchStart', [[x0, y0]])
      for (let k = 1; k <= steps; k++) await send('touchMove', [[x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps]])
      await send('touchEnd', [])
      await page.waitForTimeout(450)
    },
    pinch: async (cx: number, cy: number, from: number, to: number, steps = 8) => {
      await send('touchStart', [[cx - from, cy], [cx + from, cy]])
      for (let k = 1; k <= steps; k++) {
        const d = from + ((to - from) * k) / steps
        await send('touchMove', [[cx - d, cy], [cx + d, cy]])
      }
      await send('touchEnd', [])
      await page.waitForTimeout(400)
    },
  }
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1000) < 760
