// Envoltorio mínimo de GDAL/OGR (línea de comandos; `brew install gdal`).
// Todo lo pesado de rásters y vectores pasa por aquí: reproyectar, recortar,
// remuestrear, rasterizar y convertir a GeoJSON.

import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { promisify } from 'node:util'
import path from 'node:path'

const run = promisify(execFile)

export async function gdal(cmd, args, { quiet = true } = {}) {
  try {
    const { stdout } = await run(cmd, args, { maxBuffer: 1 << 28, env: { ...process.env, GDAL_HTTP_MAX_RETRY: '4', GDAL_HTTP_RETRY_DELAY: '3', CPL_VSIL_CURL_ALLOWED_EXTENSIONS: '.tif,.tiff,.vrt', AWS_NO_SIGN_REQUEST: 'YES' } })
    return stdout
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`falta ${cmd}: instala GDAL con "brew install gdal"`)
    if (!quiet) console.error(e.stderr)
    const why = (e.stderr || '').toString().trim().split('\n').slice(-3).join(' | ') || `código ${e.code ?? '?'}${e.signal ? `, señal ${e.signal}` : ''}`
    throw new Error(`${cmd} falló: ${why}`)
  }
}

/** Vectorial (shapefile, gpkg, zip…) → GeoJSON en WGS84, con filtros opcionales. */
export async function toGeoJSON(src, dst, { where, select, simplify, layer, sql } = {}) {
  if (existsSync(dst)) return JSON.parse(readFileSync(dst, 'utf8'))
  mkdirSync(path.dirname(dst), { recursive: true })
  const args = ['-f', 'GeoJSON', '-t_srs', 'EPSG:4326', '-lco', 'COORDINATE_PRECISION=4', '-lco', 'RFC7946=YES', '-makevalid']
  if (sql) args.push('-sql', sql)
  if (where) args.push('-where', where)
  if (select) args.push('-select', select)
  if (simplify) args.push('-simplify', String(simplify))
  args.push(`${dst}.tmp`, src)
  if (layer) args.push(layer)
  rmSync(`${dst}.tmp`, { force: true })
  await gdal('ogr2ogr', args)
  renameSync(`${dst}.tmp`, dst)
  return JSON.parse(readFileSync(dst, 'utf8'))
}

/**
 * Remuestrea/recorta un ráster a una rejilla dada (EPSG:4326 salvo que se indique).
 * @param {string|string[]} src  una o varias fuentes
 * @param {string} dst  .tif
 * @param {{ bbox?: number[], res?: number, size?: [number, number], srs?: string, resampling?: string,
 *           type?: string, nodata?: number, cutline?: string, cutlineWhere?: string, overwrite?: boolean }} o
 */
export async function warp(src, dst, o = {}) {
  if (existsSync(dst) && !o.overwrite) return dst
  mkdirSync(path.dirname(dst), { recursive: true })
  const args = ['-overwrite', '-t_srs', o.srs ?? 'EPSG:4326', '-r', o.resampling ?? 'near', '-multi', '-wo', 'NUM_THREADS=ALL_CPUS',
    '-co', 'COMPRESS=DEFLATE', '-co', 'TILED=YES', '-co', 'BIGTIFF=IF_SAFER']
  if (o.bbox) args.push('-te', ...o.bbox.map(String))
  if (o.bboxSrs) args.push('-te_srs', o.bboxSrs)
  if (o.res) args.push('-tr', String(o.res), String(o.res))
  if (o.size) args.push('-ts', String(o.size[0]), String(o.size[1]))
  if (o.type) args.push('-ot', o.type)
  if (o.nodata !== undefined) args.push('-dstnodata', String(o.nodata))
  if (o.srcNodata !== undefined) args.push('-srcnodata', String(o.srcNodata))
  if (o.cutline) {
    args.push('-cutline', o.cutline)
    if (o.cutlineWhere) args.push('-cwhere', o.cutlineWhere)
  }
  // varias fuentes: gdalwarp elige la vista reducida adecuada de cada una (un VRT no lo hace)
  args.push(...(Array.isArray(src) ? src : [src]), `${dst}.tmp.tif`)
  await gdal('gdalwarp', args)
  renameSync(`${dst}.tmp.tif`, dst)
  return dst
}

/** Lee un ráster de una banda como matriz plana (con GDAL → ENVI .bin). */
export async function readGrid(src, { type = 'Float32' } = {}) {
  const tmp = `${src}.${type}.bin`
  await gdal('gdal_translate', ['-q', '-of', 'ENVI', '-ot', type, src, tmp])
  const buf = readFileSync(tmp)
  const info = JSON.parse(await gdal('gdalinfo', ['-json', src]))
  for (const f of [tmp, tmp.replace(/\.bin$/, '.hdr'), `${tmp}.aux.xml`, tmp.replace(/\.bin$/, '.bin.aux.xml')]) rmSync(f, { force: true })
  const [w, h] = info.size
  const gt = info.geoTransform
  const Arr = { Float32: Float32Array, Int16: Int16Array, Byte: Uint8Array, UInt16: Uint16Array, Int32: Int32Array }[type]
  const data = new Arr(buf.buffer, buf.byteOffset, w * h)
  const band = info.bands[0]
  return { data, width: w, height: h, gt, nodata: band.noDataValue ?? null, srs: info.coordinateSystem?.wkt ?? null }
}

/** Rasteriza polígonos (GeoJSON) a una rejilla: cada píxel = valor del atributo `attr` (0 = fuera). */
export async function rasterize(src, dst, { attr, bbox, size, type = 'UInt16', srs = 'EPSG:4326' }) {
  if (existsSync(dst)) return dst
  mkdirSync(path.dirname(dst), { recursive: true })
  await gdal('gdal_rasterize', ['-q', '-a', attr, '-a_srs', srs, '-te', ...bbox.map(String), '-ts', String(size[0]), String(size[1]),
    '-ot', type, '-a_nodata', '0', '-init', '0', '-co', 'COMPRESS=DEFLATE', src, dst])
  return dst
}

const ENVI_TYPE = { Byte: 1, Int16: 2, Float32: 4, UInt16: 12, Int32: 3 }
/**
 * Escribe una matriz como GeoTIFF en EPSG:4326 (vía ENVI): para rásters calculados en Node.
 * @param {ArrayBufferView} data
 * @param {{ width: number, height: number, west: number, north: number, res: number, type: string, nodata?: number }} g
 */
export async function writeGrid(data, g, dst) {
  mkdirSync(path.dirname(dst), { recursive: true })
  const bin = `${dst}.bin`
  writeFileSync(bin, Buffer.from(data.buffer, data.byteOffset, data.byteLength))
  writeFileSync(`${dst}.hdr`, [
    'ENVI', `samples = ${g.width}`, `lines = ${g.height}`, 'bands = 1', 'header offset = 0', 'file type = ENVI Standard',
    `data type = ${ENVI_TYPE[g.type]}`, 'interleave = bsq', 'byte order = 0',
    `map info = {Geographic Lat/Lon, 1, 1, ${g.west}, ${g.north}, ${g.res}, ${g.res}, WGS-84}`,
  ].join('\n'))
  await gdal('gdal_translate', ['-q', '-a_srs', 'EPSG:4326', ...(g.nodata !== undefined ? ['-a_nodata', String(g.nodata)] : []), '-co', 'COMPRESS=DEFLATE', '-co', 'TILED=YES', bin, dst])
  for (const f of [bin, `${dst}.hdr`, `${bin}.aux.xml`]) rmSync(f, { force: true })
  return dst
}
