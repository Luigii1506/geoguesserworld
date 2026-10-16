// Precálculos de la API al construir la base (D1 cobra por filas leídas: lo que
// no depende de quién pregunta se calcula una vez y se sirve leyendo una fila).
//   · facet_cache: total y facetas de /list para cada lugar (mundo, continente,
//     país) × tipo (ninguno, cada familia, cada tipo)
//   · api_cache: respuestas enteras sin parámetros (ficha de cada país y región,
//     meta, países), los carruseles fijos de Geografía (geo/strips.json) y de las
//     guías (facetas de fotos, distractores, recuentos)
// Usa los mismos manejadores que la API: no hay dos versiones de la lógica.
//
//   npm run pipeline -- geo precompute   sobre la base actual (lo hace también geo build)

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT } from '../lib/paths.mjs'
import { computeSummary, summaryKey } from '../../worker/src/geo/api.js'
import { cachePath, computeApi } from '../../worker/src/geo/router.js'
import { quizCount, quizCountPath, quizPools, visualFacets } from '../../worker/src/geo/gg.js'

const KINDS = JSON.parse(readFileSync(path.join(ROOT, 'geo', 'kinds.json'), 'utf8'))
const STRIPS = JSON.parse(readFileSync(path.join(ROOT, 'geo', 'strips.json'), 'utf8'))
const CONTINENTS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']

const adapterOf = (db) => ({
  all: async (sql, params = []) => db.prepare(sql).all(...params),
  first: async (sql, params = []) => db.prepare(sql).get(...params) ?? null,
})

/** Total y facetas de cada combinación lugar × tipo. */
export async function precomputeFacets(store, ctx) {
  const t0 = Date.now()
  const db = store.db
  const adapter = adapterOf(db)
  db.exec('DELETE FROM facet_cache')
  const save = db.prepare('INSERT OR REPLACE INTO facet_cache (key, data) VALUES (?, ?)')
  const places = [{}, ...CONTINENTS.map((continent) => ({ continent })), ...db.prepare('SELECT cc FROM country WHERE places > 0').all().map((r) => ({ cc: r.cc }))]
  let n = 0
  for (const place of places) {
    const base = await computeSummary(adapter, new URLSearchParams(place))
    save.run(summaryKey(new URLSearchParams(place)), JSON.stringify(base))
    n++
    // los tipos que existen en ese lugar y todas las familias: una familia sin nada (el relieve
    // de Italia) también se guarda, a cero; si no, se contaría en cada visita
    const kinds = Object.keys(base.facets.kinds)
    const empty = { total: 0, facets: { kinds: {}, tags: {}, hints: 0 } }
    for (const f of KINDS.families) {
      const p = new URLSearchParams({ ...place, family: f.id })
      const sum = f.kinds.some((k) => kinds.includes(k)) ? await computeSummary(adapter, p) : empty
      save.run(summaryKey(p), JSON.stringify(sum))
      n++
    }
    for (const type of [...kinds.map((kind) => ({ kind })), { kind: 'admin1' }]) {
      const p = new URLSearchParams({ ...place, ...type })
      const sum = await computeSummary(adapter, p)
      if (!sum.total) continue
      save.run(summaryKey(p), JSON.stringify(sum))
      n++
    }
  }
  ctx.log(`✓ ${n} combinaciones de contadores en ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

/** Respuestas enteras de la API de geografía (meta, países, ficha de cada país y región). */
export async function precomputeGeo(store, ctx) {
  const t0 = Date.now()
  const db = store.db
  const adapter = adapterOf(db)
  db.exec("DELETE FROM api_cache WHERE path LIKE 'geo/%'")
  const save = db.prepare('INSERT OR REPLACE INTO api_cache (path, body) VALUES (?, ?)')
  const put = async (p) => {
    const { status, body } = await computeApi(adapter, new URL(`http://x/api/${p}`))
    if (status === 200) save.run(p, JSON.stringify(body))
  }
  await put('geo/meta')
  await put('geo/countries')
  const ccs = db.prepare('SELECT cc FROM country').all().map((r) => r.cc)
  for (const cc of ccs) await put(`geo/country/${cc}`)
  // fichas de países y regiones: contar lo que contienen recorre miles de relaciones
  const ids = db.prepare("SELECT e.id FROM entity e WHERE e.kind = 'country' OR e.id IN (SELECT entity_id FROM entity_tag WHERE tag = 'admin1')").all().map((r) => r.id)
  for (const id of ids) await put(`geo/entity/${encodeURIComponent(id)}`)
  ctx.log(`✓ ${2 + ccs.length + ids.length} respuestas de geografía en ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

/** Los parámetros de una lista como los manda la app (src/lib/geo.ts, listPath). */
function listUrl(q) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '' || v === false) continue
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(','))
    } else p.set(k, v === true ? '1' : String(v))
  }
  return new URL(`http://x/api/geo/list?${p}`)
}

/**
 * Carruseles fijos de Geografía (geo/strips.json): rankings del mundo, foto de cada tipo,
 * contadores del mundo y, por país, sus destacados y las ciudades del atlas. Con ellos, abrir
 * la portada de un país lee unas pocas filas en lugar de ~100.000.
 */
export async function precomputeLists(store, ctx) {
  const t0 = Date.now()
  const db = store.db
  const adapter = adapterOf(db)
  db.exec("DELETE FROM api_cache WHERE path LIKE 'geo/list?%'")
  const save = db.prepare('INSERT OR REPLACE INTO api_cache (path, body) VALUES (?, ?)')
  let n = 0
  const put = async (q) => {
    const url = listUrl(q)
    const { status, body } = await computeApi(adapter, url)
    if (status === 200) (save.run(cachePath(url), JSON.stringify(body)), n++)
  }
  // la primera página de su «Ver todos», como la pide la lista (useGeoPages: offset 0 y facetas)
  const firstPage = (q) => put({ ...q, offset: 0, limit: STRIPS.pageSize, facets: true })
  for (const r of STRIPS.rankings) {
    await put({ ...r.query, limit: STRIPS.stripLimit })
    await firstPage(r.query)
  }
  for (const f of KINDS.families) await put({ family: f.id, ...STRIPS.familyTile })
  await put(STRIPS.worldFacets)
  const ccs = db.prepare('SELECT cc FROM country WHERE places > 0').all().map((r) => r.cc)
  for (const cc of ccs) {
    for (const h of STRIPS.highlights) {
      await put({ ...h.query, cc, limit: STRIPS.stripLimit })
      await firstPage({ ...h.query, cc })
    }
    await put({ cc, ...STRIPS.atlasCities })
  }
  ctx.log(`✓ ${n} carruseles en ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

/** Respuestas de las guías: categorías y facetas de fotos, distractores y recuentos de Entrenar. */
export async function precomputeGuides(store, ctx) {
  const t0 = Date.now()
  const db = store.db
  const adapter = adapterOf(db)
  db.exec("DELETE FROM api_cache WHERE path LIKE 'gg/%'")
  const save = db.prepare('INSERT OR REPLACE INTO api_cache (path, body) VALUES (?, ?)')
  for (const p of ['gg/visual/meta', 'gg/quiz/categories']) {
    const { status, body } = await computeApi(adapter, new URL(`http://x/api/${p}`))
    if (status === 200) save.run(p, JSON.stringify(body))
  }
  const cats = db.prepare('SELECT DISTINCT k FROM gg_photo').all().map((r) => r.k)
  for (const cat of cats) save.run(`gg/visual/facets/${cat}`, JSON.stringify(await visualFacets(adapter, cat)))
  save.run('gg/quiz/pools', JSON.stringify(await quizPools(adapter)))
  const scopes = ['', ...CONTINENTS, ...db.prepare('SELECT DISTINCT cc FROM gg_quiz').all().map((r) => `c:${r.cc}`)]
  let n = 0
  for (const mode of ['mix', 'text', 'photo'])
    for (const scope of scopes)
      for (const essential of [false, true]) {
        const body = { mode, scope, essential }
        save.run(quizCountPath(body), JSON.stringify(await quizCount(adapter, body)))
        n++
      }
  ctx.log(`✓ ${2 + cats.length + 1 + n} respuestas de las guías en ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

/** Todo, en orden (la ficha de cada país usa los contadores). */
export async function precomputeAll(store, ctx) {
  await precomputeFacets(store, ctx)
  await precomputeGeo(store, ctx)
  await precomputeLists(store, ctx)
  await precomputeGuides(store, ctx)
}
