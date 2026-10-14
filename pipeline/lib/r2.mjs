// Cliente del bucket R2 (API S3). Credenciales en .env: CLOUDFLARE_ACCOUNT_ID,
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME (y R2_PREFIX opcional).

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { env } from './env.mjs'

let client = null

export function r2() {
  if (client) return client
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
  client = {
    bucket,
    prefix,
    /** Sube un objeto (clave sin prefijo). */
    put: (key, body, contentType, cacheControl = 'public, max-age=31536000, immutable') =>
      s3.send(new PutObjectCommand({ Bucket: bucket, Key: prefix + key, Body: body, ContentType: contentType, CacheControl: cacheControl })),
  }
  return client
}
