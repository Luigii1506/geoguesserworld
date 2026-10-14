// Natural Earth (dominio público): países, regiones admin1 y regiones físicas
// con nombre (llanuras, mesetas, desiertos, cuencas, cordilleras…).
// Da a cada punto su país y su región, y los contornos para las capas.

import { readFileSync } from 'node:fs'
import { download } from '../lib/files.mjs'
import { polygonIndex, bboxOf, labelPoint, areaKm2, eachCoord } from '../lib/geom.mjs'

export const meta = {
  id: 'naturalearth',
  name: 'Natural Earth',
  url: 'https://www.naturalearthdata.com',
  license: 'Dominio público',
  attribution: 'Made with Natural Earth',
  version: '5.1.2',
}

const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/'
const FILES = {
  admin0: 'ne_10m_admin_0_countries.geojson',
  admin1: 'ne_10m_admin_1_states_provinces.geojson',
  regions: 'ne_10m_geography_regions_polys.geojson',
  marine: 'ne_10m_geography_marine_polys.geojson',
}
const LOCAL = { admin1: 'admin1.geojson' }

export async function fetchAll() {
  const out = {}
  for (const [k, f] of Object.entries(FILES)) out[k] = await download('naturalearth', BASE + f, LOCAL[k] ?? f)
  return out
}
export { fetchAll as download }

let cache = null
/**
 * Contornos cargados una vez: países y regiones con su índice espacial.
 * countries: [{ cc, qid, name, geometry, bbox }]
 * admin1:    [{ id (QID o ne:<adm1_code>), cc, name, geometry, bbox, props }]
 */
export async function shapes() {
  if (cache) return cache
  const files = await fetchAll()
  const read = (f) => JSON.parse(readFileSync(f, 'utf8')).features
  const countries = read(files.admin0)
    .map((f) => {
      const p = f.properties
      const iso = [p.ISO_A2_EH, p.ISO_A2, p.WB_A2].find((x) => /^[A-Z]{2}$/.test(x ?? ''))
      return iso ? { cc: iso.toLowerCase(), qid: p.WIKIDATAID ?? null, name: p.NAME_ES ?? p.NAME, name_en: p.NAME_EN ?? p.NAME, geometry: f.geometry, props: p } : null
    })
    .filter(Boolean)
    // un código, un país: Natural Earth repite códigos en territorios menores (Clipperton,
    // Baikonur, islas australianas…); se queda la parte principal (HOMEPART) o la mayor
    .sort((a, b) => (b.props.HOMEPART === 1) - (a.props.HOMEPART === 1) || (b.props.POP_EST ?? 0) - (a.props.POP_EST ?? 0))
    .filter((c, i, all) => all.findIndex((x) => x.cc === c.cc) === i)
  const admin1 = read(files.admin1)
    .map((f) => {
      const p = f.properties
      const cc = (p.iso_a2 ?? '').toLowerCase()
      if (!/^[a-z]{2}$/.test(cc) || !f.geometry) return null
      return { id: p.wikidataid || `ne:${p.adm1_code}`, cc, name: p.name_es || p.name || p.name_en || p.gn_name || p.woe_name || p.adm1_code, name_en: p.name_en || p.name || p.gn_name, geometry: f.geometry, props: p }
    })
    .filter(Boolean)
  const countryIdx = polygonIndex(countries)
  const admin1Idx = polygonIndex(admin1)
  cache = {
    files,
    countries,
    admin1,
    countryAt: (lng, lat, maxKm = 15) => countryIdx.find(lng, lat, { maxKm }),
    /** región admin1 de un punto; si se sabe el país, solo regiones de ese país */
    admin1At: (lng, lat, cc, maxKm = 15) => admin1Idx.find(lng, lat, { maxKm, filter: cc ? (a) => a.cc === cc : undefined }),
  }
  return cache
}

// regiones físicas de Natural Earth → tipo propio
const REGION_KIND = {
  'Range/mtn': 'range', Plain: 'plain', Plateau: 'plateau', Desert: 'desert', Basin: 'basin', Lowland: 'plain',
  Valley: 'valley', Depression: 'basin', Foothills: 'range', Tundra: 'plain', Wetlands: 'wetland', Delta: 'delta',
  Peninsula: 'peninsula', 'Pen/cape': 'peninsula', 'Island group': 'island', Isthmus: 'peninsula', Gorge: 'valley',
  Coast: 'coast', Geoarea: 'region',
}

const MARINE_KIND = {
  ocean: 'ocean', sea: 'sea', generic: 'sea', gulf: 'gulf', bay: 'gulf', sound: 'gulf', fjord: 'gulf', inlet: 'gulf', lagoon: 'gulf',
  strait: 'strait', channel: 'strait',
}

export async function ingest(store, ctx) {
  const s = await shapes()
  const staging = ctx.staging
  const known = new Map(staging.prepare('SELECT * FROM countries').all().map((c) => [c.code, c]))

  // países
  let nc = 0
  for (const c of s.countries) {
    const row = known.get(c.cc)
    const [w, so, e, n] = (c.bbox ??= bboxOf(c.geometry))
    const lp = labelPoint(c.geometry)
    const id = store.entity({
      id: c.qid ?? `iso:${c.cc}`, kind: 'country', name: row?.name_es ?? c.name, name_en: row?.name ?? c.name_en, cc: c.cc,
      lat: row?.lat ?? lp?.[1], lng: row?.lng ?? lp?.[0], bbox: [w, so, e, n].map((v) => v.toFixed(3)).join(','),
      xref: { wd: c.qid, iso: c.cc, iso3: (row?.iso3 ?? c.props.ISO_A3_EH)?.toUpperCase() }, names: [['local', row?.official_name]],
    })
    if (row?.population) store.fact(id, 'population', row.population, { scope: 'admin', source: 'countries' })
    store.fact(id, 'area', row?.area_km2 ?? Math.round(areaKm2(c.geometry)), { unit: 'km2', source: row?.area_km2 ? 'countries' : meta.id })
    nc++
  }
  // países y territorios de la app sin contorno propio en Natural Earth (Gibraltar, Svalbard…)
  for (const [cc, row] of known) {
    if (store.resolve('iso', cc)) continue
    store.entity({ id: `iso:${cc}`, kind: 'country', name: row.name_es ?? row.name, name_en: row.name, cc, lat: row.lat, lng: row.lng, xref: { iso: cc, iso3: row.iso3 } })
  }
  // tabla de países: continente, bandera y si tiene guía de GeoGuessr
  const guides = new Set(staging.prepare('SELECT DISTINCT lower(country_code) cc FROM clusters WHERE country_code IS NOT NULL').all().map((r) => r.cc))
  for (const cc of new Set([...known.keys(), ...s.countries.map((c) => c.cc)])) {
    const id = store.resolve('iso', cc)
    const e = store.get(id)
    const row = known.get(cc)
    store.country({ cc, entity_id: id, name: e.name, name_en: e.name_en, continent: row?.region ?? null, subregion: row?.subregion ?? null, flag: row?.flag ?? null, guide: guides.has(cc) })
  }

  // regiones admin1
  for (const a of s.admin1) {
    const [w, so, e, n] = (a.bbox ??= bboxOf(a.geometry))
    const p = a.props
    const lp = labelPoint(a.geometry)
    const id = store.entity({
      id: a.id, kind: 'admin1', name: a.name, name_en: a.name_en, cc: a.cc,
      lat: p.latitude ?? lp?.[1], lng: p.longitude ?? lp?.[0], bbox: [w, so, e, n].map((v) => v.toFixed(3)).join(','),
      descr: p.type || p.type_en || null, tags: ['admin1'],
      xref: { wd: p.wikidataid, ne: p.adm1_code, iso2: p.iso_3166_2, gna1: p.gn_a1_code, gn: p.gn_id > 0 ? p.gn_id : null },
      names: [['local', p.name_local], ...String(p.name_alt ?? '').split('|').map((x) => ['alt', x])],
    })
    store.fact(id, 'area', Math.round(areaKm2(a.geometry)), { unit: 'km2', source: meta.id, keep: true })
    store.relate(id, 'in_country', store.resolve('iso', a.cc), meta.id)
  }

  // regiones físicas con nombre
  let nr = 0
  for (const f of JSON.parse(readFileSync(s.files.regions, 'utf8')).features) {
    const p = f.properties
    const kind = REGION_KIND[p.FEATURECLA ?? p.featurecla]
    if (!kind || !f.geometry) continue
    const geometry = f.geometry
    const bbox = bboxOf(geometry)
    const lp = labelPoint(geometry)
    // países que toca: los que contienen algún punto de muestra del polígono
    const ccs = new Set()
    const pts = [lp]
    const ring = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates.flatMap((r) => r[0])
    const step = Math.max(1, Math.floor(ring.length / 60))
    for (let i = 0; i < ring.length; i += step) pts.push(ring[i])
    for (const [x, y] of pts) {
      const c = s.countryAt(x, y, 0)
      if (c) ccs.add(c.cc)
    }
    if (!ccs.size) continue
    const name = p.NAME_ES || p.name_es || p.NAME || p.name
    const qid = p.WIKIDATAID || p.wikidataid || null
    const id = store.entity({
      id: qid ?? `ne:${p.NE_ID ?? p.ne_id}`, kind, name, name_en: p.NAME_EN || p.name_en || p.NAME || p.name,
      cc: [...ccs][0], ccs: [...ccs], lat: lp[1], lng: lp[0], bbox: bbox.map((v) => v.toFixed(3)).join(','),
      xref: { wd: qid, ne: `region:${p.NE_ID ?? p.ne_id}` },
    })
    store.fact(id, 'area', Math.round(areaKm2(geometry)), { unit: 'km2', source: meta.id, keep: true })
    for (const cc of ccs) store.relate(id, 'in_country', store.resolve('iso', cc), meta.id)
    nr++
  }
  // mares, golfos, bahías y estrechos, con los países que bañan (a menos de 40 km)
  const { countriesNear, zones } = await import('../layers/grid.mjs')
  const z = await zones('fine')
  let nm = 0
  for (const f of JSON.parse(readFileSync(s.files.marine, 'utf8')).features) {
    const p = f.properties
    const kind = MARINE_KIND[p.featurecla]
    if (!kind || !f.geometry || !p.name) continue
    const lp = labelPoint(f.geometry)
    if (!lp) continue
    const near = new Set()
    let k = 0
    eachCoord(f.geometry, ([x, y]) => {
      if (k++ % 25 === 0) for (const cc of countriesNear(z, x, y, 40)) near.add(cc)
    })
    const list = [...near]
    const id = store.entity({
      id: p.wikidataid || `ne:marine:${p.ne_id}`, kind, name: p.name_es || p.name, name_en: p.name_en || p.name,
      cc: list[0] ?? null, ccs: list, lat: lp[1], lng: lp[0], bbox: bboxOf(f.geometry).map((v) => v.toFixed(3)).join(','),
      xref: { wd: p.wikidataid, ne: `marine:${p.ne_id}` }, names: [['alt', p.namealt]],
    })
    store.fact(id, 'area', Math.round(areaKm2(f.geometry)), { unit: 'km2', source: meta.id, keep: true })
    for (const cc of list) store.relate(id, 'in_country', store.resolve('iso', cc), meta.id)
    nm++
  }
  ctx.log(`✓ ${nc} países · ${s.admin1.length} regiones admin1 · ${nr} regiones físicas · ${nm} mares, golfos y estrechos`)
}
