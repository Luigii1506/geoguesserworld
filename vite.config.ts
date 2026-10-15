import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { GeoDb } from './worker/src/geo/api.js'
import { handleApi } from './worker/src/geo/router.js'

// Las imágenes de plonkit.net tienen protección anti-hotlink (403 sin su
// propio Referer), así que el servidor local las pide con ese header. Cada
// imagen se guarda en data/img-cache (fuera de git, uso personal) la primera
// vez: así una guía con decenas de fotos no dispara el límite (429) de
// Plonk It. Las descargas van de dos en dos y se reintentan con espera.
const CACHE = join(process.cwd(), 'data/img-cache')
const HEADERS = {
  referer: 'https://www.plonkit.net/',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
}
const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' }

let active = 0
const queue: (() => void)[] = []
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((r) => queue.push(r))
  active++
  try {
    return await fn()
  } finally {
    active--
    queue.shift()?.()
  }
}

async function download(path: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://www.plonkit.net${path}`, { headers: HEADERS })
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    if (res.status !== 429 && res.status < 500) return null
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
  }
  return null
}

function plonkitImages(): Plugin {
  const handler = async (req: { url?: string }, res: import('node:http').ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/pi-img/')) return next()
    const path = decodeURIComponent(req.url.slice('/pi-img'.length).split('?')[0])
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    const file = join(CACHE, createHash('sha1').update(path).digest('hex') + '.' + ext)
    let body: Buffer | null = existsSync(file) ? readFileSync(file) : null
    if (!body) {
      body = await slot(() => download(path))
      if (body) {
        mkdirSync(CACHE, { recursive: true })
        writeFileSync(file, body)
      }
    }
    if (!body) {
      res.statusCode = 502
      return res.end()
    }
    res.setHeader('content-type', TYPES[ext] ?? 'application/octet-stream')
    res.setHeader('cache-control', 'public, max-age=604800')
    res.end(body)
  }
  return {
    name: 'plonkit-images',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  }
}

// Copia propia (etapa images del pipeline): /images/img|thumb/ab/<sha1>.webp → data/images
const OWN_DIR = join(process.cwd(), 'data/images')
function ownImages(): Plugin {
  const handler = (req: { url?: string }, res: import('node:http').ServerResponse, next: () => void) => {
    const m = req.url?.match(/^\/images\/((?:img|thumb|sm)\/[0-9a-f]{2}\/[0-9a-f]{40}\.(?:webp|avif))/)
    if (!m) return next()
    const file = join(OWN_DIR, m[1])
    if (!existsSync(file)) {
      res.statusCode = 404
      return res.end()
    }
    res.setHeader('content-type', file.endsWith('.avif') ? 'image/avif' : 'image/webp')
    res.setHeader('cache-control', 'public, max-age=31536000, immutable')
    res.end(readFileSync(file))
  }
  return {
    name: 'own-images',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  }
}

// API de geografía en desarrollo: los mismos manejadores que el Worker, sobre
// data/geo.db (se reabre si el pipeline la reconstruye) y las capas de
// data/geo-assets servidas en /atlas/… (en producción, R2 vía el Worker).
const GEO_DB = join(process.cwd(), 'data/geo.db')
const GEO_ASSETS = join(process.cwd(), 'data/geo-assets')
const ASSET_TYPES: Record<string, string> = { webp: 'image/webp', png: 'image/png', json: 'application/json' }
function geoApi(): Plugin {
  let db: DatabaseSync | null = null
  let opened = 0
  const adapter: GeoDb = {
    all: async (sql, params = []) => conn().prepare(sql).all(...(params as never[])) as Record<string, unknown>[],
    first: async (sql, params = []) => (conn().prepare(sql).get(...(params as never[])) as Record<string, unknown>) ?? null,
  }
  function conn() {
    const mtime = statSync(GEO_DB).mtimeMs
    if (!db || mtime !== opened) {
      db?.close()
      db = new DatabaseSync(GEO_DB, { readOnly: true })
      opened = mtime
    }
    return db
  }
  const handler = async (req: { url?: string }, res: import('node:http').ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname.startsWith('/atlas/')) {
      const file = normalize(join(GEO_ASSETS, url.pathname))
      if (!file.startsWith(GEO_ASSETS) || !existsSync(file)) {
        res.statusCode = 404
        return res.end()
      }
      res.setHeader('content-type', ASSET_TYPES[file.split('.').pop() ?? ''] ?? 'application/octet-stream')
      res.setHeader('cache-control', 'no-cache')
      return res.end(readFileSync(file))
    }
    if (!url.pathname.startsWith('/api/geo') && !url.pathname.startsWith('/api/gg')) return next()
    if (!existsSync(GEO_DB)) {
      res.statusCode = 503
      res.setHeader('content-type', 'application/json')
      return res.end(JSON.stringify({ error: 'falta data/geo.db: npm run pipeline -- geo build' }))
    }
    try {
      // cuerpo de los POST (sesiones de Entrenar)
      const body = (req as { method?: string }).method === 'POST'
        ? await new Promise<string>((ok) => {
            let data = ''
            ;(req as unknown as NodeJS.ReadableStream).on('data', (c: Buffer) => (data += c))
            ;(req as unknown as NodeJS.ReadableStream).on('end', () => ok(data))
          })
        : undefined
      const { status, body: out } = await handleApi(adapter, url, body)
      res.statusCode = status
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(out))
    } catch (e) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: (e as Error).message }))
    }
  }
  return {
    name: 'geo-api',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  }
}

// PWA: la app (JS, CSS, fuentes) queda precacheada y abre al instante, también sin red.
// Los datos se guardan al usarlos, según cómo cambian:
//   · con huella o versión (API ?v=, capas ?v=, community/<ruta>.<hash>.json): cache-first,
//     nunca cambian; una publicación nueva trae otras URLs
//   · community/manifest.json y la API sin versión: red primero, caché si no hay red
//   · Entrenar (POST) no pasa por la caché
// Las imágenes (<img> de otro origen, respuestas opacas) se quedan en la caché HTTP del
// navegador, que ya las guarda un año: en la del service worker ocuparían ~7 MB cada una.
const path = (url: URL) => url.pathname
const versioned = (url: URL) => url.searchParams.has('v')
const days = (n: number) => n * 86400
const pwa = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
  manifest: {
    name: 'GeoMastery',
    short_name: 'GeoMastery',
    description: 'Academia personal de reconocimiento geográfico para GeoGuessr',
    lang: 'es',
    start_url: '.',
    scope: '.',
    display: 'standalone',
    theme_color: '#1f6b55',
    background_color: '#f7f6f2',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
    // el mapa a 50 m (750 KB) solo se pide al hacer zoom: se guarda la primera vez que se usa
    globIgnores: ['community/**', 'images/**', 'assets/countries-50m-*.js'],
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: ({ url, sameOrigin }) => sameOrigin && path(url).startsWith('/assets/'),
        handler: 'CacheFirst',
        options: { cacheName: 'assets', expiration: { maxEntries: 20 }, cacheableResponse: { statuses: [200] } },
      },
      {
        urlPattern: ({ url, request }) => request.method === 'GET' && path(url).startsWith('/api/') && versioned(url),
        handler: 'CacheFirst',
        options: { cacheName: 'api', expiration: { maxEntries: 800, maxAgeSeconds: days(60) }, cacheableResponse: { statuses: [200] } },
      },
      {
        urlPattern: ({ url, request }) => request.method === 'GET' && path(url).startsWith('/api/'),
        handler: 'NetworkFirst',
        options: { cacheName: 'api-live', networkTimeoutSeconds: 4, expiration: { maxEntries: 200, maxAgeSeconds: days(7) }, cacheableResponse: { statuses: [200] } },
      },
      {
        urlPattern: ({ url }) => path(url).endsWith('/community/manifest.json'),
        handler: 'NetworkFirst',
        options: { cacheName: 'community-manifest', networkTimeoutSeconds: 3, cacheableResponse: { statuses: [200] } },
      },
      {
        urlPattern: ({ url }) => path(url).startsWith('/community/'),
        handler: 'CacheFirst',
        options: { cacheName: 'community', expiration: { maxEntries: 400, maxAgeSeconds: days(60) }, cacheableResponse: { statuses: [200] } },
      },
      {
        urlPattern: ({ url }) => path(url).startsWith('/atlas/') && path(url).endsWith('.json') && versioned(url),
        handler: 'CacheFirst',
        options: { cacheName: 'atlas', expiration: { maxEntries: 300, maxAgeSeconds: days(60) }, cacheableResponse: { statuses: [200] } },
      },
    ],
  },
})

export default defineConfig({
  plugins: [react(), ownImages(), plonkitImages(), geoApi(), pwa],
  server: { port: 5173 },
  preview: { port: 4173 },
})
