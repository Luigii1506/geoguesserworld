// Punto de entrada de la API: /api/geo/… (geografía) y /api/gg/… (guías).
// Lo usan el Worker (D1) y el servidor de desarrollo (node:sqlite).
//
// Las respuestas que no dependen de quién pregunta (ficha de cada país, meta,
// facetas de fotos…) se precalculan al construir la base (api_cache): servirlas
// lee una fila. D1 cobra por filas leídas. Ver pipeline/geo/facets.mjs.
import { handleGeo } from './api.js'
import { handleGuides } from './gg.js'

/** Ruta de caché de una petición (sin /api/), o null si lleva parámetros (la clave k y t no cuentan). */
export function cachePath(url) {
  for (const [k] of url.searchParams) if (k !== 'k' && k !== 't') return null
  return url.pathname.replace(/^\/api\//, '')
}

/** La respuesta calculada al momento, sin mirar la caché (la usa el precálculo). */
export function computeApi(db, url, body) {
  if (url.pathname.startsWith('/api/gg/')) return handleGuides(db, url, body)
  return handleGeo(db, url)
}

/**
 * @param {{ all(sql: string, params?: unknown[]): Promise<any[]>, first(sql: string, params?: unknown[]): Promise<any> }} db
 * @param {URL} url
 * @param {string} [body]  cuerpo de un POST (JSON como texto)
 */
export async function handleApi(db, url, body) {
  const key = body === undefined ? cachePath(url) : null
  if (key) {
    const row = await db.first('SELECT body FROM api_cache WHERE path = ?', [key]).catch(() => null)
    if (row) return { status: 200, body: JSON.parse(row.body) }
  }
  return computeApi(db, url, body)
}
