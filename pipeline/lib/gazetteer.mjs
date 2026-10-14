// Nombres de las divisiones de primer nivel de cada país (estados, provincias,
// naciones constituyentes…), de Natural Earth admin-1 (dominio público).
// Se usan para deducir la región de una pista que la nombra sin que la fuente
// la haya marcado. El GeoJSON (40 MB) se reduce una vez a data/admin1-names.json.
//
//   data/raw/naturalearth/admin1.geojson   ← ne_10m_admin_1_states_provinces (v5.1.2)

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR, RAW_DIR } from './paths.mjs'

const SOURCE = path.join(RAW_DIR, 'naturalearth', 'admin1.geojson')
const CACHE = path.join(DATA_DIR, 'admin1-names.json')
// macrorregiones genéricas que solo meterían ruido ("East", "South West"…)
const GENERIC = /^(north|south|east|west|central|centre|center|eastern|western|northern|southern|middle)( ?(north|south|east|west|eastern|western))?$/i

let names = null

/** { cc: [nombre, …] } — nombres en inglés, español, local y alternativos. */
export function admin1Names() {
  if (names) return names
  if (existsSync(CACHE)) return (names = JSON.parse(readFileSync(CACHE, 'utf8')))
  if (!existsSync(SOURCE)) return (names = {})
  const geo = JSON.parse(readFileSync(SOURCE, 'utf8'))
  const out = {}
  for (const f of geo.features) {
    const p = f.properties
    const cc = (p.iso_a2 ?? '').toLowerCase()
    if (!/^[a-z]{2}$/.test(cc)) continue
    const list = [p.name, p.name_en, p.name_es, p.geonunit, ...(p.name_alt ?? '').split('|'), p.region]
      .map((n) => (n ?? '').trim())
      .filter((n) => n.length >= 4 && !GENERIC.test(n))
    ;(out[cc] ??= new Set()).add(...list)
    for (const n of list) out[cc].add(n)
  }
  names = Object.fromEntries(Object.entries(out).map(([cc, set]) => [cc, [...set]]))
  writeFileSync(CACHE, JSON.stringify(names))
  return names
}
