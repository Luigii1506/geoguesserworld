// Relieve (ETOPO 2022, NOAA, dominio público) y, derivado de él, el tipo de
// terreno: llanura, meseta, lomerío, montaña y alta montaña.
//   · relieve: sombreado con tintes de altitud
//   · terreno: clases según la altitud y el desnivel local (~10 km), al estilo
//     de las clasificaciones de geoformas de Meybeck et al. (2001)
// Países grandes: ETOPO 60″ (~1,8 km, archivo local). Pequeños: ETOPO 15″
// (~460 m) leído en remoto solo en la zona del país.

import path from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { download } from '../lib/files.mjs'
import { gdal, readGrid } from '../lib/gdal.mjs'
import { WORK } from '../lib/dirs.mjs'
import { GRIDS, tally, toGrid, zones } from './grid.mjs'
import { hex, warpToFrame, writeLayerImage } from './render.mjs'

const source = {
  id: 'etopo',
  name: 'ETOPO 2022 (NOAA)',
  url: 'https://www.ncei.noaa.gov/products/etopo-global-relief-model',
  license: 'Dominio público (NOAA)',
  attribution: 'NOAA National Centers for Environmental Information (2022): ETOPO 2022 Global Relief Model',
  version: '2022 v1',
}

const URL60 = 'https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif'
const URL15 = (tile) => `/vsicurl/https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/15s/15s_surface_elev_gtif/ETOPO_2022_v1_15s_${tile}_surface.tif`

// tintes de altitud (m) → color; entre paradas se interpola
const STOPS = [
  [-500, '#5f8f5a'], [0, '#6f9d63'], [200, '#94b56e'], [500, '#c3c784'], [1000, '#d9c58f'],
  [1500, '#c9a77a'], [2200, '#a9815f'], [3000, '#8d6a54'], [4000, '#a39a95'], [5000, '#e6e3e0'], [6500, '#ffffff'],
].map(([v, c]) => [v, hex(c)])

export const LANDFORMS = [
  { key: 'llanura', label: 'Llanura', color: '#9fc27a', value: 1 },
  { key: 'meseta', label: 'Meseta o altiplano', color: '#e2cf8b', value: 2 },
  { key: 'lomerio', label: 'Lomerío y colinas', color: '#c99a63', value: 3 },
  { key: 'montana', label: 'Montaña', color: '#9a5f3c', value: 4 },
  { key: 'alta_montana', label: 'Alta montaña', color: '#5b3a2e', value: 5 },
]

/** Clase de terreno según altitud y desnivel local (m). */
export function landform(elev, relief) {
  if (relief >= 900 || (elev >= 3000 && relief >= 300)) return 5
  if (relief >= 300) return 4
  if (elev >= 600 && relief < 120) return 2
  if (relief < 60 && elev < 600) return 1
  return 3
}

/** Desnivel local: máximo − mínimo en una ventana de radio r (píxeles), en dos pasadas. */
function localRelief(data, width, height, r, nodata) {
  const max = new Float32Array(data.length)
  const min = new Float32Array(data.length)
  const tmpMax = new Float32Array(data.length)
  const tmpMin = new Float32Array(data.length)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let hi = -Infinity
      let lo = Infinity
      for (let k = Math.max(0, x - r); k <= Math.min(width - 1, x + r); k++) {
        const v = data[y * width + k]
        if (v === nodata || Number.isNaN(v)) continue
        if (v > hi) hi = v
        if (v < lo) lo = v
      }
      tmpMax[y * width + x] = hi
      tmpMin[y * width + x] = lo
    }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let hi = -Infinity
      let lo = Infinity
      for (let k = Math.max(0, y - r); k <= Math.min(height - 1, y + r); k++) {
        const i = k * width + x
        if (tmpMax[i] > hi) hi = tmpMax[i]
        if (tmpMin[i] < lo) lo = tmpMin[i]
      }
      max[y * width + x] = hi
      min[y * width + x] = lo
    }
  const out = new Float32Array(data.length)
  for (let i = 0; i < data.length; i++) out[i] = Number.isFinite(max[i]) && Number.isFinite(min[i]) ? max[i] - min[i] : 0
  return out
}

async function etopo60() {
  return download('etopo', URL60, path.basename(URL60))
}

/** VRT de las teselas de 15″ que cubren el marco (15° × 15°, nombradas por su esquina noroeste). */
async function etopo15(frame) {
  const [w, s, e, n] = frame.bbox
  const tiles = []
  for (let top = Math.ceil(n / 15) * 15; top > s; top -= 15)
    for (let left = Math.floor(w / 15) * 15; left < e; left += 15) {
      const ns = top >= 0 ? `N${String(top).padStart(2, '0')}` : `S${String(-top).padStart(2, '0')}`
      const ew = left >= 0 ? `E${String(left).padStart(3, '0')}` : `W${String(-left).padStart(3, '0')}`
      tiles.push(URL15(`${ns}${ew}`))
    }
  const vrt = path.join(WORK, 'etopo15', `${frame.cc}.vrt`)
  if (!existsSync(vrt)) {
    mkdirSync(path.dirname(vrt), { recursive: true })
    await gdal('gdalbuildvrt', ['-q', vrt, ...tiles])
  }
  return vrt
}

async function demFor(frame) {
  // los países pequeños con 15″: la imagen tendría píxeles de más de ~1 km con 60″
  if (frame.spanDeg < 12) {
    try {
      return await warpToFrame(await etopo15(frame), frame, 'relief15', { resampling: 'bilinear' })
    } catch {
      /* sin conexión o tesela inexistente: 60″ */
    }
  }
  return warpToFrame(await etopo60(), frame, 'relief60', { resampling: 'bilinear' })
}

/** Tamaño real (m) de un píxel Mercator en cada fila. */
function groundSize(frame) {
  const [, s, , n] = frame.bbox
  const y0 = Math.log(Math.tan(Math.PI / 4 + (n * Math.PI) / 360))
  const y1 = Math.log(Math.tan(Math.PI / 4 + (s * Math.PI) / 360))
  const px = ((frame.bbox[2] - frame.bbox[0]) / frame.width) * 111320 // m por píxel en el ecuador
  return Float32Array.from({ length: frame.height }, (_, row) => {
    const y = y0 + ((y1 - y0) * (row + 0.5)) / frame.height
    const lat = (2 * Math.atan(Math.exp(y)) - Math.PI / 2)
    return px * Math.cos(lat)
  })
}

function tint(v) {
  if (v <= STOPS[0][0]) return STOPS[0][1]
  for (let k = 1; k < STOPS.length; k++) {
    if (v <= STOPS[k][0]) {
      const [a, ca] = STOPS[k - 1]
      const [b, cb] = STOPS[k]
      const t = (v - a) / (b - a)
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]
    }
  }
  return STOPS[STOPS.length - 1][1]
}

const NODATA = -32768
const valid = (v) => v !== NODATA && !Number.isNaN(v) && v > -1000

const shared = { frames: new Map() }
async function frameDem(frame) {
  if (!shared.frames.has(frame.cc)) {
    shared.frames.clear()
    shared.frames.set(frame.cc, await demFor(frame))
  }
  return shared.frames.get(frame.cc)
}

export const relief = {
  id: 'relief',
  family: 'terreno',
  name: 'Relieve',
  kind: 'raster',
  ord: 10,
  source,
  legend: [
    { key: '0', label: '0 m', color: '#6f9d63' }, { key: '500', label: '500 m', color: '#c3c784' },
    { key: '1500', label: '1.500 m', color: '#c9a77a' }, { key: '3000', label: '3.000 m', color: '#8d6a54' },
    { key: '5000', label: '5.000 m', color: '#e6e3e0' },
  ],

  async prepare() {
    await etopo60()
  },

  /** Altitud media y máxima de cada país y región (m). */
  async stats() {
    const z = await zones('fine')
    const mean = await readGrid(await toGrid(await etopo60(), 'etopo_mean', { resampling: 'average', type: 'Float32' }))
    const max = await readGrid(await toGrid(await etopo60(), 'etopo_max', { resampling: 'max', type: 'Float32' }))
    const sum = tally(z, (i, a) => (valid(mean.data[i]) ? ['sum', a * Math.max(0, mean.data[i])] : null))
    const area = tally(z, (i, a) => (valid(mean.data[i]) ? ['area', a] : null))
    const hi = new Map()
    const { width, height } = z.grid
    for (let row = 0; row < height; row++)
      for (let i = row * width; i < (row + 1) * width; i++) {
        const v = max.data[i]
        if (!valid(v)) continue
        for (const key of [z.country[i] && z.countries[z.country[i] - 1].key, z.admin1[i] && z.admin1s[z.admin1[i] - 1].key])
          if (key && v > (hi.get(key) ?? -Infinity)) hi.set(key, v)
      }
    const out = new Map()
    for (const [key, t] of sum) {
      const a = area.get(key)?.get('area')
      if (!a) continue
      out.set(key, new Map([['mean', Math.round(t.get('sum') / a)], ['max', Math.round(hi.get(key) ?? 0)]]))
    }
    return { scope: 'm', values: out }
  },

  async render(frame) {
    const dem = await frameDem(frame)
    const { data, width, height } = dem
    const gs = groundSize(frame)
    const rgba = new Uint8Array(width * height * 4)
    // sombreado de Horn con luz del noroeste; exageración vertical suave
    const az = (315 * Math.PI) / 180
    const alt = (45 * Math.PI) / 180
    const z = 1.6
    const at = (x, y) => {
      const v = data[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))]
      return valid(v) ? v : 0
    }
    for (let y = 0; y < height; y++) {
      const d = gs[y]
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        const v = data[i]
        if (!valid(v)) continue
        const dzdx = ((at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))) / (8 * d)
        const dzdy = ((at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))) / (8 * d)
        const slope = Math.atan(z * Math.hypot(dzdx, dzdy))
        const aspect = Math.atan2(dzdy, -dzdx)
        const shade = Math.max(0, Math.cos(alt) * Math.cos(slope) + Math.sin(alt) * Math.sin(slope) * Math.cos(az - Math.PI / 2 - aspect))
        const [r, g, b] = tint(v)
        const k = 0.5 + 0.62 * shade
        rgba[i * 4] = Math.min(255, r * k)
        rgba[i * 4 + 1] = Math.min(255, g * k)
        rgba[i * 4 + 2] = Math.min(255, b * k)
        rgba[i * 4 + 3] = 255
      }
    }
    return writeLayerImage(relief, frame, rgba)
  },
}

export const terrain = {
  id: 'landform',
  family: 'terreno',
  name: 'Llanuras y montañas',
  kind: 'raster',
  ord: 11,
  source,
  legend: LANDFORMS.map(({ key, label, color }) => ({ key, label, color })),

  async prepare() {
    await etopo60()
  },

  /** Reparto del terreno de cada país y región (fracción del área). */
  async stats() {
    const z = await zones('fine')
    const mean = await readGrid(await toGrid(await etopo60(), 'etopo_mean', { resampling: 'average', type: 'Float32' }))
    const { width, height } = GRIDS.fine
    const rel = localRelief(mean.data, width, height, 1, NODATA)
    const key = new Map(LANDFORMS.map((l) => [l.value, l.key]))
    const t = tally(z, (i, a) => (valid(mean.data[i]) ? [key.get(landform(mean.data[i], rel[i])), a] : null))
    return { scope: 'share', values: toShares(t) }
  },

  async render(frame) {
    const dem = await frameDem(frame)
    const { data, width, height } = dem
    // radio de ~5 km en píxeles (según el tamaño real del píxel en el centro)
    const gs = groundSize(frame)[Math.floor(height / 2)]
    const r = Math.max(1, Math.round(5000 / gs))
    const rel = localRelief(data, width, height, r, NODATA)
    const colors = new Map(LANDFORMS.map((l) => [l.value, hex(l.color)]))
    const rgba = new Uint8Array(width * height * 4)
    for (let i = 0; i < data.length; i++) {
      if (!valid(data[i])) continue
      const c = colors.get(landform(data[i], rel[i]))
      rgba[i * 4] = c[0]
      rgba[i * 4 + 1] = c[1]
      rgba[i * 4 + 2] = c[2]
      rgba[i * 4 + 3] = 255
    }
    return writeLayerImage(terrain, frame, rgba, { lossless: true })
  },
}

/** Totales por clase → fracciones (0–1) de cada zona. */
export function toShares(t) {
  const out = new Map()
  for (const [zone, m] of t) {
    const total = [...m.values()].reduce((a, b) => a + b, 0)
    if (!total) continue
    out.set(zone, new Map([...m].map(([k, v]) => [k, Math.round((v / total) * 1000) / 1000])))
  }
  return out
}

export const layers = [relief, terrain]
