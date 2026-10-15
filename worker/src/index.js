// Worker de GeoMastery: fotos y capas desde el bucket R2 privado "geoguesser"
// y la API de geografía sobre D1. Solo para quien tenga la clave (uso personal).
//
//   GET /img/ab/<sha1>.webp?k=<clave>     imagen grande (1600 px)
//   GET /thumb/ab/<sha1>.webp?k=<clave>   miniatura (480 px); también .avif
//   GET /sm/ab/<sha1>.webp?k=<clave>      miniatura pequeña (240 px, cuadrículas del móvil); también .avif
//   GET /atlas/<ruta>?k=<clave>           capas de terreno y vectores por país (R2 atlas/…)
//   GET /api/geo/…?k=<clave>              API de geografía (worker/src/geo/api.js, D1)
//   GET|POST /api/gg/…?k=<clave>          API de las guías: explorador visual y sesiones de Entrenar
//   GET /community/<ruta>?k=<clave>       guías por país, duelos, mapas… (R2 community/…, con huella en el nombre)
//
// La clave va en ?k= porque una etiqueta <img> no puede enviar cabeceras (y así
// las llamadas a la API no necesitan preflight CORS). También se acepta la
// cabecera "x-access-key". La clave es el secreto ACCESS_KEY del Worker:
// wrangler secret put ACCESS_KEY

import { handleApi } from './geo/router.js'

const IMAGE = /^\/(img|thumb|sm)\/[0-9a-f]{2}\/[0-9a-f]{40}\.(webp|avif)$/
const GEO_ASSET = /^\/(atlas|community)\/[a-z0-9_./-]+\.(webp|png|json)$/
const TYPES = { webp: 'image/webp', avif: 'image/avif', png: 'image/png', json: 'application/json' }

function same(a, b) {
  // comparación en tiempo constante
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Adaptador D1 → interfaz de los manejadores ({ all, first }). Suma las filas que
 * lee cada consulta (D1 cobra por ellas): sale en la cabecera x-d1-rows-read.
 */
const d1 = (db) => {
  const stats = { rows: 0, queries: 0 }
  const run = async (sql, params) => {
    const r = await db.prepare(sql).bind(...params).all()
    stats.rows += r.meta?.rows_read ?? 0
    stats.queries++
    return r.results
  }
  return {
    stats,
    all: (sql, params = []) => run(sql, params),
    first: async (sql, params = []) => (await run(sql, params))[0] ?? null,
  }
}

/** Respuesta en caché del borde (la clave de acceso no forma parte de la clave de caché). */
async function cached(request, url, ctx, make) {
  const params = new URLSearchParams(url.search)
  params.delete('k')
  const cacheKey = new Request(`${url.origin}${url.pathname}?${params}`, { method: 'GET' })
  const cache = caches.default
  const hit = await cache.match(cacheKey)
  if (hit) return hit
  const response = await make()
  if (request.method === 'GET' && response.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}

async function fromBucket(env, key, type, request, cacheControl = 'public, max-age=31536000, immutable') {
  const object = await env.IMAGES.get(key)
  if (!object) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('content-type', type)
  headers.set('cache-control', cacheControl)
  headers.set('access-control-allow-origin', '*')
  return new Response(request.method === 'HEAD' ? null : object.body, { headers })
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const isImage = IMAGE.test(url.pathname)
    const isAsset = GEO_ASSET.test(url.pathname) && !url.pathname.includes('..')
    const isApi = url.pathname.startsWith('/api/geo/') || url.pathname.startsWith('/api/gg/')
    // POST solo para las sesiones de Entrenar (con tu progreso: no se guarda en caché)
    const isPost = request.method === 'POST' && url.pathname === '/api/gg/quiz'
    if (request.method !== 'GET' && request.method !== 'HEAD' && !isPost) return new Response('Method not allowed', { status: 405 })
    if (!isImage && !isAsset && !isApi) return new Response('Not found', { status: 404 })

    const key = url.searchParams.get('k') ?? request.headers.get('x-access-key')
    if (!env.ACCESS_KEY || !same(key, env.ACCESS_KEY)) return new Response('Forbidden', { status: 403 })

    if (isImage || isAsset) {
      const type = TYPES[url.pathname.split('.').pop()]
      // con huella en el nombre (x.3f2a9c1b.json) no cambian nunca; el manifiesto, cada minuto
      // public: también se guarda en el borde de Cloudflare (la clave se comprueba antes de mirar la caché)
      const cache = url.pathname === '/community/manifest.json' ? 'public, max-age=60'
        : /\.[0-9a-f]{8}\.json$/.test(url.pathname) || url.searchParams.has('v') || isImage ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
      return cached(request, url, ctx, () => fromBucket(env, url.pathname.slice(1), type, request, cache))
    }

    if (!env.GEO) return Response.json({ error: 'sin base de geografía' }, { status: 503 })
    const db = d1(env.GEO)
    const usage = () => ({ 'x-d1-rows-read': String(db.stats.rows), 'x-d1-queries': String(db.stats.queries), 'access-control-expose-headers': 'x-d1-rows-read, x-d1-queries' })
    // si D1 falla (p. ej. cuota diaria agotada) se responde 503 con el motivo, sin caché,
    // en lugar de dejar que el Worker reviente (error 1101 sin CORS que la app no puede leer)
    const api = async (body) => {
      try {
        return await handleApi(db, url, body)
      } catch (e) {
        console.error(`[api] ${url.pathname}: ${e?.message ?? e}`)
        const quota = /limit|7500/i.test(String(e?.message))
        return { status: 503, body: { error: quota ? 'cuota diaria de D1 agotada' : 'error de la base de datos' } }
      }
    }
    if (isPost) {
      const { status, body } = await api(await request.text())
      return Response.json(body, { status, headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store', ...usage() } })
    }
    return cached(request, url, ctx, async () => {
      const { status, body } = await api()
      return Response.json(body, {
        status,
        headers: {
          ...usage(),
          'access-control-allow-origin': '*',
          // los datos cambian solo al publicar: una hora en el navegador y en el borde (compartida:
          // dos personas que piden lo mismo leen D1 una sola vez)
          // con ?v=<versión de la base> la respuesta no cambia nunca (la versión cambia al publicar)
          'cache-control': status !== 200 ? 'no-store' : url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
        },
      })
    })
  },
}
