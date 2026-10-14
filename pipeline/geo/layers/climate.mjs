// Clima: mapas de Köppen-Geiger de 1 km para 1991–2020 (Beck et al. 2023,
// Scientific Data; CC BY 4.0). 30 tipos de clima con los colores estándar de
// la clasificación; los repartos se guardan por tipo (Cfa…) y por grupo
// (A tropical, B seco, C templado, D continental, E polar).

import { download } from '../lib/files.mjs'
import { readGrid } from '../lib/gdal.mjs'
import { tally, toGrid, zones } from './grid.mjs'
import { paletteRgba, warpToFrame, writeLayerImage } from './render.mjs'
import { toShares } from './relief.mjs'

const source = {
  id: 'koppen',
  name: 'Köppen-Geiger 1 km (Beck et al. 2023)',
  url: 'https://www.gloh2o.org/koppen/',
  license: 'CC BY 4.0',
  attribution: 'Beck, H.E. et al. (2023). High-resolution (1 km) Köppen-Geiger maps for 1901–2099 based on constrained CMIP6 projections. Scientific Data 10, 724',
  version: '2 (1991–2020)',
}

const URL = 'https://ndownloader.figshare.com/files/61012822'

// valor del mapa → código, nombre en español y color de Beck et al.
export const KOPPEN = [
  [1, 'Af', 'Tropical lluvioso (selva)', [0, 0, 255]],
  [2, 'Am', 'Tropical monzónico', [0, 120, 255]],
  [3, 'Aw', 'Tropical de sabana', [70, 170, 250]],
  [4, 'BWh', 'Desierto cálido', [255, 0, 0]],
  [5, 'BWk', 'Desierto frío', [255, 150, 150]],
  [6, 'BSh', 'Estepa cálida (semiárido)', [245, 165, 0]],
  [7, 'BSk', 'Estepa fría (semiárido)', [255, 220, 100]],
  [8, 'Csa', 'Mediterráneo de verano caluroso', [255, 255, 0]],
  [9, 'Csb', 'Mediterráneo de verano templado', [200, 200, 0]],
  [10, 'Csc', 'Mediterráneo de verano fresco', [150, 150, 0]],
  [11, 'Cwa', 'Subtropical de invierno seco', [150, 255, 150]],
  [12, 'Cwb', 'Templado de montaña, invierno seco', [100, 200, 100]],
  [13, 'Cwc', 'Templado frío de montaña, invierno seco', [50, 150, 50]],
  [14, 'Cfa', 'Subtropical húmedo', [200, 255, 80]],
  [15, 'Cfb', 'Oceánico', [100, 255, 80]],
  [16, 'Cfc', 'Oceánico subpolar', [50, 200, 0]],
  [17, 'Dsa', 'Continental de verano seco y caluroso', [255, 0, 255]],
  [18, 'Dsb', 'Continental de verano seco y templado', [200, 0, 200]],
  [19, 'Dsc', 'Subártico de verano seco', [150, 50, 150]],
  [20, 'Dsd', 'Subártico de verano seco, invierno extremo', [150, 100, 150]],
  [21, 'Dwa', 'Continental de invierno seco, verano caluroso', [170, 175, 255]],
  [22, 'Dwb', 'Continental de invierno seco, verano templado', [90, 120, 220]],
  [23, 'Dwc', 'Subártico de invierno seco', [75, 80, 180]],
  [24, 'Dwd', 'Subártico de invierno seco extremo', [50, 0, 135]],
  [25, 'Dfa', 'Continental húmedo de verano caluroso', [0, 255, 255]],
  [26, 'Dfb', 'Continental húmedo de verano templado', [55, 200, 255]],
  [27, 'Dfc', 'Subártico (taiga)', [0, 125, 125]],
  [28, 'Dfd', 'Subártico de invierno extremo', [0, 70, 95]],
  [29, 'ET', 'Tundra', [178, 178, 178]],
  [30, 'EF', 'Hielo perpetuo', [102, 102, 102]],
].map(([value, key, label, rgb]) => ({ value, key, label, rgb, color: `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}` }))

export const CLIMATE_GROUPS = { A: 'Tropical', B: 'Seco', C: 'Templado', D: 'Continental', E: 'Polar' }

const tif = async (res) => `/vsizip/${await download('koppen', URL, 'koppen_geiger_tif.zip')}/1991_2020/koppen_geiger_${res}.tif`

export const climate = {
  id: 'climate',
  family: 'clima',
  name: 'Clima (Köppen)',
  kind: 'raster',
  ord: 30,
  source,
  legend: KOPPEN.map(({ key, label, color }) => ({ key, label, color })),

  async prepare() {
    await tif('0p00833333')
  },

  /** Reparto por tipo de clima y por grupo (A–E). */
  async stats() {
    const z = await zones('fine')
    const g = await readGrid(await toGrid(await tif('0p00833333'), 'koppen', { resampling: 'mode', type: 'Byte', srcNodata: 0, nodata: 0 }), { type: 'Byte' })
    const code = new Map(KOPPEN.map((k) => [k.value, k.key]))
    const byClass = toShares(tally(z, (i, a) => (code.has(g.data[i]) ? [code.get(g.data[i]), a] : null)))
    // grupos: suma de sus tipos
    for (const m of byClass.values()) {
      const groups = new Map()
      for (const [k, v] of m) groups.set(k[0], (groups.get(k[0]) ?? 0) + v)
      for (const [k, v] of groups) m.set(k, Math.round(v * 1000) / 1000)
    }
    return { scope: 'share', values: byClass }
  },

  async render(frame) {
    const grid = await warpToFrame(await tif('0p00833333'), frame, 'climate', { resampling: 'mode', type: 'Byte', nodata: 0, srcNodata: 0 })
    const rgba = paletteRgba(grid, new Map(KOPPEN.map((k) => [k.value, k.rgb])))
    return writeLayerImage(climate, frame, rgba, { lossless: true })
  },
}

export const layers = [climate]
