// Variantes ligeras de las fotos propias para las galerías, a partir de cada
// miniatura (thumb, 480 px):
//   sm/ab/<sha1>.webp     240 px (cuadrículas del móvil)
//   sm/ab/<sha1>.avif     240 px en AVIF
//   thumb/ab/<sha1>.avif  480 px en AVIF (30–50 % menos que WebP)
// La app las pide con <picture> + srcset (src/components/Img.tsx): el navegador
// elige el formato y el tamaño que necesita.
//
//   npm run pipeline -- variants          genera las que falten y las sube a R2

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'
import { IMAGES_DIR } from './images.mjs'
import { r2 } from './lib/r2.mjs'

const SM = 240
const LEDGER = path.join(IMAGES_DIR, 'variants-uploaded.json')

function* thumbs() {
  const root = path.join(IMAGES_DIR, 'thumb')
  if (!existsSync(root)) return
  for (const dir of readdirSync(root)) for (const f of readdirSync(path.join(root, dir))) if (f.endsWith('.webp')) yield `${dir}/${f.slice(0, -5)}`
}

async function pool(items, n, fn) {
  const queue = [...items]
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await fn(queue.shift())
  }))
}

export async function variants({ upload = true } = {}) {
  sharp.concurrency(1)
  const all = [...thumbs()]
  const out = (kind, id, ext) => path.join(IMAGES_DIR, kind, `${id}.${ext}`)
  const todo = all.filter((id) => !existsSync(out('sm', id, 'webp')) || !existsSync(out('sm', id, 'avif')) || !existsSync(out('thumb', id, 'avif')))
  console.log(`[variants] ${all.length} miniaturas · ${todo.length} por convertir`)
  let done = 0
  const t0 = Date.now()
  await pool(todo, Math.max(2, os.cpus().length - 1), async (id) => {
    try {
      const src = readFileSync(out('thumb', id, 'webp'))
      mkdirSync(path.dirname(out('sm', id, 'webp')), { recursive: true })
      const small = sharp(src).resize({ width: SM, height: SM, fit: 'inside', withoutEnlargement: true })
      writeFileSync(out('sm', id, 'webp'), await small.clone().webp({ quality: 70 }).toBuffer())
      writeFileSync(out('sm', id, 'avif'), await small.clone().avif({ quality: 50, effort: 3 }).toBuffer())
      writeFileSync(out('thumb', id, 'avif'), await sharp(src).avif({ quality: 52, effort: 3 }).toBuffer())
    } catch (e) {
      console.warn(`[variants] ⚠ ${id}: ${e.message}`)
    }
    if (++done % 2000 === 0) console.log(`[variants] ${done}/${todo.length} · ${((Date.now() - t0) / 1000) | 0}s`)
  })
  if (!upload) return
  // subida: solo lo que no esté ya en R2
  const ledger = existsSync(LEDGER) ? new Set(JSON.parse(readFileSync(LEDGER, 'utf8'))) : new Set()
  const keys = all.flatMap((id) => [`sm/${id}.webp`, `sm/${id}.avif`, `thumb/${id}.avif`]).filter((k) => !ledger.has(k) && existsSync(path.join(IMAGES_DIR, k)))
  console.log(`[variants] ${keys.length} archivos por subir`)
  const { put } = r2()
  let up = 0
  await pool(keys, 16, async (k) => {
    try {
      await put(k, readFileSync(path.join(IMAGES_DIR, k)), k.endsWith('.avif') ? 'image/avif' : 'image/webp')
      ledger.add(k)
    } catch (e) {
      console.warn(`[variants] ⚠ subida ${k}: ${e.message}`)
    }
    if (++up % 5000 === 0) {
      writeFileSync(LEDGER, JSON.stringify([...ledger]))
      console.log(`[variants] subidas ${up}/${keys.length}`)
    }
  })
  writeFileSync(LEDGER, JSON.stringify([...ledger]))
  console.log(`[variants] ✓ ${up} subidas`)
}
