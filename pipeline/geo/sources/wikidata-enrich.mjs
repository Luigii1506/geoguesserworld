// Enriquecimiento genérico desde Wikidata: a toda entidad con QID que aún no
// lo tenga (ciudades de GeoNames, regiones, cordilleras de GMBA, lagos…) le
// añade cuántas Wikipedias tiene (importancia), nombre en español, foto,
// descripción y artículo de Wikipedia.
//
//   npm run pipeline -- geo download wikidata-enrich   (consulta lo que falta; caché)
//   npm run pipeline -- geo build                      (lo aplica)
//
// La descarga lee los QID de la última data/geo.db: tras añadir una fuente
// nueva, build → download wikidata-enrich → build.

import { DatabaseSync } from 'node:sqlite'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { rawDir, UA } from '../lib/files.mjs'
import { GEO_DB } from '../store.mjs'
import { wikiUrl } from './wikidata.mjs'

export const meta = {
  id: 'wikidata-enrich',
  name: 'Wikidata (fichas)',
  url: 'https://www.wikidata.org',
  license: 'CC0',
  attribution: 'Datos de Wikidata (CC0)',
}

const CACHE = () => path.join(rawDir('wikidata'), 'enrich.jsonl')
const POP_CACHE = () => path.join(rawDir('wikidata'), 'population.jsonl')
// tipos cuya población no traen GeoNames ni GHSL: regiones y países (la cifra más reciente)
const POP_KINDS = ['admin1', 'country', 'region']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function readCache() {
  const out = new Map()
  if (!existsSync(CACHE())) return out
  for (const l of readFileSync(CACHE(), 'utf8').split('\n')) {
    if (!l) continue
    const r = JSON.parse(l)
    out.set(r.q, r)
  }
  return out
}

async function sparql(query) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: { accept: 'application/sparql-results+json', 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
      body: new URLSearchParams({ query }),
      signal: AbortSignal.timeout(70_000),
    }).catch(() => null)
    if (res?.ok) {
      try {
        return JSON.parse(await res.text()).results.bindings
      } catch {
        /* respuesta cortada */
      }
    }
    await sleep((res?.status === 429 ? 30_000 : 5_000) * (attempt + 1))
  }
  return null
}

export async function download(ctx) {
  if (!existsSync(GEO_DB)) return ctx.log('aún no hay data/geo.db: ejecuta antes `geo build`')
  const db = new DatabaseSync(GEO_DB, { readOnly: true })
  const qids = db.prepare("SELECT DISTINCT value FROM entity_xref WHERE scheme = 'wd'").all().map((r) => r.value)
  db.close()
  const cache = readCache()
  const todo = qids.filter((q) => !cache.has(q))
  ctx.log(`${todo.length} de ${qids.length} QID sin consultar`)
  const CHUNK = 250
  for (let i = 0; i < todo.length; i += CHUNK) {
    const chunk = todo.slice(i, i + CHUNK)
    const rows = await sparql(`SELECT ?item (MAX(?sl) AS ?s) (SAMPLE(?es) AS ?les) (SAMPLE(?en) AS ?len) (SAMPLE(?mul) AS ?lmul)
        (SAMPLE(?d) AS ?desc) (SAMPLE(?img) AS ?image) (SAMPLE(?esT) AS ?esTitle) (SAMPLE(?enT) AS ?enTitle) WHERE {
      VALUES ?item { ${chunk.map((q) => `wd:${q}`).join(' ')} }
      ?item wikibase:sitelinks ?sl .
      OPTIONAL { ?item rdfs:label ?es FILTER(lang(?es) = "es") }
      OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en) = "en") }
      OPTIONAL { ?item rdfs:label ?mul FILTER(lang(?mul) = "mul") }
      OPTIONAL { ?item schema:description ?d FILTER(lang(?d) = "es") }
      OPTIONAL { ?item wdt:P18 ?img }
      OPTIONAL { ?esA schema:about ?item; schema:isPartOf <https://es.wikipedia.org/>; schema:name ?esT }
      OPTIONAL { ?enA schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?enT }
    } GROUP BY ?item`)
    if (!rows) {
      ctx.log(`⚠ bloque ${i / CHUNK + 1} sin respuesta; se reintentará en la próxima ejecución`)
      continue
    }
    const got = new Set()
    const lines = rows.map((r) => {
      const q = r.item.value.split('/').pop()
      got.add(q)
      return JSON.stringify({
        q, s: Number(r.s.value), es: r.les?.value, en: r.len?.value ?? r.lmul?.value, d: r.desc?.value,
        img: r.image?.value ? decodeURIComponent(r.image.value.split('/').pop()) : undefined, wes: r.esTitle?.value, wen: r.enTitle?.value,
      })
    })
    // QID que ya no existen (fusionados o borrados): se anotan para no repetirlos
    for (const q of chunk) if (!got.has(q)) lines.push(JSON.stringify({ q, gone: 1 }))
    appendFileSync(CACHE(), lines.join('\n') + '\n')
    if ((i / CHUNK) % 20 === 0) ctx.log(`${Math.min(i + CHUNK, todo.length)}/${todo.length}`)
    await sleep(400)
  }
  await downloadPopulation(ctx)
  ctx.log('✓ caché de Wikidata al día')
}

/** Población más reciente (P1082 con su fecha) de regiones y países. */
async function downloadPopulation(ctx) {
  const db = new DatabaseSync(GEO_DB, { readOnly: true })
  const qids = db.prepare(`SELECT DISTINCT x.value FROM entity_xref x JOIN entity e ON e.id = x.entity_id
    WHERE x.scheme = 'wd' AND e.kind IN (${POP_KINDS.map(() => '?').join(', ')})`).all(...POP_KINDS).map((r) => r.value)
  db.close()
  const done = new Set(existsSync(POP_CACHE()) ? readFileSync(POP_CACHE(), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).q) : [])
  const todo = qids.filter((q) => !done.has(q))
  ctx.log(`población: ${todo.length} de ${qids.length} regiones y países sin consultar`)
  for (let i = 0; i < todo.length; i += 150) {
    const chunk = todo.slice(i, i + 150)
    const rows = await sparql(`SELECT ?item ?pop ?t WHERE {
      VALUES ?item { ${chunk.map((q) => `wd:${q}`).join(' ')} }
      ?item p:P1082 ?st . ?st ps:P1082 ?pop . OPTIONAL { ?st pq:P585 ?t }
    }`)
    if (!rows) continue
    const latest = new Map()
    for (const r of rows) {
      const q = r.item.value.split('/').pop()
      const t = r.t?.value ? Date.parse(r.t.value) : 0
      const prev = latest.get(q)
      if (!prev || t > prev.t) latest.set(q, { t, pop: Math.round(Number(r.pop.value)) })
    }
    appendFileSync(POP_CACHE(), chunk.map((q) => {
      const v = latest.get(q)
      return JSON.stringify({ q, pop: v?.pop ?? null, year: v?.t ? new Date(v.t).getUTCFullYear() : null })
    }).join('\n') + '\n')
    await sleep(400)
  }
}

export async function ingest(store, ctx) {
  const cache = readCache()
  if (!cache.size) return ctx.log('sin caché (npm run pipeline -- geo download wikidata-enrich)')
  const rows = store.db.prepare("SELECT entity_id, value FROM entity_xref WHERE scheme = 'wd'").all()
  let n = 0
  for (const { entity_id: id, value: q } of rows) {
    const r = cache.get(q)
    if (!r || r.gone) continue
    const img = r.img ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(r.img)}` : null
    const title = r.wes ?? r.wen
    store.entity({
      id, fame: r.s, image: img, thumb: img ? `${img}?width=480` : null, descr: r.d,
      wiki: title ? wikiUrl(r.wes ? 'es' : 'en', title) : null, wiki_lang: title ? (r.wes ? 'es' : 'en') : null,
      names: [['es', r.es], ['en', r.en]],
    })
    // el nombre en español de Wikidata, si la entidad solo tenía el local
    const e = store.get(id)
    if (r.es && e.name === e.name_en && e.name !== r.es && e.kind !== 'urban') store.db.prepare('UPDATE entity SET name = ? WHERE id = ?').run(r.es, id)
    n++
  }
  // población de regiones y países (la de Wikidata, la más reciente)
  let pops = 0
  if (existsSync(POP_CACHE())) {
    const popOf = new Map(readFileSync(POP_CACHE(), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.q, r]))
    for (const { entity_id: id, value: q } of rows) {
      const r = popOf.get(q)
      if (!r?.pop) continue
      const e = store.get(id)
      if (!e || !POP_KINDS.includes(e.kind)) continue
      store.fact(id, 'population', r.pop, { scope: 'admin', year: r.year, source: meta.id })
      pops++
    }
  }
  ctx.log(`✓ ${n} entidades completadas con Wikidata · población de ${pops} regiones y países`)
}
