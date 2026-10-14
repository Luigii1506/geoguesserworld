// Rejillas globales de análisis (EPSG:4326) y zonas (países y regiones admin1)
// rasterizadas sobre ellas. Los repartos por región de cada capa (cuánta
// montaña, cuánto cultivo…) se calculan contando píxeles por zona, con el
// área de cada píxel (que mengua con la latitud).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { WORK } from '../lib/dirs.mjs'
import { rasterize, readGrid, warp } from '../lib/gdal.mjs'
import { shapes } from '../sources/naturalearth.mjs'

/** Resoluciones: `fine` 1/30° (~3,7 km) para el terreno; `coarse` 1/12° (~9 km), la de MapSPAM. */
export const GRIDS = {
  fine: { res: 1 / 30, width: 10800, height: 5400 },
  coarse: { res: 1 / 12, width: 4320, height: 2160 },
}
const WORLD = [-180, -90, 180, 90]

/** Remuestrea un ráster a la rejilla `grid` (alineada al mundo). */
export async function toGrid(src, name, { grid = 'fine', resampling = 'near', type, srcNodata, nodata } = {}) {
  const g = GRIDS[grid]
  return warp(src, path.join(WORK, 'grid', grid, `${name}.tif`), { bbox: WORLD, size: [g.width, g.height], resampling, type, srcNodata, nodata })
}

const cache = new Map()
/**
 * Zonas sobre una rejilla: { country: Uint16Array, admin1: Uint16Array, countries: [...], admin1s: [...], area: Float64Array (km² por fila) }
 * Índice 0 = sin zona; i+1 = elemento i de la lista.
 */
export async function zones(grid = 'fine') {
  if (cache.has(grid)) return cache.get(grid)
  const g = GRIDS[grid]
  const s = await shapes()
  const dir = path.join(WORK, 'grid', grid)
  mkdirSync(dir, { recursive: true })
  const out = { grid: g }
  for (const [key, list] of [['countries', s.countries], ['admin1s', s.admin1]]) {
    const src = path.join(dir, `${key}.geojson`)
    if (!existsSync(src))
      writeFileSync(src, JSON.stringify({ type: 'FeatureCollection', features: list.map((f, i) => ({ type: 'Feature', properties: { zid: i + 1 }, geometry: f.geometry })) }))
    const tif = await rasterize(src, path.join(dir, `${key}.tif`), { attr: 'zid', bbox: WORLD, size: [g.width, g.height] })
    out[key === 'countries' ? 'country' : 'admin1'] = (await readGrid(tif, { type: 'UInt16' })).data
  }
  out.countries = s.countries.map((c) => ({ key: `iso:${c.cc}`, cc: c.cc }))
  out.admin1s = s.admin1.map((a) => ({ key: `ne:${a.props.adm1_code}`, cc: a.cc }))
  // área de un píxel en km² según la fila (latitud de su centro)
  const R = 6371.0088
  const d = (g.res * Math.PI) / 180
  out.area = Float64Array.from({ length: g.height }, (_, row) => {
    const lat = 90 - (row + 0.5) * g.res
    return R * R * d * d * Math.cos((lat * Math.PI) / 180)
  })
  cache.set(grid, out)
  return out
}

/**
 * Suma por zona: fn(i, row) devuelve la clave de clase (o null para no contar) y
 * el peso (área o el valor del píxel). Devuelve Map(zona → Map(clase → total)).
 */
export function tally(z, visit) {
  const byCountry = new Map()
  const byAdmin = new Map()
  const { width, height } = z.grid
  const add = (m, zone, cls, w) => {
    let t = m.get(zone)
    if (!t) m.set(zone, (t = new Map()))
    t.set(cls, (t.get(cls) ?? 0) + w)
  }
  for (let row = 0; row < height; row++) {
    const a = z.area[row]
    for (let col = 0, i = row * width; col < width; col++, i++) {
      const c = z.country[i]
      const r = z.admin1[i]
      if (!c && !r) continue
      const hit = visit(i, a)
      if (!hit) continue
      const [cls, w] = hit
      if (c) add(byCountry, z.countries[c - 1].key, cls, w)
      if (r) add(byAdmin, z.admin1s[r - 1].key, cls, w)
    }
  }
  return new Map([...byCountry, ...byAdmin])
}

/** Países a menos de `km` de un punto (también en el mar), mirando las celdas de unas zonas ya cargadas. */
export function countriesNear(z, lng, lat, km = 40) {
  const { width, height, res } = z.grid
  const col = Math.floor((lng + 180) / res)
  const row = Math.floor((90 - lat) / res)
  const ry = Math.ceil(km / 111 / res)
  const rx = Math.ceil(km / (111 * Math.max(0.15, Math.cos((lat * Math.PI) / 180))) / res)
  const out = new Set()
  for (let y = Math.max(0, row - ry); y <= Math.min(height - 1, row + ry); y++)
    for (let x = col - rx; x <= col + rx; x++) {
      const c = z.country[y * width + ((x % width) + width) % width]
      if (c) out.add(z.countries[c - 1].cc)
    }
  return out
}
