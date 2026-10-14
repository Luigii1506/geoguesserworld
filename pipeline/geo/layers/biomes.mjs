// Biomas (RESOLVE Ecoregions 2017, CC BY 4.0): selva, bosque templado, taiga,
// sabana, estepa, desierto, tundra… Las ecorregiones se rasterizan una vez por
// número de bioma a 1/60° (~1,8 km); de ahí salen los repartos por país y
// región y la imagen de cada país.

import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { WORK } from '../lib/dirs.mjs'
import { gdal, readGrid } from '../lib/gdal.mjs'
import { tally, toGrid, zones } from './grid.mjs'
import { hex, paletteRgba, warpToFrame, writeLayerImage } from './render.mjs'
import { toShares } from './relief.mjs'
import { BIOMES, meta as source, shp } from '../sources/resolve.mjs'

/** Ráster global del bioma (1/60°): 0 = sin bioma (agua, roca y hielo). */
async function biomeRaster() {
  const dst = path.join(WORK, 'resolve', 'biome_60.tif')
  if (existsSync(dst)) return dst
  mkdirSync(path.dirname(dst), { recursive: true })
  await gdal('gdal_rasterize', ['-q', '-a', 'BIOME_NUM', '-te', '-180', '-90', '180', '90', '-ts', '21600', '10800',
    '-ot', 'Byte', '-a_nodata', '0', '-init', '0', '-co', 'COMPRESS=DEFLATE', '-co', 'TILED=YES', await shp(), dst])
  return dst
}

export const biome = {
  id: 'biome',
  family: 'vegetacion',
  name: 'Biomas',
  kind: 'raster',
  ord: 22,
  source,
  legend: BIOMES.map(({ key, label, color }) => ({ key, label, color })),

  async prepare() {
    await biomeRaster()
  },

  async stats() {
    const z = await zones('fine')
    const g = await readGrid(await toGrid(await biomeRaster(), 'biome', { resampling: 'mode', type: 'Byte', srcNodata: 0, nodata: 0 }), { type: 'Byte' })
    const key = new Map(BIOMES.map((b) => [b.value, b.key]))
    return { scope: 'share', values: toShares(tally(z, (i, a) => (key.has(g.data[i]) ? [key.get(g.data[i]), a] : null))) }
  },

  async render(frame) {
    const grid = await warpToFrame(await biomeRaster(), frame, 'biome', { resampling: 'near', type: 'Byte', nodata: 0, srcNodata: 0 })
    const rgba = paletteRgba(grid, new Map(BIOMES.map((b) => [b.value, hex(b.color)])))
    return writeLayerImage(biome, frame, rgba, { lossless: true })
  },
}

export const layers = [biome]
