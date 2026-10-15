// Punto de entrada de la API: /api/geo/… (geografía) y /api/gg/… (guías).
// Lo usan el Worker (D1) y el servidor de desarrollo (node:sqlite).
import { handleGeo } from './api.js'
import { handleGuides } from './gg.js'

/**
 * @param {{ all(sql: string, params?: unknown[]): Promise<any[]>, first(sql: string, params?: unknown[]): Promise<any> }} db
 * @param {URL} url
 * @param {string} [body]  cuerpo de un POST (JSON como texto)
 */
export function handleApi(db, url, body) {
  if (url.pathname.startsWith('/api/gg/')) return handleGuides(db, url, body)
  return handleGeo(db, url)
}
