// Cultivos: MapSPAM (IFPRI; producción y superficie cosechada de 42 cultivos
// en una rejilla de ~9 km). Usa SPAM 2020 v2 si está en data/raw/mapspam (su
// descarga pide registrarse en Dataverse) y, si no, SPAM 2010 v2 (libre).
//   · repartos: toneladas y hectáreas de cada cultivo por país y región
//   · mapa: el grupo de cultivos que más superficie ocupa en cada zona

import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { download, rawDir } from '../lib/files.mjs'
import { readGrid, writeGrid } from '../lib/gdal.mjs'
import { WORK } from '../lib/dirs.mjs'
import { GRIDS, tally, toGrid, zones } from './grid.mjs'
import { hex, paletteRgba, warpToFrame, writeLayerImage } from './render.mjs'

// código SPAM → nombre y grupo del mapa
export const CROPS = {
  WHEA: ['Trigo', 'trigo'], BARL: ['Cebada', 'trigo'], OCER: ['Otros cereales', 'trigo'],
  MAIZ: ['Maíz', 'maiz'], RICE: ['Arroz', 'arroz'], SORG: ['Sorgo', 'sorgo'], PMIL: ['Mijo perla', 'sorgo'], SMIL: ['Mijo menor', 'sorgo'],
  POTA: ['Papa', 'raices'], SWPO: ['Camote', 'raices'], YAMS: ['Ñame', 'raices'], CASS: ['Yuca', 'raices'], ORTS: ['Otras raíces', 'raices'],
  BEAN: ['Frijol', 'legumbres'], CHIC: ['Garbanzo', 'legumbres'], COWP: ['Caupí', 'legumbres'], PIGE: ['Gandul', 'legumbres'],
  LENT: ['Lenteja', 'legumbres'], OPUL: ['Otras legumbres', 'legumbres'], GROU: ['Cacahuate', 'legumbres'],
  SOYB: ['Soja', 'soja'], OILP: ['Palma aceitera', 'oleaginosas'], SUNF: ['Girasol', 'oleaginosas'], RAPE: ['Colza', 'oleaginosas'],
  SESA: ['Sésamo', 'oleaginosas'], OOIL: ['Otras oleaginosas', 'oleaginosas'], CNUT: ['Coco', 'oleaginosas'],
  SUGC: ['Caña de azúcar', 'azucar'], SUGB: ['Remolacha azucarera', 'azucar'],
  ACOF: ['Café arábica', 'cafe'], RCOF: ['Café robusta', 'cafe'], COCO: ['Cacao', 'cafe'], TEAS: ['Té', 'cafe'],
  BANA: ['Banano', 'frutas'], PLNT: ['Plátano', 'frutas'], TROF: ['Frutas tropicales', 'frutas'], TEMF: ['Frutas templadas', 'frutas'],
  VEGE: ['Hortalizas', 'hortalizas'], COTT: ['Algodón', 'fibras'], OFIB: ['Otras fibras', 'fibras'], TOBA: ['Tabaco', 'fibras'],
  REST: ['Otros cultivos', 'otros'],
  // solo en SPAM 2020
  COFF: ['Café arábica', 'cafe'], MILL: ['Mijo', 'sorgo'], CITR: ['Cítricos', 'frutas'],
  ONIO: ['Cebolla', 'hortalizas'], TOMA: ['Jitomate', 'hortalizas'], RUBB: ['Caucho', 'otros'],
}
export const CROP_GROUPS = [
  { value: 1, key: 'maiz', label: 'Maíz', color: '#f2c12e' },
  { value: 2, key: 'trigo', label: 'Trigo y cebada', color: '#d6a04a' },
  { value: 3, key: 'arroz', label: 'Arroz', color: '#6fc3a0' },
  { value: 4, key: 'sorgo', label: 'Sorgo y mijo', color: '#c4743a' },
  { value: 5, key: 'soja', label: 'Soja', color: '#9cb53a' },
  { value: 6, key: 'oleaginosas', label: 'Palma, girasol, colza…', color: '#e9e25a' },
  { value: 7, key: 'legumbres', label: 'Frijol y legumbres', color: '#9b6fb3' },
  { value: 8, key: 'raices', label: 'Papa, yuca y raíces', color: '#b0896a' },
  { value: 9, key: 'azucar', label: 'Caña y remolacha', color: '#e5709b' },
  { value: 10, key: 'cafe', label: 'Café, cacao y té', color: '#7a4a2b' },
  { value: 11, key: 'frutas', label: 'Banano y frutas', color: '#f08a3c' },
  { value: 12, key: 'hortalizas', label: 'Hortalizas', color: '#4fa66a' },
  { value: 13, key: 'fibras', label: 'Algodón y tabaco', color: '#8db3d9' },
  { value: 14, key: 'otros', label: 'Otros', color: '#bdbdbd' },
]
const GROUP_VALUE = new Map(CROP_GROUPS.map((g) => [g.key, g.value]))

/** Rásters de cada cultivo dentro de un .zip de SPAM: { CROP → ruta /vsizip/ } (solo "todas las tecnologías", _A). */
function cropFiles(zip) {
  const list = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', maxBuffer: 1 << 24 }).split('\n')
  const out = {}
  for (const name of list) {
    const m = name.match(/_([A-Z]{4})_A\.tif$/i)
    if (m) out[m[1].toUpperCase()] = `/vsizip/${zip}/${name}`
  }
  return out
}

const spam2020 = () => {
  const dir = rawDir('mapspam')
  const prod = path.join(dir, 'spam2020V2r2_global_production.geotiff.zip')
  const harv = path.join(dir, 'spam2020V2r2_global_harvested_area.geotiff.zip')
  return existsSync(prod) && existsSync(harv) ? { prod, harv } : null
}

/** Versión disponible: 2020 si la descargaste tú (pide registro en Dataverse), si no 2010. */
async function edition() {
  const v2020 = spam2020()
  const pick = (year, prod, harv) => {
    const P = cropFiles(prod)
    const H = cropFiles(harv)
    return { year, file: (kind, crop) => (kind === 'P' ? P : H)[crop] ?? null }
  }
  if (v2020) return pick(2020, v2020.prod, v2020.harv)
  const prod = await download('mapspam', 'https://dataverse.harvard.edu/api/access/datafile/3985009', 'spam2010v2r0_global_prod.geotiff.zip')
  const harv = await download('mapspam', 'https://dataverse.harvard.edu/api/access/datafile/3985008', 'spam2010v2r0_global_harv_area.geotiff.zip')
  return pick(2010, prod, harv)
}

const source = {
  id: 'mapspam',
  name: 'MapSPAM (IFPRI)',
  url: 'https://www.mapspam.info',
  license: 'CC BY 4.0 (IFPRI)',
  attribution: 'International Food Policy Research Institute: Global Spatially-Disaggregated Crop Production Statistics Data (SPAM), Harvard Dataverse',
  // también sin prepare() (geo build aplica las capas ya calculadas)
  version: spam2020() ? '2020 v2r2' : '2010 v2r0',
}

/** Ráster de un cultivo remuestreado a la rejilla gruesa (1/12°), como matriz. */
async function cropGrid(ed, kind, crop) {
  const src = ed.file(kind, crop)
  if (!src) return null
  return readGrid(await toGrid(src, `spam${ed.year}_${kind}_${crop}`, { grid: 'coarse', resampling: 'sum', type: 'Float32', nodata: -1 }))
}

/** Grupo dominante (por superficie cosechada) en cada píxel; 0 si apenas hay cultivo. */
async function dominantGrid(ed) {
  const dst = path.join(WORK, 'grid', 'coarse', `spam${ed.year}_dominant.tif`)
  if (existsSync(dst)) return dst
  const { width, height, res } = GRIDS.coarse
  const byGroup = new Map()
  for (const [code, [, group]] of Object.entries(CROPS)) {
    const g = await cropGrid(ed, 'H', code)
    if (!g) continue
    const acc = byGroup.get(group) ?? new Float32Array(width * height)
    for (let i = 0; i < acc.length; i++) if (g.data[i] > 0) acc[i] += g.data[i]
    byGroup.set(group, acc)
  }
  const out = new Uint8Array(width * height)
  for (let i = 0; i < out.length; i++) {
    let best = 0
    let total = 0
    let bestGroup = null
    for (const [group, acc] of byGroup) {
      total += acc[i]
      if (acc[i] > best) {
        best = acc[i]
        bestGroup = group
      }
    }
    // menos de 100 ha cosechadas en ~85 km²: sin cultivo apreciable
    if (bestGroup && total >= 100) out[i] = GROUP_VALUE.get(bestGroup)
  }
  return writeGrid(out, { width, height, west: -180, north: 90, res, type: 'Byte', nodata: 0 }, dst)
}

export const crops = {
  id: 'crops',
  family: 'vegetacion',
  name: 'Cultivos',
  kind: 'raster',
  ord: 25,
  source,
  // grupos (los del mapa) y cada cultivo con su grupo (para elegirlo en la leyenda)
  legend: [
    ...CROP_GROUPS.map(({ key, label, color }) => ({ key, label, color, kind: 'group' })),
    ...Object.entries(CROPS).map(([code, [label, group]]) => ({ key: code.toLowerCase(), label, kind: 'item', group, color: CROP_GROUPS.find((g) => g.key === group).color })),
  ],

  async prepare() {
    const ed = await edition()
    await dominantGrid(ed)
  },

  /** Toneladas y hectáreas de cada cultivo por país y región. */
  async stats() {
    const ed = await edition()
    const z = await zones('coarse')
    const sets = []
    for (const [kind, scope] of [['P', 'tonnes'], ['H', 'ha']]) {
      const values = new Map()
      for (const code of Object.keys(CROPS)) {
        const g = await cropGrid(ed, kind, code)
        if (!g) continue
        const t = tally(z, (i) => (g.data[i] > 0 ? [code.toLowerCase(), g.data[i]] : null))
        for (const [zone, m] of t) {
          const cur = values.get(zone) ?? new Map()
          for (const [k, v] of m) cur.set(k, Math.round(v))
          values.set(zone, cur)
        }
      }
      sets.push({ scope, values })
    }
    // reparto de la superficie cosechada por grupo (lo que se ve en el mapa)
    const groupOf = new Map(Object.entries(CROPS).map(([code, [, group]]) => [code.toLowerCase(), group]))
    const shares = new Map()
    for (const [zone, m] of sets[1].values) {
      const total = [...m.values()].reduce((a, b) => a + b, 0)
      if (!total) continue
      const g = new Map()
      for (const [code, ha] of m) g.set(groupOf.get(code), (g.get(groupOf.get(code)) ?? 0) + ha)
      shares.set(zone, new Map([...g].map(([k, v]) => [k, Math.round((v / total) * 1000) / 1000])))
    }
    sets.push({ scope: 'share', values: shares })
    return sets
  },

  async render(frame) {
    const grid = await warpToFrame(await dominantGrid(await edition()), frame, 'crops', { resampling: 'near', type: 'Byte', nodata: 0, srcNodata: 0 })
    const rgba = paletteRgba(grid, new Map(CROP_GROUPS.map((g) => [g.value, hex(g.color)])))
    return writeLayerImage(crops, frame, rgba, { lossless: true })
  },
}

export const layers = [crops]
