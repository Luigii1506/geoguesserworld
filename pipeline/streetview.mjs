// Street View de cada ejemplo: los enlaces de Google Maps de las pistas
// (goo.gl/maps/…, maps.app.goo.gl/…) llevan a la panorámica exacta con el
// ángulo de cámara que eligió su autor. Se resuelven una vez y se guarda
// panorámica, coordenadas y vista para incrustar Street View en la app (lo
// que Google permite) en lugar de copiar capturas.
//
//   npm run pipeline -- streetview      (gratis; luego `export`)

import { tx, now } from './lib/db.mjs'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function ensureStreetViewTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS hint_sv (
    url TEXT PRIMARY KEY,           -- enlace original
    pano TEXT, lat REAL, lng REAL,  -- panorámica y su posición
    heading REAL, pitch REAL, fov REAL,
    status TEXT NOT NULL,           -- ok | none
    fetched_at TEXT NOT NULL
  )`)
}

/** Datos de vista a partir de una URL completa de Google Maps (de las dos formas que usa). */
export function parseMapsUrl(url) {
  try {
    const u = new URL(url)
    const q = u.searchParams
    if (q.get('map_action') === 'pano' || q.get('viewpoint')) {
      const [lat, lng] = (q.get('viewpoint') ?? '').split(',').map(Number)
      return { pano: q.get('pano'), lat, lng, heading: Number(q.get('heading') ?? 0), pitch: Number(q.get('pitch') ?? 0), fov: Number(q.get('fov') ?? 80) }
    }
    // /maps/@lat,lng,3a,75y,90h,88t/data=!3m6!1e1!3m4!1s<pano>!2e0…
    const m = u.pathname.match(/@(-?[\d.]+),(-?[\d.]+),(?:[\d.]+a,)?([\d.]+)y,([\d.]+)h,([\d.]+)t/)
    if (m) {
      const pano = decodeURIComponent(url).match(/!1s([^!]+)!2e/)?.[1] ?? null
      return { pano, lat: Number(m[1]), lng: Number(m[2]), fov: Number(m[3]), heading: Number(m[4]), pitch: Number(m[5]) - 90 }
    }
    const p = u.pathname.match(/@(-?[\d.]+),(-?[\d.]+)/)
    if (p) return { pano: null, lat: Number(p[1]), lng: Number(p[2]), heading: 0, pitch: 0, fov: 80 }
  } catch {
    /* URL inválida */
  }
  return null
}

async function resolve(url) {
  let current = url
  for (let hop = 0; hop < 5; hop++) {
    const direct = parseMapsUrl(current)
    if (direct && (direct.pano || !/goo\.gl/.test(current))) return direct
    let res = null
    for (let attempt = 0; attempt < 3 && !res; attempt++) {
      res = await fetch(current, { redirect: 'manual', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15_000) }).catch(() => null)
      if (res?.status === 429) {
        await sleep(20_000 * (attempt + 1))
        res = null
      }
    }
    const next = res?.headers.get('location')
    if (!next) return parseMapsUrl(current)
    current = new URL(next, current).toString()
  }
  return parseMapsUrl(current)
}

export async function streetview(db, { limit = Infinity, concurrency = 6 } = {}) {
  ensureStreetViewTable(db)
  const urls = db
    .prepare(
      `SELECT DISTINCT location_url u FROM hints
       WHERE location_url IS NOT NULL AND location_url LIKE 'http%' AND location_url NOT IN (SELECT url FROM hint_sv)`,
    )
    .all()
    .map((r) => r.u)
    .slice(0, limit)
  console.log(`[streetview] ${urls.length} enlaces por resolver`)
  const save = db.prepare(`INSERT OR REPLACE INTO hint_sv (url, pano, lat, lng, heading, pitch, fov, status, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  let done = 0
  let ok = 0
  const queue = [...urls]
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const url = queue.shift()
        const v = await resolve(url).catch(() => null)
        const good = v && Number.isFinite(v.lat) && Number.isFinite(v.lng)
        tx(db, () =>
          save.run(url, good ? v.pano : null, good ? v.lat : null, good ? v.lng : null, good ? v.heading : null, good ? v.pitch : null, good ? v.fov : null, good ? 'ok' : 'none', now()),
        )
        if (good) ok++
        if (++done % 500 === 0) console.log(`[streetview] ${done}/${urls.length} · ${ok} con vista`)
        await sleep(120)
      }
    }),
  )
  console.log(`[streetview] ✓ ${ok} de ${urls.length} con vista de Street View`)
}
