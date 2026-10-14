// Worker de imágenes de GeoMastery: sirve el bucket R2 privado "geoguesser"
// solo a quien tenga la clave (uso personal, sin acceso público).
//
//   GET /img/ab/<sha1>.webp?k=<clave>     imagen grande (1600 px)
//   GET /thumb/ab/<sha1>.webp?k=<clave>   miniatura (480 px)
//
// La clave va en ?k= porque una etiqueta <img> no puede enviar cabeceras.
// También se acepta la cabecera "x-access-key". La clave es el secreto
// ACCESS_KEY del Worker: wrangler secret put ACCESS_KEY

const PATH = /^\/(img|thumb)\/[0-9a-f]{2}\/[0-9a-f]{40}\.webp$/

function same(a, b) {
  // comparación en tiempo constante
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })
    if (!PATH.test(url.pathname)) return new Response('Not found', { status: 404 })

    const key = url.searchParams.get('k') ?? request.headers.get('x-access-key')
    if (!env.ACCESS_KEY || !same(key, env.ACCESS_KEY)) return new Response('Forbidden', { status: 403 })

    // caché del borde: la clave no forma parte de la clave de caché
    const cache = caches.default
    const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: 'GET' })
    const hit = await cache.match(cacheKey)
    if (hit) return hit

    const object = await env.IMAGES.get(url.pathname.slice(1))
    if (!object) return new Response('Not found', { status: 404 })

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('content-type', 'image/webp')
    // privada: el navegador la guarda, pero ningún proxy compartido
    headers.set('cache-control', 'private, max-age=31536000, immutable')
    headers.set('access-control-allow-origin', '*')
    const response = new Response(request.method === 'HEAD' ? null : object.body, { headers })
    if (request.method === 'GET') await cache.put(cacheKey, response.clone())
    return response
  },
}
