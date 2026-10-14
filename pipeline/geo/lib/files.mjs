// Descargas grandes con caché en data/raw/<fuente>/ (se escriben por streaming,
// a un .part que se renombra al terminar) y descompresión de .zip.

import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync, readdirSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { RAW_DIR } from '../../lib/paths.mjs'

export const UA = 'GeoMastery/0.1 (personal geography study app; https://github.com/Luigii1506/geoguesserworld)'

export const rawDir = (sourceId) => {
  const dir = path.join(RAW_DIR, sourceId)
  mkdirSync(dir, { recursive: true })
  return dir
}

const mb = (n) => `${(n / 1e6).toFixed(0)} MB`

/**
 * Descarga una URL a data/raw/<fuente>/<nombre> si no está ya.
 * @returns {Promise<string>} ruta local
 */
export async function download(sourceId, url, name = path.basename(new URL(url).pathname), { refresh = false, headers = {} } = {}) {
  const file = path.join(rawDir(sourceId), name)
  if (!refresh && existsSync(file)) return file
  const part = `${file}.part`
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, ...headers }, redirect: 'follow' })
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
      const total = Number(res.headers.get('content-length')) || 0
      console.log(`[${sourceId}] descargando ${name}${total ? ` (${mb(total)})` : ''}…`)
      await pipeline(Readable.fromWeb(res.body), createWriteStream(part))
      renameSync(part, file)
      console.log(`[${sourceId}] ✓ ${name} · ${mb(statSync(file).size)}`)
      return file
    } catch (e) {
      rmSync(part, { force: true })
      if (attempt >= 3) throw e
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)))
    }
  }
}

/** Descomprime un .zip en una carpeta hermana (una sola vez) y devuelve la carpeta. */
export function unzip(zipFile, { only } = {}) {
  const dir = zipFile.replace(/\.zip$/i, '')
  if (existsSync(dir) && readdirSync(dir).length) return dir
  mkdirSync(dir, { recursive: true })
  execFileSync('unzip', ['-o', '-q', zipFile, ...(only ?? []), '-d', dir], { stdio: 'inherit', maxBuffer: 1 << 26 })
  return dir
}

/** Busca archivos por extensión dentro de una carpeta (recursivo). */
export function findFiles(dir, re) {
  const out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...findFiles(p, re))
    else if (re.test(e.name)) out.push(p)
  }
  return out
}
