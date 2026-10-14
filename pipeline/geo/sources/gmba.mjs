// GMBA Mountain Inventory v2.0 (Snethlage et al. 2022, Scientific Data;
// EarthEnv): las cordilleras del mundo como polígonos jerárquicos
// (Andes → Cordillera Central → …). De aquí salen:
//   · entidades `range` (unidades básicas y la selección de las ~300 principales)
//   · `part_of` entre una sierra y su cordillera
//   · `in_range`: en qué sierra está cada montaña o volcán
// Los polígonos de las principales se usan en el mapa de cada país.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { download as fetchFile, rawDir } from '../lib/files.mjs'
import { createLlm } from '../../lib/llm.mjs'
import { toGeoJSON } from '../lib/gdal.mjs'
import { WORK } from '../lib/dirs.mjs'
import { polygonIndex, bboxOf, labelPoint } from '../lib/geom.mjs'

export const meta = {
  id: 'gmba',
  name: 'GMBA Mountain Inventory v2.0',
  url: 'https://www.earthenv.org/mountains',
  license: 'Descarga libre, citando la fuente',
  attribution: 'Snethlage, M.A. et al. (2022). GMBA Mountain Inventory v2. GMBA-EarthEnv. doi:10.48601/earthenv-t9k2-1407',
  version: '2.0',
}

const BASE = 'https://data.earthenv.org/mountains/standard/'
const FILES = { basic: 'GMBA_Inventory_v2.0_standard_basic', major: 'GMBA_Inventory_v2.0_standard_300' }

/** GeoJSON de las unidades básicas y de las principales (simplificados). */
export async function fetchAll(ctx) {
  const out = {}
  for (const [k, name] of Object.entries(FILES)) {
    const zip = await fetchFile(meta.id, `${BASE}${name}.zip`, undefined, ctx)
    out[k] = await toGeoJSON(`/vsizip/${zip}/${name}.shp`, path.join(WORK, 'gmba', `${k}.geojson`), {
      simplify: k === 'major' ? 0.01 : 0.004,
      select: 'GMBA_V2_ID,MapName,WikiDataUR,Hier_Lvl,Elev_Low,Elev_High,Area,Path_ID,CountryISO,Name_ES,Name_EN,Select_300',
    })
  }
  return out
}
const NAMES_ES = () => path.join(rawDir(meta.id), 'names_es.json')
/** Nombres traducidos (GMBA_V2_ID → nombre en español). */
export const namesEs = () => (existsSync(NAMES_ES()) ? JSON.parse(readFileSync(NAMES_ES(), 'utf8')) : {})

/** Descarga y traduce al español los nombres que GMBA solo trae en inglés (DeepSeek, con caché). */
export async function download(ctx) {
  const geo = await fetchAll(ctx)
  const done = existsSync(NAMES_ES()) ? JSON.parse(readFileSync(NAMES_ES(), 'utf8')) : {}
  const todo = [...geo.major.features, ...geo.basic.features].map((f) => f.properties)
    .filter((p, i, all) => !p.Name_ES && p.MapName && !done[p.GMBA_V2_ID] && all.findIndex((x) => x.GMBA_V2_ID === p.GMBA_V2_ID) === i)
  if (!todo.length) return ctx.log('nombres en español al día')
  const llm = createLlm({ concurrency: 6 })
  const batches = []
  for (let i = 0; i < todo.length; i += 100) batches.push(todo.slice(i, i + 100))
  await Promise.all(batches.map(async (b) => {
    const answer = await llm.json([
      { role: 'system', content: 'Traduces nombres de cordilleras y sierras al español como lo haría un atlas en español: usa el nombre español establecido si existe ("Rocky Mountains" → "Montañas Rocosas", "Western Ghats" → "Ghats occidentales", "Carpathians" → "Cárpatos"); traduce solo la parte genérica ("Mountains", "Range", "Hills", "Plateau" → "Montes", "Sierra", "Colinas", "Meseta") y conserva el nombre propio local si no hay forma española ("Sierra Nevada de Santa Marta" igual). Responde solo JSON: {"names": {"<id>": "<nombre>"}}.' },
      { role: 'user', content: JSON.stringify(Object.fromEntries(b.map((p) => [p.GMBA_V2_ID, p.MapName]))) },
    ], { maxTokens: 6000 })
    for (const [id, name] of Object.entries(answer?.names ?? {})) if (typeof name === 'string' && name.trim()) done[id] = name.trim()
  }))
  writeFileSync(NAMES_ES(), JSON.stringify(done, null, 1))
  ctx.log(`✓ ${Object.keys(done).length} nombres en español`)
}

const qidOf = (url) => url?.match(/Q\d+$/)?.[0] ?? null

export async function ingest(store, ctx) {
  const geo = await fetchAll(ctx)
  const es = namesEs()
  const ids = new Map() // GMBA_V2_ID → entidad
  const iso3 = (code) => store.resolve('iso3', code)
  const save = (f, major) => {
    const p = f.properties
    if (!f.geometry || ids.has(p.GMBA_V2_ID)) return
    const ccs = String(p.CountryISO ?? '').split(/[,;]\s*/).map((c) => c.trim()).filter(Boolean)
      .map((c) => store.get(iso3(c))?.cc).filter(Boolean)
    const lp = labelPoint(f.geometry)
    if (!lp) return
    const [x, y] = lp
    const id = store.entity({
      kind: 'range', name: p.Name_ES || es[p.GMBA_V2_ID] || p.MapName, name_en: p.Name_EN || p.MapName, cc: ccs[0] ?? ctx.shapes.countryAt(x, y, 50)?.cc, ccs,
      lat: y, lng: x, bbox: bboxOf(f.geometry).map((v) => v.toFixed(3)).join(','),
      tags: major ? ['cordillera_principal'] : [], xref: { wd: qidOf(p.WikiDataUR), gmba: p.GMBA_V2_ID },
      names: [['en', p.MapName]],
    })
    store.fact(id, 'elevation', p.Elev_High, { unit: 'm', source: meta.id, keep: true })
    store.fact(id, 'area', Math.round(p.Area), { unit: 'km2', source: meta.id, keep: true })
    for (const cc of ccs) store.relate(id, 'in_country', store.resolve('iso', cc), meta.id)
    ids.set(p.GMBA_V2_ID, id)
  }
  for (const f of geo.major.features) save(f, true)
  for (const f of geo.basic.features) save(f, false)

  // jerarquía: cada sierra, parte de su antecesor más cercano que tengamos
  for (const f of [...geo.basic.features, ...geo.major.features]) {
    const p = f.properties
    const chain = String(p.Path_ID ?? '').split('>').map((s) => Number(s.trim())).filter(Boolean)
    const self = ids.get(p.GMBA_V2_ID)
    for (let i = chain.length - 2; i >= 0; i--) {
      const parent = ids.get(chain[i])
      if (parent) {
        store.relate(self, 'part_of', parent, meta.id)
        break
      }
    }
  }

  // montañas y volcanes: en qué sierra (unidad básica) y en qué cordillera principal están
  const basic = polygonIndex(geo.basic.features.filter((f) => f.geometry))
  const major = polygonIndex(geo.major.features.filter((f) => f.geometry))
  const peaks = store.db.prepare("SELECT id, lat, lng FROM entity WHERE kind IN ('mountain', 'volcano') AND lat IS NOT NULL").all()
  let n = 0
  for (const pk of peaks) {
    const b = basic.lookup(pk.lng, pk.lat)[0]
    const m = major.lookup(pk.lng, pk.lat)[0]
    if (b) store.relate(pk.id, 'in_range', ids.get(b.properties.GMBA_V2_ID), meta.id)
    if (m && m !== b) store.relate(pk.id, 'in_range', ids.get(m.properties.GMBA_V2_ID), meta.id)
    if (b || m) n++
  }
  ctx.log(`✓ ${ids.size} cordilleras y sierras · ${n} de ${peaks.length} cumbres situadas en su sierra`)
}
