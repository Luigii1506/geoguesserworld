// Vectores de cada país en TopoJSON (atlas/vector/<cc>.json): contorno,
// estados o regiones, cordilleras principales (GMBA), llanuras, mesetas y
// desiertos (Natural Earth), ríos (HydroRIVERS) y lagos (HydroLAKES). Cada
// forma lleva el id de su entidad para abrir su ficha desde el mapa.
// Simplificado a la escala de la imagen del país.

import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { topology } from 'topojson-server'
import { presimplify, simplify } from 'topojson-simplify'
import { quantize } from 'topojson-client'
import { ASSETS, WORK } from '../lib/dirs.mjs'
import { gdal } from '../lib/gdal.mjs'
import { bboxOf, labelPoint, rewindForD3 } from '../lib/geom.mjs'
import { GEO_DB } from '../store.mjs'
import { shapes } from '../sources/naturalearth.mjs'
import * as gmba from '../sources/gmba.mjs'
import * as hydrolakes from '../sources/hydrolakes.mjs'

const RIVERS = path.join(WORK, 'hydrorivers', 'rivers5.gpkg')
const RIVERS_ZIP = () => path.join(WORK, '..', 'raw', 'hydrosheds', 'HydroRIVERS_v10_shp.zip')

const source = {
  id: 'hydrorivers',
  name: 'HydroRIVERS v1.0',
  url: 'https://www.hydrosheds.org/products/hydrorivers',
  license: 'Libre (también comercial) citando la fuente',
  attribution: 'Lehner, B., Grill G. (2013). Global river hydrography and network routing: baseline data and new approaches to study the world’s large river systems. Hydrological Processes 27(15): 2171–2186 (HydroRIVERS, HydroSHEDS)',
  version: '1.0',
}

/** Quita líneas y anillos vacíos o degenerados (un recorte puede dejarlos y rompen la topología). */
function dropEmpty(g) {
  if (!g) return null
  const line = (c) => c.length >= 2
  const ring = (c) => c.length >= 4
  const poly = (rings) => (rings.length && ring(rings[0]) ? rings.filter(ring) : null)
  switch (g.type) {
    case 'LineString': return line(g.coordinates) ? g : null
    case 'MultiLineString': { const c = g.coordinates.filter(line); return c.length ? { ...g, coordinates: c } : null }
    case 'Polygon': { const c = poly(g.coordinates); return c ? { ...g, coordinates: c } : null }
    case 'MultiPolygon': { const c = g.coordinates.map(poly).filter(Boolean); return c.length ? { ...g, coordinates: c } : null }
    case 'GeometryCollection': { const c = g.geometries.map(dropEmpty).filter(Boolean); return c.length ? { ...g, geometries: c } : null }
    default: return g
  }
}

const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]

let ctxCache = null
async function context(ctx) {
  if (ctxCache) return ctxCache
  if (!existsSync(RIVERS)) {
    mkdirSync(path.dirname(RIVERS), { recursive: true })
    await gdal('ogr2ogr', ['-f', 'GPKG', RIVERS, `/vsizip/${RIVERS_ZIP()}/HydroRIVERS_v10_shp/HydroRIVERS_v10.shp`, '-where', 'ORD_FLOW <= 5',
      '-select', 'HYRIV_ID,MAIN_RIV,ORD_FLOW,DIS_AV_CMS,UPLAND_SKM', '-simplify', '0.003', '-nln', 'rivers', '-nlt', 'LINESTRING'])
  }
  const s = await shapes()
  const ranges = (await gmba.fetchAll(ctx)).major.features.filter((f) => f.geometry)
  for (const f of ranges) f.bbox = bboxOf(f.geometry)
  const lakes = (await hydrolakes.fetchAll(ctx)).features.filter((f) => f.geometry)
  for (const f of lakes) f.bbox = bboxOf(f.geometry)
  const regions = JSON.parse(readFileSync(s.files.regions, 'utf8')).features.filter((f) => f.geometry)
  for (const f of regions) f.bbox = bboxOf(f.geometry)
  const marine = JSON.parse(readFileSync(s.files.marine, 'utf8')).features.filter((f) => f.geometry && f.properties.name)
  for (const f of marine) f.label = labelPoint(f.geometry)
  const db = existsSync(GEO_DB) ? new DatabaseSync(GEO_DB, { readOnly: true }) : null
  const resolve = db ? db.prepare('SELECT entity_id FROM entity_xref WHERE scheme = ? AND value = ?') : null
  const idOf = (scheme, value) => (resolve && value != null ? resolve.get(scheme, String(value))?.entity_id ?? null : null)
  const inCountry = db ? db.prepare("SELECT 1 FROM entity_country WHERE entity_id = ? AND cc = ?") : null
  ctxCache = { s, ranges, lakes, regions, marine, idOf, inCountry, rangeEs: gmba.namesEs() }
  return ctxCache
}

export const vector = {
  id: 'vector',
  family: 'base',
  name: 'Contornos, cordilleras, ríos y lagos',
  kind: 'vector',
  ord: 0,
  source,
  legend: [],
  concurrency: 2,

  async prepare(ctx) {
    await context(ctx)
  },

  async render(frame, ctx) {
    const c = await context(ctx)
    const { cc, bbox } = frame
    const span = frame.spanDeg
    const country = JSON.parse(readFileSync(frame.cutline, 'utf8')).features[0]
    const iso3 = c.s.countries.find((x) => x.cc === cc)?.props.ADM0_A3

    const admin1 = c.s.admin1
      .filter((a) => a.cc === cc)
      .map((a) => ({ type: 'Feature', properties: { id: c.idOf('ne', a.props.adm1_code), name: a.name }, geometry: a.geometry }))

    const ranges = c.ranges
      .filter((f) => overlaps(f.bbox, bbox) && (String(f.properties.CountryISO ?? '').includes(iso3) || c.inCountry?.get(c.idOf('gmba', f.properties.GMBA_V2_ID), cc)))
      .map((f) => ({ type: 'Feature', properties: { id: c.idOf('gmba', f.properties.GMBA_V2_ID), name: f.properties.Name_ES || c.rangeEs[f.properties.GMBA_V2_ID] || f.properties.MapName, ele: f.properties.Elev_High }, geometry: f.geometry }))

    const regions = c.regions
      .filter((f) => overlaps(f.bbox, bbox))
      .map((f) => {
        const p = f.properties
        const id = c.idOf('ne', `region:${p.NE_ID ?? p.ne_id}`)
        if (!id || !c.inCountry?.get(id, cc)) return null
        const cls = p.FEATURECLA ?? p.featurecla
        if (!/Plain|Plateau|Desert|Basin|Lowland|Valley|Depression|Tundra|Wetlands|Delta/.test(cls)) return null
        return { type: 'Feature', properties: { id, name: p.NAME_ES || p.name_es || p.NAME || p.name, kind: cls }, geometry: f.geometry }
      })
      .filter(Boolean)

    // mares, golfos y estrechos que bañan el país: solo su nombre, en su punto de etiqueta
    const [w0, s0, e0, n0] = bbox
    const seas = c.marine
      .filter((f) => f.label && f.label[0] >= w0 && f.label[0] <= e0 && f.label[1] >= s0 && f.label[1] <= n0)
      .map((f) => {
        const p = f.properties
        const id = c.idOf('wd', p.wikidataid) ?? c.idOf('ne', `marine:${p.ne_id}`)
        if (!id || !c.inCountry?.get(id, cc)) return null
        return { type: 'Feature', properties: { id, name: p.name_es || p.name, kind: p.featurecla, rank: p.scalerank }, geometry: { type: 'Point', coordinates: f.label } }
      })
      .filter(Boolean)

    // lagos: los grandes en países grandes; en los pequeños, también los medianos
    const minLake = span > 25 ? 150 : span > 8 ? 20 : 2
    const lakes = c.lakes
      .filter((f) => overlaps(f.bbox, bbox) && f.properties.Lake_area >= minLake)
      .filter((f) => {
        const p = labelPoint(f.geometry)
        return p && c.s.countryAt(p[0], p[1], 5)?.cc === cc
      })
      .map((f) => ({ type: 'Feature', properties: { id: c.idOf('hylak', f.properties.Hylak_id), name: f.properties.Lake_name || null, area: f.properties.Lake_area }, geometry: f.geometry }))

    // ríos dentro del país, más o menos caudalosos según su tamaño
    const maxOrd = span > 25 ? 3 : span > 10 ? 4 : 5
    const tmp = path.join(WORK, 'frames', 'rivers', `${cc}.geojson`)
    mkdirSync(path.dirname(tmp), { recursive: true })
    rmSync(tmp, { force: true })
    // -clipsrc ya filtra por el contorno (con -spat a la vez, GDAL 3.13 rechaza los argumentos)
    await gdal('ogr2ogr', ['-f', 'GeoJSON', tmp, RIVERS, 'rivers', '-where', `ORD_FLOW <= ${maxOrd}`, '-clipsrc', frame.cutline, '-lco', 'COORDINATE_PRECISION=4'])
    const rivers = (existsSync(tmp) ? JSON.parse(readFileSync(tmp, 'utf8')).features : []).map((f) => ({
      type: 'Feature', properties: { ord: f.properties.ORD_FLOW, q: Math.round(f.properties.DIS_AV_CMS) }, geometry: f.geometry,
    }))
    rmSync(tmp, { force: true })

    const fc = (features) => ({
      type: 'FeatureCollection',
      features: features.map((f) => ({ ...f, geometry: rewindForD3(dropEmpty(f.geometry)) })).filter((f) => f.geometry),
    })
    // simplificar a la escala de la imagen (área de triángulo ~ un tercio de píxel², en grados) y cuantizar
    const degPerPx = (bbox[2] - bbox[0]) / frame.width
    const build = (opts) => {
      const topo = topology({
        country: fc([country]), admin1: fc(admin1), ranges: fc(ranges), regions: fc(regions), seas: fc(seas),
        lakes: fc(lakes.filter((f) => f.properties.area >= minLake * opts.lakeFactor)),
        rivers: fc(rivers.filter((f) => f.properties.ord <= maxOrd - opts.riverDrop)),
      })
      return JSON.stringify(quantize(simplify(presimplify(topo), (degPerPx * opts.px) ** 2 * 0.35), opts.q))
    }
    // detalle (al acercar) y versión ligera para la vista inicial: ~2 px de tolerancia, solo
    // los ríos más caudalosos y los lagos grandes (unas 3–4 veces menos peso)
    const json = build({ px: 1, lakeFactor: 1, riverDrop: 0, q: 1e5 })
    const lite = build({ px: 2.2, lakeFactor: 4, riverDrop: 1, q: 2e4 })
    const rel = `atlas/vector/${cc}.json`
    const file = path.join(ASSETS, rel)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, json)
    writeFileSync(file.replace(/\.json$/, '.lite.json'), lite)
    return {
      layer_id: 'vector', cc, path: rel, bbox: bbox.join(','), width: frame.width, height: frame.height,
      bytes: statSync(file).size, hash: createHash('sha1').update(json).digest('hex').slice(0, 12),
    }
  },
}

export const layers = [vector]
