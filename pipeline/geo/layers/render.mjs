// Imagen de una capa para un país: se recorta el ráster al contorno del país,
// se proyecta en Mercator (EPSG:3857, la proyección de d3.geoMercator en la
// app) y se colorea a WebP con transparencia fuera del país.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { ASSETS, WORK } from '../lib/dirs.mjs'
import { gdal, readGrid, warp } from '../lib/gdal.mjs'
import { areaKm2, bboxOf, labelPoint } from '../lib/geom.mjs'
import { shapes } from '../sources/naturalearth.mjs'

const LONG_SIDE = 1400
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360))

/**
 * Marco de un país: la parte principal (sin territorios lejanos ni el trozo al otro
 * lado del antimeridiano), su caja, tamaño de la imagen y el contorno para recortar.
 */
export async function countryFrame(cc) {
  const s = await shapes()
  const c = s.countries.find((x) => x.cc === cc)
  if (!c) return null
  const polys = (c.geometry.type === 'Polygon' ? [c.geometry.coordinates] : c.geometry.coordinates).map((p) => {
    const g = { type: 'Polygon', coordinates: p }
    return { g, area: areaKm2(g), bbox: bboxOf(g), center: labelPoint(g) }
  })
  polys.sort((a, b) => b.area - a.area)
  const main = polys[0]
  // cerca de la parte principal (15°) o grande (≥ 20 % de ella), y del mismo lado del antimeridiano
  const keep = polys.filter((p) => {
    const sameSide = Math.abs(p.center[0] - main.center[0]) < 180
    const near = p.bbox[0] < main.bbox[2] + 15 && p.bbox[2] > main.bbox[0] - 15 && p.bbox[1] < main.bbox[3] + 15 && p.bbox[3] > main.bbox[1] - 15
    return sameSide && (near || p.area >= main.area * 0.2)
  })
  let [w, so, e, n] = keep.reduce((b, p) => [Math.min(b[0], p.bbox[0]), Math.min(b[1], p.bbox[1]), Math.max(b[2], p.bbox[2]), Math.max(b[3], p.bbox[3])], [180, 90, -180, -90])
  // margen del 3 % para que el contorno respire
  const mx = (e - w) * 0.03
  const my = (n - so) * 0.03
  ;[w, so, e, n] = [Math.max(-180, w - mx), Math.max(-85, so - my), Math.min(180, e + mx), Math.min(85, n + my)]
  const ratio = (((e - w) * Math.PI) / 180) / (mercY(n) - mercY(so))
  const [width, height] = ratio >= 1 ? [LONG_SIDE, Math.max(1, Math.round(LONG_SIDE / ratio))] : [Math.max(1, Math.round(LONG_SIDE * ratio)), LONG_SIDE]
  // contorno para recortar, reparado (algunos de Natural Earth se cruzan consigo mismos: Egipto…)
  const cutline = path.join(WORK, 'countries', `${cc}.valid.geojson`)
  if (!existsSync(cutline)) {
    const raw = path.join(WORK, 'countries', `${cc}.geojson`)
    mkdirSync(path.dirname(raw), { recursive: true })
    writeFileSync(raw, JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: keep.map((p) => p.g.coordinates) } }] }))
    await gdal('ogr2ogr', ['-f', 'GeoJSON', '-makevalid', '-nlt', 'MULTIPOLYGON', cutline, raw])
  }
  const spanDeg = Math.max(e - w, n - so)
  return { cc, bbox: [w, so, e, n].map((v) => Math.round(v * 1e4) / 1e4), width, height, cutline, spanDeg }
}

/** Recorta y proyecta un ráster al marco del país y lo lee como matriz. */
export async function warpToFrame(src, frame, name, { resampling = 'near', type = 'Float32', nodata = -32768, srcNodata } = {}) {
  const dst = path.join(WORK, 'frames', name, `${frame.cc}.tif`)
  await warp(src, dst, {
    srs: 'EPSG:3857', bbox: frame.bbox, bboxSrs: 'EPSG:4326', size: [frame.width, frame.height], resampling, type, nodata, srcNodata,
    cutline: frame.cutline, overwrite: true,
  })
  const grid = await readGrid(dst, { type })
  rmSync(dst, { force: true })
  return grid
}

/**
 * Escribe la imagen RGBA de una capa como WebP y devuelve su registro de `asset`.
 * @param {{ id: string }} layer
 * @param {object} frame  countryFrame()
 * @param {Uint8Array|Buffer} rgba
 */
export async function writeLayerImage(layer, frame, rgba, { lossless = false } = {}) {
  const rel = `atlas/layers/${layer.id}/${frame.cc}.webp`
  const file = path.join(ASSETS, rel)
  mkdirSync(path.dirname(file), { recursive: true })
  const buf = await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), { raw: { width: frame.width, height: frame.height, channels: 4 } })
    .webp(lossless ? { lossless: true, effort: 5 } : { quality: 82, alphaQuality: 90, effort: 5 })
    .toBuffer()
  writeFileSync(file, buf)
  return {
    layer_id: layer.id, cc: frame.cc, path: rel, bbox: frame.bbox.join(','), width: frame.width, height: frame.height,
    bytes: statSync(file).size, hash: createHash('sha1').update(buf).digest('hex').slice(0, 12),
  }
}

/** Colorea una matriz de clases con una paleta { valor → [r, g, b] }; lo demás, transparente. */
export function paletteRgba(grid, palette) {
  const out = new Uint8Array(grid.width * grid.height * 4)
  for (let i = 0; i < grid.data.length; i++) {
    const c = palette.get(grid.data[i])
    if (!c) continue
    out[i * 4] = c[0]
    out[i * 4 + 1] = c[1]
    out[i * 4 + 2] = c[2]
    out[i * 4 + 3] = 255
  }
  return out
}

export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
