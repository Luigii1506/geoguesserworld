// Vegetación y usos del suelo: ESA WorldCover 2021 v200 (10 m, CC BY 4.0),
// leído en remoto del bucket público de AWS (Cloud Optimized GeoTIFF). Solo
// se descargan las vistas reducidas que hacen falta:
//   · rejilla global de 1/30° (moda) para los repartos por país y región
//   · cada país, a la resolución de su imagen

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { WORK } from '../lib/dirs.mjs'
import { gdal, readGrid, warp } from '../lib/gdal.mjs'
import { GRIDS, tally, toGrid, zones } from './grid.mjs'
import { hex, paletteRgba, warpToFrame, writeLayerImage } from './render.mjs'
import { toShares } from './relief.mjs'

const source = {
  id: 'worldcover',
  name: 'ESA WorldCover 2021',
  url: 'https://esa-worldcover.org',
  license: 'CC BY 4.0',
  attribution: '© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium',
  version: 'v200',
}

const BUCKET = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com'
const PREFIX = 'v200/2021/map/'

export const CLASSES = [
  { value: 10, key: 'bosque', label: 'Bosque', color: '#2e6b34' },
  { value: 20, key: 'matorral', label: 'Matorral', color: '#c8a24c' },
  { value: 30, key: 'pastizal', label: 'Pastizal y pradera', color: '#d9d77e' },
  { value: 40, key: 'cultivo', label: 'Cultivos', color: '#e58fc9' },
  { value: 50, key: 'urbano', label: 'Ciudades', color: '#d9342b' },
  { value: 60, key: 'desnudo', label: 'Desierto y suelo desnudo', color: '#d8cdb8' },
  { value: 70, key: 'nieve', label: 'Nieve y hielo', color: '#f4f7fb' },
  { value: 80, key: 'agua', label: 'Agua', color: '#3f7fc1' },
  { value: 90, key: 'humedal', label: 'Humedal', color: '#3aa6a0' },
  { value: 95, key: 'manglar', label: 'Manglar', color: '#11a36a' },
  { value: 100, key: 'tundra', label: 'Musgo y líquenes (tundra)', color: '#e9dcae' },
]

const env = { AWS_NO_SIGN_REQUEST: 'YES', AWS_REGION: 'eu-central-1' }
for (const [k, v] of Object.entries(env)) process.env[k] ??= v

/** Lista de teselas (3° × 3°) del bucket, guardada una vez. */
async function tiles() {
  const file = path.join(WORK, 'worldcover', 'tiles.json')
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const keys = []
  let token = null
  do {
    const q = new URLSearchParams({ 'list-type': '2', prefix: PREFIX, 'max-keys': '1000', ...(token ? { 'continuation-token': token } : {}) })
    const xml = await (await fetch(`${BUCKET}/?${q}`)).text()
    keys.push(...[...xml.matchAll(/<Key>([^<]+_Map\.tif)<\/Key>/g)].map((m) => m[1]))
    token = xml.match(/<NextContinuationToken>([^<]+)</)?.[1] ?? null
  } while (token)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(keys))
  return keys
}

/** Teselas remotas (3° × 3°, nombradas por su esquina suroeste) que tocan una caja. */
async function tilesIn([w, s, e, n]) {
  return (await tiles())
    .filter((k) => {
      const m = path.basename(k).match(/_([NS])(\d{2})([EW])(\d{3})_Map/)
      const lat = (m[1] === 'N' ? 1 : -1) * Number(m[2])
      const lon = (m[3] === 'E' ? 1 : -1) * Number(m[4])
      return lon < e && lon + 3 > w && lat < n && lat + 3 > s
    })
    .map((k) => `/vsis3/esa-worldcover/${k}`)
}

/** Rejilla global de 1/30°: cada tesela reducida por separado (en paralelo) y unidas. */
async function globalGrid() {
  const out = path.join(WORK, 'grid', 'fine', 'worldcover.tif')
  if (existsSync(out)) return out
  const dir = path.join(WORK, 'worldcover', 'fine')
  mkdirSync(dir, { recursive: true })
  const keys = await tiles()
  const queue = [...keys]
  let done = 0
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (queue.length) {
      const k = queue.shift()
      const dst = path.join(dir, path.basename(k))
      await warp(`/vsis3/esa-worldcover/${k}`, dst, { res: GRIDS.fine.res, resampling: 'mode', type: 'Byte', nodata: 0 }).catch((e) => console.warn(`[landcover] ⚠ ${k}: ${e.message}`))
      if (++done % 200 === 0) console.log(`[landcover] ${done}/${keys.length} teselas`)
    }
  }))
  const vrt = path.join(dir, 'all.vrt')
  await gdal('gdalbuildvrt', ['-q', vrt, ...keys.map((k) => path.join(dir, path.basename(k))).filter(existsSync)])
  return toGrid(vrt, 'worldcover', { resampling: 'near', type: 'Byte', nodata: 0 })
}

export const landcover = {
  id: 'landcover',
  family: 'vegetacion',
  name: 'Vegetación y usos del suelo',
  kind: 'raster',
  ord: 20,
  source,
  legend: CLASSES.map(({ key, label, color }) => ({ key, label, color })),
  concurrency: 4,

  async prepare() {
    await globalGrid()
  },

  async stats() {
    const z = await zones('fine')
    const g = await readGrid(await globalGrid(), { type: 'Byte' })
    const key = new Map(CLASSES.map((c) => [c.value, c.key]))
    const t = tally(z, (i, a) => (key.has(g.data[i]) ? [key.get(g.data[i]), a] : null))
    return { scope: 'share', values: toShares(t) }
  },

  async render(frame) {
    // países grandes: la rejilla mundial de 1/30° basta para su imagen; pequeños: teselas remotas
    const src = frame.spanDeg > 12 ? await globalGrid() : await tilesIn(frame.bbox)
    if (!src.length) return null
    const grid = await warpToFrame(src, frame, 'landcover', { resampling: 'mode', type: 'Byte', nodata: 0 })
    const rgba = paletteRgba(grid, new Map(CLASSES.map((c) => [c.value, hex(c.color)])))
    return writeLayerImage(landcover, frame, rgba, { lossless: true })
  },
}

export const layers = [landcover]
