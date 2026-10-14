// Copia propia de todas las imágenes de las pistas.
//
// Cada imagen se descarga una vez, se identifica por el hash de su contenido
// (la misma foto subida por varias fuentes se guarda una sola vez) y se
// convierte a WebP en dos tamaños:
//   data/images/img/ab/<sha1>.webp     hasta 1600 px, para el visor
//   data/images/thumb/ab/<sha1>.webp   hasta 480 px, para galerías
// La tabla image_files guarda URL original → hash, medidas y estado. Se puede
// interrumpir y reanudar: lo ya descargado no se repite. Uso personal.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { DATA_DIR } from './lib/paths.mjs'
import { now } from './lib/db.mjs'

export const IMAGES_DIR = path.join(DATA_DIR, 'images')
const FULL = 1600
const THUMB = 480
const MAX_ATTEMPTS = 3

// por servidor: descargas simultáneas y pausa entre peticiones de cada hilo
const HOSTS = {
  // Plonk It bloquea ~26 min (429) las peticiones que llegan a su servidor, pero no las
  // que sirve la caché de Cloudflare: se pide la versión /images/resize/1920/80/…, que la
  // web usa y está casi siempre en caché (WebP de 1920 px, más que nuestros 1600)
  // si una no está en caché y da 429 no se espera: se prueban otros tamaños y, si
  // tampoco, se deja para otra pasada (--retry) y se sigue con las demás
  'www.plonkit.net': { concurrency: 4, pauseMs: 150, referer: 'https://www.plonkit.net/', skipOn429: true },
  'learnablemeta.com': { concurrency: 4, pauseMs: 150 },
  'geotips.net': { concurrency: 3, pauseMs: 200 },
  default: { concurrency: 3, pauseMs: 200 },
}
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'

export const imagePath = (hash, size = 'img') => `${size}/${hash.slice(0, 2)}/${hash}.webp`

export function ensureImageTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS image_files (
    url          TEXT PRIMARY KEY,
    source_id    TEXT,
    hash         TEXT,               -- sha1 del archivo original
    width        INTEGER,            -- medidas de la versión grande
    height       INTEGER,
    bytes        INTEGER,            -- peso de la versión grande
    orig_bytes   INTEGER,
    status       TEXT NOT NULL,      -- ok | failed
    error        TEXT,
    attempts     INTEGER NOT NULL DEFAULT 0,
    fetched_at   TEXT,
    uploaded_at  TEXT
  )`)
  db.exec('CREATE INDEX IF NOT EXISTS image_files_hash ON image_files(hash)')
}

// Plonk It (www o espejos como de.plonkit.net/images/resize/800/80/…) → ruta de la imagen
const plonkitPath = (url) => url.match(/^https:\/\/[a-z]+\.plonkit\.net\/images\/(?:resize\/\d+\/\d+\/)?(.+)$/)?.[1]

// URL que se descarga: en Plonk It, la versión redimensionada en caché y, si no existe, el original
function downloadUrls(url) {
  const p = plonkitPath(url)
  if (!p) return [url]
  const resizable = /\.(png|jpe?g|webp)$/i.test(p)
  const sizes = resizable ? [1920, 1200, 800].map((w) => `https://www.plonkit.net/images/resize/${w}/80/${p}`) : []
  return [...sizes, `https://www.plonkit.net/images/${p}`]
}
const canonicalUrl = (url) => downloadUrls(url).at(-1)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function download(original, host) {
  const urls = downloadUrls(original)
  for (const [i, url] of urls.entries()) {
    try {
      return await fetchOne(url, host)
    } catch (e) {
      // esa variante no existe (404) o no está en caché y hay bloqueo (429): la siguiente
      if (i < urls.length - 1 && /^HTTP (40[34]|429)/.test(e.message)) continue
      throw e
    }
  }
}

async function fetchOne(url, host) {
  const cfg = HOSTS[host] ?? HOSTS.default
  let last = ''
  const attempts = cfg.attempts ?? 5
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, ...(cfg.referer ? { referer: cfg.referer } : {}) },
        signal: AbortSignal.timeout(45_000),
      })
      if (res.ok) return Buffer.from(await res.arrayBuffer())
      last = `HTTP ${res.status}`
      if (res.status === 429 && cfg.skipOn429) throw new Error('HTTP 429')
      const retryAfter = Number(res.headers.get('retry-after'))
      if (res.status === 429 && retryAfter > 0) {
        if (retryAfter > 60) console.log(`[images] ${host}: bloqueado, espero ${Math.ceil(retryAfter / 60)} min`)
        await sleep(Math.min(retryAfter + 5, cfg.maxWaitS ?? 300) * 1000)
        continue
      }
      if (res.status !== 429 && res.status < 500) throw new Error(last)
    } catch (e) {
      if (/^HTTP 4/.test(e.message) && (!/429/.test(e.message) || cfg.skipOn429)) throw e
      last = e.message
    }
    await sleep(5000 * 2 ** attempt) // 5 s, 10 s, 20 s…
  }
  throw new Error(last)
}

async function convert(buf, hash) {
  const full = path.join(IMAGES_DIR, imagePath(hash))
  const thumb = path.join(IMAGES_DIR, imagePath(hash, 'thumb'))
  const base = () => sharp(buf, { failOn: 'none', animated: false, limitInputPixels: false }).rotate()
  const big = await base().resize({ width: FULL, height: FULL, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true })
  const small = await base().resize({ width: THUMB, height: THUMB, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer()
  mkdirSync(path.dirname(full), { recursive: true })
  mkdirSync(path.dirname(thumb), { recursive: true })
  writeFileSync(full, big.data)
  writeFileSync(thumb, small)
  return { width: big.info.width, height: big.info.height, bytes: big.data.length }
}

export async function images(db, { limit = Infinity, retry = false, sources, slow = false } = {}) {
  ensureImageTable(db)
  // --slow: para las que no están en ninguna caché de Plonk It; se respeta su bloqueo y se va de una en una
  if (slow) Object.assign(HOSTS['www.plonkit.net'], { concurrency: 1, pauseMs: 6000, skipOn429: false, attempts: 6, maxWaitS: 1800 })
  let pending = db
    .prepare(
      `SELECT i.url, MIN(h.source_id) AS source_id
       FROM hint_images i JOIN hints h ON h.id = i.hint_id
       LEFT JOIN image_files f ON f.url = i.url
       WHERE i.url LIKE 'http%'
         AND (f.url IS NULL OR (f.status = 'failed' AND (? OR f.attempts < ?)))
       GROUP BY i.url`,
    )
    .all(retry ? 1 : 0, MAX_ATTEMPTS)
  if (sources?.length) pending = pending.filter((p) => sources.includes(p.source_id))
  pending = pending.slice(0, limit)

  const known = db.prepare(`SELECT width, height, bytes FROM image_files WHERE hash = ? AND status = 'ok' LIMIT 1`)
  const saveOk = db.prepare(`INSERT INTO image_files (url, source_id, hash, width, height, bytes, orig_bytes, status, error, attempts, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ok', NULL, 1, ?)
    ON CONFLICT(url) DO UPDATE SET hash=excluded.hash, width=excluded.width, height=excluded.height, bytes=excluded.bytes,
      orig_bytes=excluded.orig_bytes, status='ok', error=NULL, attempts=image_files.attempts + 1, fetched_at=excluded.fetched_at`)
  const saveFail = db.prepare(`INSERT INTO image_files (url, source_id, status, error, attempts, fetched_at)
    VALUES (?, ?, 'failed', ?, 1, ?)
    ON CONFLICT(url) DO UPDATE SET status='failed', error=excluded.error, attempts=image_files.attempts + 1, fetched_at=excluded.fetched_at`)

  const byHost = new Map()
  for (const p of pending) {
    let host
    try {
      host = new URL(canonicalUrl(p.url)).host
    } catch {
      continue
    }
    if (!byHost.has(host)) byHost.set(host, [])
    byHost.get(host).push(p)
  }
  console.log(`[images] ${pending.length} por descargar en ${byHost.size} servidores → ${IMAGES_DIR}`)

  const stats = { ok: 0, reused: 0, failed: 0, origBytes: 0, bytes: 0 }
  const t0 = Date.now()
  let done = 0
  let stop = false
  const onInt = () => {
    stop = true
    console.log('\n[images] parando tras las descargas en curso…')
  }
  process.once('SIGINT', onInt)

  const progress = () => {
    if (++done % 250 && done !== pending.length) return
    const rate = done / ((Date.now() - t0) / 1000)
    const eta = (pending.length - done) / rate
    console.log(
      `[images] ${done}/${pending.length} · ${stats.ok} nuevas · ${stats.reused} repetidas · ${stats.failed} fallidas · ` +
        `${(stats.origBytes / 1e6).toFixed(0)} MB → ${(stats.bytes / 1e6).toFixed(0)} MB · faltan ~${Math.ceil(eta / 60)} min`,
    )
  }

  async function worker(host, queue) {
    const cfg = HOSTS[host] ?? HOSTS.default
    while (queue.length && !stop) {
      const p = queue.shift()
      try {
        const buf = await download(p.url, host)
        const hash = createHash('sha1').update(buf).digest('hex')
        const prev = existsSync(path.join(IMAGES_DIR, imagePath(hash))) ? known.get(hash) : null
        const meta = prev ?? (await convert(buf, hash))
        saveOk.run(p.url, p.source_id, hash, meta.width, meta.height, meta.bytes, buf.length, now())
        if (prev) stats.reused++
        else {
          stats.ok++
          stats.origBytes += buf.length
          stats.bytes += meta.bytes
        }
      } catch (e) {
        saveFail.run(p.url, p.source_id, String(e.message).slice(0, 200), now())
        stats.failed++
      }
      progress()
      await sleep(cfg.pauseMs)
    }
  }

  await Promise.all(
    [...byHost.entries()].flatMap(([host, queue]) =>
      Array.from({ length: (HOSTS[host] ?? HOSTS.default).concurrency }, () => worker(host, queue)),
    ),
  )
  process.off('SIGINT', onInt)

  const total = db.prepare(`SELECT status, COUNT(*) n, SUM(bytes) b FROM image_files GROUP BY status`).all()
  console.log(
    `[images] ✓ ${stats.ok} nuevas · ${stats.reused} repetidas · ${stats.failed} fallidas en ${((Date.now() - t0) / 60000).toFixed(1)} min · ` +
      `total: ${total.map((t) => `${t.status} ${t.n}${t.b ? ` (${(t.b / 1e9).toFixed(2)} GB)` : ''}`).join(' · ')}`,
  )
}
