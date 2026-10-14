// Sube a R2 las imágenes propias (data/images) que aún no estén subidas.
// Claves del bucket: img/ab/<sha1>.webp y thumb/ab/<sha1>.webp (más R2_PREFIX
// si se define). Credenciales en .env: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME. El bucket es privado.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { env } from './lib/env.mjs'
import { now } from './lib/db.mjs'
import { IMAGES_DIR, ensureImageTable, imagePath } from './images.mjs'

const CONCURRENCY = 12

export async function upload(db, { limit = Infinity } = {}) {
  ensureImageTable(db)
  const need = ['CLOUDFLARE_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME']
  const missing = need.filter((k) => !env(k))
  if (missing.length) throw new Error(`Faltan en .env: ${missing.join(', ')}`)

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
    // <cuenta>.r2…/bucket/clave: un solo nombre de host (con el subdominio del bucket el DNS fallaba a ratos)
    forcePathStyle: true,
    maxAttempts: 6,
  })
  const bucket = env('R2_BUCKET_NAME')
  const prefix = env('R2_PREFIX') ? env('R2_PREFIX').replace(/\/?$/, '/') : ''

  const hashes = db
    .prepare(`SELECT hash FROM image_files WHERE status = 'ok' GROUP BY hash HAVING MAX(uploaded_at IS NULL) = 1`)
    .all()
    .map((r) => r.hash)
    .slice(0, limit)
  const mark = db.prepare(`UPDATE image_files SET uploaded_at = ? WHERE hash = ?`)
  console.log(`[upload] ${hashes.length} imágenes (×2 tamaños) → r2://${bucket}/${prefix}`)

  const t0 = Date.now()
  let done = 0
  let failed = 0
  let bytes = 0
  const queue = [...hashes]
  async function worker() {
    while (queue.length) {
      const hash = queue.shift()
      try {
        for (const size of ['img', 'thumb']) {
          const key = imagePath(hash, size)
          const body = readFileSync(path.join(IMAGES_DIR, key))
          bytes += body.length
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: prefix + key,
              Body: body,
              ContentType: 'image/webp',
              CacheControl: 'public, max-age=31536000, immutable',
            }),
          )
        }
        mark.run(now(), hash)
      } catch (e) {
        failed++
        if (failed <= 5) console.warn(`[upload] ${hash}: ${e.name} ${e.message}`)
      }
      if (++done % 500 === 0) console.log(`[upload] ${done}/${hashes.length} · ${(bytes / 1e6).toFixed(0)} MB`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`[upload] ✓ ${done - failed} subidas · ${failed} fallidas · ${(bytes / 1e9).toFixed(2)} GB en ${((Date.now() - t0) / 60000).toFixed(1)} min`)
}
