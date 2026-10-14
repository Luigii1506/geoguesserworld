// Descargas con caché en crudo (capa 1). Cada URL se guarda una vez en
// data/raw/<fuente>/ y se reutiliza: re-procesar no vuelve a descargar salvo
// con --refresh. Rate-limit por host y reintentos ante 429/5xx.

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { RAW_DIR } from './paths.mjs'
import { now } from './db.mjs'

export const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const lastHit = new Map()

function cachePath(sourceId, url) {
  const u = new URL(url)
  const slug = (u.hostname + u.pathname + u.search)
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .slice(0, 90)
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 10)
  return path.join(RAW_DIR, sourceId, `${slug}__${hash}`)
}

/**
 * Descarga (o lee de caché) una URL y devuelve su cuerpo como texto.
 * @param {object} ctx  contexto de ejecución: { db, sourceId, refresh, log }
 * @param {string} url
 * @param {object} [opts] { headers, minIntervalMs, accept404 }
 */
export async function fetchText(ctx, url, opts = {}) {
  const file = cachePath(ctx.sourceId, url)
  if (!ctx.refresh && existsSync(file)) {
    return readFileSync(file, 'utf8')
  }

  const host = new URL(url).host
  const minInterval = opts.minIntervalMs ?? 1200
  const wait = (lastHit.get(host) ?? 0) + minInterval - Date.now()
  if (wait > 0) await sleep(wait)

  let res
  for (let attempt = 0; attempt < 5; attempt++) {
    lastHit.set(host, Date.now())
    try {
      res = await fetch(url, {
        headers: { 'user-agent': BROWSER_UA, ...(opts.headers ?? {}) },
        redirect: 'follow',
      })
    } catch (e) {
      if (attempt === 4) throw e
      await sleep(3000 * (attempt + 1))
      continue
    }
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get('retry-after')) || 0
      await sleep(Math.max(retryAfter * 1000, 8000 * (attempt + 1)))
      continue
    }
    break
  }

  if (!res.ok) {
    if (opts.accept404 && res.status === 404) return null
    throw new Error(`HTTP ${res.status} en ${url}`)
  }

  const body = await res.text()
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, body)
  ctx.db
    .prepare(
      `INSERT INTO documents (url, source_id, path, status, bytes, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET path=excluded.path, status=excluded.status,
         bytes=excluded.bytes, fetched_at=excluded.fetched_at`,
    )
    .run(url, ctx.sourceId, path.relative(RAW_DIR, file), res.status, body.length, now())
  return body
}

export async function fetchJson(ctx, url, opts = {}) {
  const text = await fetchText(ctx, url, {
    ...opts,
    headers: { accept: 'application/json', ...(opts.headers ?? {}) },
  })
  return text === null ? null : JSON.parse(text)
}
