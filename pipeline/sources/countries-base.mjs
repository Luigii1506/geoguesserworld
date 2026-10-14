// Base global de países a partir de datos abiertos:
//   · mledoze/countries (ODbL): nombres, capital, idiomas, monedas, prefijos,
//     dominios, región, fronteras, nombres alternativos, traducción al español.
//   · Wikidata (CC0): población y lado de circulación.
// No genera pistas: llena la tabla countries, que usan todos los demás
// adaptadores para resolver nombres.

import { fetchJson } from '../lib/fetch.mjs'
import { tx, now } from '../lib/db.mjs'

export const meta = {
  id: 'countries',
  name: 'Base global de países',
  homepage: 'https://github.com/mledoze/countries',
  license: 'mledoze/countries: ODbL 1.0 · Wikidata: CC0',
  method: 'Dataset JSON + consulta SPARQL',
}

const MLEDOZE = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json'

const SPARQL = `
SELECT ?iso (MAX(?pop) AS ?population) (SAMPLE(?sideLabel) AS ?side) WHERE {
  ?c wdt:P297 ?iso .
  OPTIONAL { ?c wdt:P1082 ?pop . }
  OPTIONAL { ?c wdt:P1622 ?s . ?s rdfs:label ?sideLabel . FILTER(LANG(?sideLabel) = "en") }
} GROUP BY ?iso`

export async function run(ctx) {
  const list = await fetchJson(ctx, MLEDOZE, { minIntervalMs: 0 })
  const wdUrl = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(SPARQL)}`
  const wd = await fetchJson(ctx, wdUrl, {
    headers: { 'user-agent': 'GeoMastery/0.1 (proyecto personal educativo)', accept: 'application/sparql-results+json' },
  })

  const extra = new Map()
  for (const b of wd.results.bindings) {
    const side = b.side?.value?.toLowerCase()
    extra.set(b.iso.value.toLowerCase(), {
      population: b.population ? Math.round(Number(b.population.value)) : null,
      side: side?.includes('left') ? 'left' : side?.includes('right') ? 'right' : null,
    })
  }

  const cca3to2 = new Map(list.map((c) => [c.cca3, c.cca2.toLowerCase()]))
  const cols = ctx.db.prepare('PRAGMA table_info(countries)').all().map((c) => c.name)
  if (!cols.includes('demonyms_en')) ctx.db.exec('ALTER TABLE countries ADD COLUMN demonyms_en TEXT')
  if (!cols.includes('demonyms_es')) ctx.db.exec('ALTER TABLE countries ADD COLUMN demonyms_es TEXT')
  // código numérico ISO 3166 (los mapas mundiales, como world-atlas, identifican así los países)
  if (!cols.includes('ccn3')) ctx.db.exec('ALTER TABLE countries ADD COLUMN ccn3 TEXT')
  const setDemonyms = ctx.db.prepare('UPDATE countries SET demonyms_en = ?, ccn3 = ? WHERE code = ?')
  const stmt = ctx.db.prepare(`
    INSERT INTO countries (code, iso3, name, official_name, name_es, region, subregion, capital,
      lat, lng, area_km2, population, driving_side, flag, independent, landlocked,
      languages, currencies, calling_codes, tlds, borders, alt_names, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET iso3=excluded.iso3, name=excluded.name,
      official_name=excluded.official_name, name_es=excluded.name_es, region=excluded.region,
      subregion=excluded.subregion, capital=excluded.capital, lat=excluded.lat, lng=excluded.lng,
      area_km2=excluded.area_km2, population=excluded.population,
      driving_side=excluded.driving_side, flag=excluded.flag, independent=excluded.independent,
      landlocked=excluded.landlocked, languages=excluded.languages, currencies=excluded.currencies,
      calling_codes=excluded.calling_codes, tlds=excluded.tlds, borders=excluded.borders,
      alt_names=excluded.alt_names, updated_at=excluded.updated_at`)

  const ts = now()
  tx(ctx.db, () => {
    for (const c of list) {
      const code = c.cca2.toLowerCase()
      const e = extra.get(code) ?? {}
      const callingCodes = (c.idd?.suffixes ?? []).map((s) => `${c.idd.root}${s}`)
      const altNames = [
        ...(c.altSpellings ?? []),
        ...Object.values(c.name?.native ?? {}).flatMap((n) => [n.common, n.official]),
      ].filter(Boolean)
      stmt.run(
        code, c.cca3, c.name.common, c.name.official, c.translations?.spa?.common ?? null,
        c.region ?? null, c.subregion ?? null, (c.capital ?? [])[0] ?? null,
        c.latlng?.[0] ?? null, c.latlng?.[1] ?? null, c.area ?? null,
        e.population ?? null, e.side ?? null, c.flag ?? null,
        c.independent ? 1 : 0, c.landlocked ? 1 : 0,
        JSON.stringify(Object.values(c.languages ?? {})),
        JSON.stringify(Object.entries(c.currencies ?? {}).map(([k, v]) => ({ code: k, ...v }))),
        JSON.stringify(callingCodes), JSON.stringify(c.tld ?? []),
        JSON.stringify((c.borders ?? []).map((b) => cca3to2.get(b)).filter(Boolean)),
        JSON.stringify([...new Set(altNames)]), ts,
      )
      const eng = c.demonyms?.eng
      setDemonyms.run(JSON.stringify([...new Set([eng?.m, eng?.f].filter(Boolean))]), c.ccn3 ?? null, code)
    }
  })
  return { countries: list.length, withPopulation: [...extra.values()].filter((e) => e.population).length }
}
