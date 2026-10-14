import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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
    const m = req.url?.match(/^\/images\/((?:img|thumb)\/[0-9a-f]{2}\/[0-9a-f]{40}\.webp)/)
    if (!m) return next()
    const file = join(OWN_DIR, m[1])
    if (!existsSync(file)) {
      res.statusCode = 404
      return res.end()
    }
    res.setHeader('content-type', 'image/webp')
    res.setHeader('cache-control', 'public, max-age=31536000, immutable')
    res.end(readFileSync(file))
  }
  return {
    name: 'own-images',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  }
}

export default defineConfig({
  plugins: [react(), ownImages(), plonkitImages()],
  server: { port: 5173 },
  preview: { port: 4173 },
})
