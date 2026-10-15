// Precálculos de la API al construir la base (D1 cobra por filas leídas: lo que
// no depende de quién pregunta se calcula una vez y se sirve leyendo una fila).
//   · facet_cache: total y facetas de /list para cada lugar (mundo, continente,
//     país) × tipo (ninguno, cada familia, cada tipo)
//   · api_cache: respuestas enteras sin parámetros (ficha de cada país y región,
//     meta, países) y de las guías (facetas de fotos, distractores, recuentos)
// Usa los mismos manejadores que la API: no hay dos versiones de la lógica.
//
//   npm run pipeline -- geo precompute   sobre la base actual (lo hace también geo build)

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT } from '../lib/paths.mjs'
import { computeSummary, summaryKey } from '../../worker/src/geo/api.js'
import { computeApi } from '../../worker/src/geo/router.js'
import { quizCount, quizCountPath, quizPools, visualFacets } from '../../worker/src/geo/gg.js'

const KINDS = JSON.parse(readFileSync(path.join(ROOT, 'geo', 'kinds.json'), 'utf8'))
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
    // solo los tipos y familias que existen en ese lugar
    const kinds = Object.keys(base.facets.kinds)
    const types = [...KINDS.families.filter((f) => f.kinds.some((k) => kinds.includes(k))).map((f) => ({ family: f.id })), ...kinds.map((kind) => ({ kind })), { kind: 'admin1' }]
    for (const type of types) {
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
  await precomputeGuides(store, ctx)
}
