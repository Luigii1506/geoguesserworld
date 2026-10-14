// GeoNames (CC BY 4.0): todas las localidades del mundo con más de 1.000
// habitantes (cities1000), con su región admin1, población, altitud, nombres
// en español/inglés y su QID de Wikidata (alternateNames, idioma "wkdt").

import { createReadStream, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import path from 'node:path'
import { download, unzip } from '../lib/files.mjs'
import { km } from '../lib/geom.mjs'
import { fold } from '../store.mjs'

export const meta = {
  id: 'geonames',
  name: 'GeoNames',
  url: 'https://www.geonames.org',
  license: 'CC BY 4.0',
  attribution: 'GeoNames (geonames.org), CC BY 4.0',
}

const BASE = 'https://download.geonames.org/export/dump/'

export async function fetchAll(ctx) {
  const cities = unzip(await download(meta.id, `${BASE}cities1000.zip`, undefined, ctx))
  const alt = unzip(await download(meta.id, `${BASE}alternateNamesV2.zip`, undefined, ctx))
  return { cities: path.join(cities, 'cities1000.txt'), alt: path.join(alt, 'alternateNamesV2.txt') }
}
export { fetchAll as download }

// lugares que no son una localidad viva: barrios (PPLX), históricos, abandonados, destruidos
const SKIP = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH'])
// capitales de país y de región
const SEAT = new Set(['PPLC', 'PPLA', 'PPLG'])

async function* lines(file) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity })
  for await (const l of rl) yield l
}

/** Nombres en español e inglés y QID de cada localidad, leyendo el archivo de nombres alternativos. */
async function alternateNames(file, ids) {
  const out = new Map()
  if (!existsSync(file)) return out
  for await (const l of lines(file)) {
    const t = l.split('\t')
    const id = Number(t[1])
    if (!ids.has(id)) continue
    const lang = t[2]
    if (lang !== 'es' && lang !== 'en' && lang !== 'wkdt') continue
    // ni históricos ni coloquiales
    if (t[6] === '1' || t[7] === '1') continue
    const rec = out.get(id) ?? {}
    if (lang === 'wkdt') rec.wd ??= t[3]
    else {
      const preferred = t[4] === '1'
      if (preferred || !rec[lang]) rec[lang] = t[3]
      ;(rec[`${lang}_all`] ??= []).push(t[3])
    }
    out.set(id, rec)
  }
  return out
}

export async function ingest(store, ctx) {
  const files = await fetchAll(ctx)
  const rows = []
  for await (const l of lines(files.cities)) {
    const t = l.split('\t')
    if (SKIP.has(t[7])) continue
    rows.push({
      id: Number(t[0]), name: t[1], lat: Number(t[4]), lng: Number(t[5]), code: t[7], cc: t[8].toLowerCase(), admin1: t[10],
      pop: Number(t[14]) || 0, ele: t[15] ? Number(t[15]) : null, dem: Number(t[16]),
    })
  }
  ctx.log(`${rows.length} localidades; leyendo nombres en español e inglés…`)
  const names = await alternateNames(files.alt, new Set(rows.map((r) => r.id)))

  // localidades que ya existen sin QID ni id de GeoNames (las que citan las pistas):
  // la misma localidad = mismo nombre en el país a menos de 15 km
  const byName = new Map()
  for (const e of store.db.prepare("SELECT id, cc, name, name_en, lat, lng FROM entity WHERE kind IN ('city', 'town', 'other', 'region') AND lat IS NOT NULL").all()) {
    for (const n of new Set([fold(e.name), fold(e.name_en)])) {
      if (!n) continue
      const k = `${e.cc}|${n}`
      if (!byName.has(k)) byName.set(k, [])
      byName.get(k).push(e)
    }
  }
  const nearby = (r, n) => {
    for (const name of [n.es, n.en, r.name]) {
      const hit = (byName.get(`${r.cc}|${fold(name)}`) ?? []).find((e) => km(e.lat, e.lng, r.lat, r.lng) < 15)
      if (hit) return hit.id
    }
    return null
  }

  let created = 0
  let merged = 0
  for (const r of rows) {
    const n = names.get(r.id) ?? {}
    const existed = store.resolve('gn', r.id) ?? (n.wd ? store.resolve('wd', n.wd) : null) ?? nearby(r, n)
    const kind = r.pop >= 50000 || SEAT.has(r.code) ? 'city' : 'town'
    const admin1 = r.admin1 ? store.resolve('gna1', `${r.cc.toUpperCase()}.${r.admin1}`) : null
    const id = store.entity({
      id: existed ?? undefined, kind, name: n.es ?? n.en ?? r.name, name_en: n.en ?? r.name, cc: r.cc, admin1, lat: r.lat, lng: r.lng,
      tags: r.code === 'PPLC' ? ['capital'] : r.code === 'PPLA' ? ['capital_region'] : [],
      xref: { wd: n.wd, gn: r.id },
      names: [['local', r.name], ...(n.es_all ?? []).map((x) => ['es', x]), ...(n.en_all ?? []).map((x) => ['en', x])],
    })
    // la cifra de Wikidata (más reciente) tiene prioridad; GeoNames completa lo que falta
    if (r.pop > 0) store.fact(id, 'population', r.pop, { scope: 'city', source: meta.id, keep: true })
    const ele = r.ele ?? (r.dem > -9999 ? r.dem : null)
    if (ele != null) store.fact(id, 'elevation', ele, { unit: 'm', source: meta.id, keep: true })
    store.relate(id, 'in_country', store.resolve('iso', r.cc), meta.id)
    if (admin1) {
      store.relate(id, 'in_admin1', admin1, meta.id)
      if (!store.get(id).admin1) store.db.prepare('UPDATE entity SET admin1 = ? WHERE id = ?').run(admin1, id)
    }
    if (existed) merged++
    else created++
  }
  ctx.log(`✓ ${merged} localidades completadas · ${created} nuevas`)
}
