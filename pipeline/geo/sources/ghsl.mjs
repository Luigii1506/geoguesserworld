// GHSL Urban Centre Database R2024A (Comisión Europea, JRC; CC BY 4.0): los
// 11.422 centros urbanos del mundo delimitados con el mismo criterio (densidad
// de población) y su población en 2025. Es la cifra comparable entre países:
// el municipio de Guadalajara y su área urbana son cosas distintas.
//
// Crea entidades `urban` y une cada localidad de dentro con `in_urban`; la
// localidad principal recibe además `population` con ámbito `urban`.

import path from 'node:path'
import { download } from '../lib/files.mjs'
import { toGeoJSON } from '../lib/gdal.mjs'
import { WORK } from '../lib/dirs.mjs'
import { polygonIndex, bboxOf, labelPoint } from '../lib/geom.mjs'
import { fold } from '../store.mjs'

export const meta = {
  id: 'ghsl',
  name: 'GHSL Urban Centre Database (R2024A)',
  url: 'https://human-settlement.emergency.copernicus.eu/ghs_ucdb_2024.php',
  license: 'CC BY 4.0',
  attribution: 'European Commission, Joint Research Centre: GHS Urban Centre Database R2024A (CC BY 4.0)',
  version: 'R2024A V1.2',
}

const URL =
  'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_UCDB_GLOBE_R2024A/GHS_UCDB_THEME_GLOBE_R2024A/GHS_UCDB_THEME_GENERAL_CHARACTERISTICS_GLOBE_R2024A/V1-2/GHS_UCDB_THEME_GENERAL_CHARACTERISTICS_GLOBE_R2024A_V1_2.zip'

async function fetchAll(ctx) {
  const zip = await download(meta.id, URL, undefined, ctx)
  return toGeoJSON(
    `/vsizip/${zip}/GHS_UCDB_THEME_GENERAL_CHARACTERISTICS_GLOBE_R2024A.gpkg`,
    path.join(WORK, 'ghsl', 'ucdb.geojson'),
    { layer: 'GHSL_UCDB_THEME_GENERAL_CHARACTERISTICS_GLOBE_R2024A', simplify: 0.002 },
  )
}
export { fetchAll as download }

export async function ingest(store, ctx) {
  const geo = await fetchAll(ctx)
  const ne = ctx.shapes
  const db = store.db
  const urban = []
  for (const f of geo.features) {
    const p = f.properties
    const pop = Math.round(p.GC_POP_TOT_2025 ?? 0)
    if (!f.geometry || pop < 50000) continue
    const [x, y] = labelPoint(f.geometry)
    const c = ne.countryAt(x, y, 30)
    if (!c) continue
    const name = p.GC_UCN_MAI_2025 && p.GC_UCN_MAI_2025 !== '-' ? p.GC_UCN_MAI_2025 : null
    urban.push({ id: p.ID_UC_G0, name, alt: String(p.GC_UCN_LIS_2025 ?? '').split(';').map((s) => s.trim()).filter((s) => s && s !== '-'), cc: c.cc, pop, area: p.GC_UCA_KM2_2025, geometry: f.geometry, x, y })
  }
  // localidades candidatas a "principal" de cada área (las de más población dentro)
  const towns = db
    .prepare(`SELECT e.id, e.name, e.name_en, e.lat, e.lng, e.cc,
        (SELECT MAX(value) FROM fact WHERE entity_id = e.id AND key = 'population' AND scope = 'city') AS pop
      FROM entity e WHERE e.kind IN ('city', 'town') AND e.lat IS NOT NULL`)
    .all()
  const idx = polygonIndex(urban)
  const members = new Map()
  for (const t of towns) {
    const u = idx.lookup(t.lng, t.lat)[0]
    if (!u) continue
    if (!members.has(u.id)) members.set(u.id, [])
    members.get(u.id).push(t)
  }

  let n = 0
  let named = 0
  for (const u of urban) {
    const inside = (members.get(u.id) ?? []).sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))
    // principal: la que se llama como el área (Guadalajara) o, si no, la más poblada
    const main = (u.name && inside.find((t) => fold(t.name) === fold(u.name) || fold(t.name_en) === fold(u.name))) ?? inside[0]
    const display = main?.name ?? u.name
    if (!display) continue
    const bbox = bboxOf(u.geometry)
    const id = store.entity({
      kind: 'urban', name: `Área urbana de ${display}`, name_en: `${u.name ?? main?.name_en ?? display} urban area`, cc: u.cc,
      lat: main?.lat ?? u.y, lng: main?.lng ?? u.x, bbox: bbox.map((v) => v.toFixed(3)).join(','),
      xref: { ucdb: u.id }, names: [['es', display], ...u.alt.map((a) => ['alt', a])],
    })
    store.fact(id, 'population', u.pop, { scope: 'urban', year: 2025, source: meta.id })
    store.fact(id, 'area', u.area, { unit: 'km2', source: meta.id })
    store.relate(id, 'in_country', store.resolve('iso', u.cc), meta.id)
    if (main) {
      // la ciudad conserva su cifra municipal y gana la del área urbana, comparable
      store.fact(main.id, 'population', u.pop, { scope: 'urban', year: 2025, source: meta.id })
      store.relate(main.id, 'center_of', id, meta.id)
      named++
    }
    for (const t of inside) store.relate(t.id, 'in_urban', id, meta.id)
    n++
  }
  ctx.log(`✓ ${n} áreas urbanas de más de 50.000 hab. (${named} con su ciudad principal)`)
}
