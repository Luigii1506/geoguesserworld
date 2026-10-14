// HydroLAKES v1.0 (Messager et al. 2016, HydroSHEDS): lagos y embalses del
// mundo medidos (superficie, profundidad media, volumen, altitud). Completa
// los lagos de Wikidata y añade los grandes que faltan. Los polígonos de los
// mayores se usan en los mapas de cada país.

import path from 'node:path'
import { download } from '../lib/files.mjs'
import { toGeoJSON } from '../lib/gdal.mjs'
import { WORK } from '../lib/dirs.mjs'
import { polygonIndex, bboxOf, labelPoint, km } from '../lib/geom.mjs'
import { fold } from '../store.mjs'

export const meta = {
  id: 'hydrolakes',
  name: 'HydroLAKES v1.0',
  url: 'https://www.hydrosheds.org/products/hydrolakes',
  license: 'Libre (también comercial) citando la fuente',
  attribution: 'Messager, M.L. et al. (2016). Estimating the volume and age of water stored in global lakes. Nature Communications 7: 13603 (HydroLAKES, HydroSHEDS)',
  version: '1.0',
}

const URL = 'https://data.hydrosheds.org/file/hydrolakes/HydroLAKES_polys_v10_shp.zip'

/** Lagos de ≥ 5 km² o con nombre y ≥ 1 km² (de 1,4 millones, los que importan). */
export async function fetchAll(ctx) {
  const zip = await download('hydrosheds', URL, undefined, ctx)
  return toGeoJSON(`/vsizip/${zip}/HydroLAKES_polys_v10_shp/HydroLAKES_polys_v10.shp`, path.join(WORK, 'hydrolakes', 'lakes.geojson'), {
    where: "Lake_area >= 5 OR (Lake_name <> '' AND Lake_area >= 1)",
    select: 'Hylak_id,Lake_name,Country,Lake_type,Lake_area,Depth_avg,Vol_total,Elevation,Dis_avg,Res_time,Pour_long,Pour_lat',
    simplify: 0.003,
  })
}
export { fetchAll as download }

const GENERIC = /\b(lake|lago|lac|laguna|lagoa|reservoir|embalse|represa|presa|see|ozero|ozera|vodokhranilishche|nuur|nur|hu|ko|danau|tasik)\b/g
const core = (s) => fold(s).replace(GENERIC, ' ').replace(/\s+/g, ' ').trim()

export async function ingest(store, ctx) {
  const geo = await fetchAll(ctx)
  const lakes = geo.features.filter((f) => f.geometry)
  const idx = polygonIndex(lakes, 1)
  const known = store.db.prepare("SELECT id, name, name_en, lat, lng FROM entity WHERE kind = 'lake' AND lat IS NOT NULL").all()
  const linked = new Map() // Hylak_id → entidad
  // 1) lagos de Wikidata: el polígono que contiene su punto o, cerca, uno con el mismo nombre
  for (const k of known) {
    let hit = idx.lookup(k.lng, k.lat).sort((a, b) => b.properties.Lake_area - a.properties.Lake_area)[0]
    if (!hit) {
      const names = [core(k.name), core(k.name_en)].filter(Boolean)
      hit = lakes.find((f) => {
        const n = core(f.properties.Lake_name)
        if (!n || !names.includes(n)) return false
        const [x, y] = labelPoint(f.geometry)
        return km(k.lat, k.lng, y, x) < 60
      })
    }
    if (hit && !linked.has(hit.properties.Hylak_id)) linked.set(hit.properties.Hylak_id, k.id)
  }
  // 2) datos medidos y lagos grandes con nombre que faltaban
  let added = 0
  for (const f of lakes) {
    const p = f.properties
    let id = linked.get(p.Hylak_id)
    if (!id) {
      if (!p.Lake_name || p.Lake_area < 50) continue
      const [x, y] = labelPoint(f.geometry)
      const c = ctx.shapes.countryAt(x, y, 20)
      if (!c) continue
      id = store.entity({
        kind: 'lake', name: p.Lake_name, name_en: p.Lake_name, cc: c.cc, lat: y, lng: x,
        bbox: bboxOf(f.geometry).map((v) => v.toFixed(3)).join(','), xref: { hylak: p.Hylak_id },
      })
      store.relate(id, 'in_country', store.resolve('iso', c.cc), meta.id)
      added++
    } else store.xref(id, 'hylak', p.Hylak_id)
    if (p.Lake_type === 2) store.tag(id, 'embalse')
    // la superficie publicada (Wikidata) manda; HydroLAKES completa
    store.fact(id, 'area', Math.round(p.Lake_area * 10) / 10, { unit: 'km2', source: meta.id, keep: true })
    if (p.Depth_avg > 0) store.fact(id, 'depth_avg', p.Depth_avg, { unit: 'm', source: meta.id })
    if (p.Vol_total > 0) store.fact(id, 'volume', p.Vol_total, { unit: 'hm3', source: meta.id })
    if (p.Elevation != null) store.fact(id, 'elevation', p.Elevation, { unit: 'm', source: meta.id, keep: true })
    if (p.Res_time > 0) store.fact(id, 'residence_time', p.Res_time, { unit: 'días', source: meta.id })
  }
  ctx.log(`✓ ${linked.size} lagos de Wikidata con sus medidas · ${added} lagos grandes nuevos`)
}
