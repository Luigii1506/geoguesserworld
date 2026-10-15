// API de las guías de GeoGuessr (tablas gg_* de la base de lectura). Mismo
// contrato que api.js: manejadores puros sobre { all, first }.
//
//   GET  /api/gg/visual/meta            categorías del explorador y cuántas fotos tiene cada una
//   GET  /api/gg/visual?cat=…           fotos de una categoría, filtradas y paginadas (+ facetas)
//   POST /api/gg/quiz                   sesión de Entrenar: { mode, scope, essential, category, size, due, seen }
//                                       → preguntas elegidas (repaso primero, luego nuevas) y sus distractores
//
// El cuerpo de /quiz va como text/plain (JSON dentro) para que el navegador no
// tenga que hacer la consulta previa de CORS.

import { HttpError } from './api.js'

const int = (v, d, max = Infinity) => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : d
}
const placeholders = (n) => Array.from({ length: n }, () => '?').join(', ')
const CONTINENTS = new Set(['Europe', 'Asia', 'Africa', 'Americas', 'Oceania'])

export async function visualMeta(db) {
  const [cats, counts] = await Promise.all([
    db.first("SELECT value FROM meta WHERE key = 'guides_categories'"),
    db.all('SELECT k, COUNT(*) AS n FROM gg_photo GROUP BY k'),
  ])
  return { categories: cats ? JSON.parse(cats.value) : [], counts: Object.fromEntries(counts.map((r) => [r.k, r.n])) }
}

/** Total, subcategorías y países con fotos de una categoría (se precalcula: gg/visual/facets/<cat>). */
export async function visualFacets(db, cat) {
  const [total, subs, countries] = await Promise.all([
    db.first('SELECT COUNT(*) AS n FROM gg_photo WHERE k = ?', [cat]),
    db.all('SELECT sk, COUNT(*) AS n FROM gg_photo WHERE k = ? AND sk IS NOT NULL GROUP BY sk ORDER BY n DESC', [cat]),
    db.all('SELECT cc, COUNT(*) AS n FROM gg_photo WHERE k = ? AND cc IS NOT NULL GROUP BY cc', [cat]),
  ])
  return { total: total?.n ?? 0, subs: subs.map((r) => [r.sk, r.n]), countries: Object.fromEntries(countries.map((r) => [r.cc, r.n])) }
}

async function cachedJson(db, path, compute) {
  const row = await db.first('SELECT body FROM api_cache WHERE path = ?', [path]).catch(() => null)
  return row ? JSON.parse(row.body) : compute()
}

/** Fotos de una categoría con filtros de subcategoría, país, continente y fuente. */
export async function visualList(db, p) {
  const cat = p.get('cat')
  if (!cat) throw new HttpError(400, 'falta cat')
  const limit = int(p.get('limit'), 60, 200)
  const offset = int(p.get('offset'), 0)
  const where = ['ph.k = ?']
  const params = [cat]
  const sub = p.get('sub')
  const cc = p.get('cc')
  const src = p.get('src')
  const cont = p.get('continent')
  if (sub) (where.push('ph.sk = ?'), params.push(sub))
  if (cc) (where.push('ph.cc = ?'), params.push(cc))
  if (src) (where.push('ph.src = ?'), params.push(src))
  if (cont && CONTINENTS.has(cont)) (where.push('ph.cc IN (SELECT cc FROM country WHERE continent = ?)'), params.push(cont))
  const filtered = where.length > 1
  const sql = `WHERE ${where.join(' AND ')}`
  // la página recorre el índice (k, sort_name) y se detiene en `limit`
  const [rows, facets] = await Promise.all([
    db.all(`SELECT ph.id, ph.cc, ph.place, ph.src, ph.k, ph.sk, ph.text, ph.img, ph.link FROM gg_photo ph ${sql} ORDER BY ph.sort_name, ph.id LIMIT ? OFFSET ?`, [...params, limit, offset]),
    cachedJson(db, `gg/visual/facets/${cat}`, () => visualFacets(db, cat)),
  ])
  // con filtros, el total se cuenta (son pocas filas); sin ellos, el precalculado
  const total = filtered ? (await db.first(`SELECT COUNT(*) AS n FROM gg_photo ph ${sql}`, params))?.n ?? 0 : facets.total
  const out = {
    total, offset, limit,
    items: rows.map((r) => ({ id: r.id, c: r.cc, n: r.place ?? undefined, s: r.src, k: r.k, sk: r.sk ?? undefined, t: r.text ?? '', i: r.img, l: r.link ?? '' })),
  }
  if (offset === 0) out.facets = { subs: facets.subs, countries: facets.countries }
  return out
}

const shuffle = (a) => {
  const x = [...a]
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

/** Filtros de una sesión → WHERE sobre gg_quiz. */
function quizScope(body) {
  const mode = ['mix', 'text', 'photo'].includes(body.mode) ? body.mode : 'mix'
  const scope = String(body.scope ?? '')
  const where = []
  const params = []
  const kinds = mode === 'mix' ? ['text', 'photo'] : [mode]
  where.push(`q.kind IN (${placeholders(kinds.length)})`)
  params.push(...kinds)
  if (scope.startsWith('c:')) (where.push('q.cc = ?'), params.push(scope.slice(2)))
  else if (CONTINENTS.has(scope)) (where.push('q.cc IN (SELECT cc FROM country WHERE continent = ?)'), params.push(scope))
  if (body.category) (where.push('q.k = ?'), params.push(String(body.category)))
  // "solo determinantes" filtra las pistas de texto; las fotos se mantienen
  if (body.essential) where.push("(q.kind = 'photo' OR q.u = 3)")
  return { mode, scope, where: where.join(' AND '), params }
}

/** Clave del recuento precalculado (sin categoría): gg/quiz/count/<modo>|<ámbito>|<determinantes>. */
export const quizCountPath = (body) => `gg/quiz/count/${quizScope(body).mode}|${String(body.scope ?? '')}|${body.essential ? 1 : 0}`

/** Cuántas preguntas cumplen los filtros (se precalcula para los ámbitos sin categoría). */
export async function quizCount(db, body) {
  const q = quizScope(body)
  return (await db.first(`SELECT COUNT(*) AS n FROM gg_quiz q WHERE ${q.where}`, q.params))?.n ?? 0
}

/** Países posibles como distractor: con pistas de texto, o con fotos del mismo objeto (se precalcula). */
export async function quizPools(db) {
  const [text, photo] = await Promise.all([
    db.all("SELECT DISTINCT cc FROM gg_quiz WHERE kind = 'text'"),
    db.all("SELECT k, COALESCE(sk, '') AS sk, group_concat(DISTINCT cc) AS ccs FROM gg_quiz WHERE kind = 'photo' GROUP BY k, COALESCE(sk, '')"),
  ])
  return { text: text.map((r) => r.cc), ...Object.fromEntries(photo.map((r) => [`${r.k}|${r.sk}`, r.ccs.split(',')])) }
}

/**
 * Sesión de Entrenar. Elige como antes hacía la app con quiz.json entero: primero lo que
 * toca repasar (`due`), luego lo nuevo (no está en `seen`), lo más útil antes y, si no es
 * un solo país, como mucho 2 preguntas por país. Lo nuevo sale de una ventana aleatoria
 * del índice (columna r): se leen unas cientos de filas, no el banco entero.
 * Con size = 0 solo cuenta (preguntas posibles y cuántas tocan repasar).
 */
export async function quizSession(db, body) {
  const q = quizScope(body)
  const size = Math.min(int(String(body.size ?? 10), 10), 50)
  const dueList = (Array.isArray(body.due) ? body.due.map(String) : []).filter((k) => k.startsWith('t:') || k.startsWith('p:')).slice(0, 2000)
  const seen = new Set(Array.isArray(body.seen) ? body.seen.map(String) : [])

  // pendientes de repaso que entran en los filtros (por clave: pocas filas)
  const dueRows = []
  for (let i = 0; i < dueList.length; i += 90) {
    const chunk = dueList.slice(i, i + 90)
    dueRows.push(...(await db.all(`SELECT q.key, q.kind, q.cc, q.u FROM gg_quiz q WHERE q.key IN (${placeholders(chunk.length)}) AND ${q.where}`, [...chunk, ...q.params])))
  }
  const pool = body.category
    ? await quizCount(db, body)
    : await cachedJson(db, quizCountPath(body), () => quizCount(db, body))
  const out = { pool, due: dueRows.length, items: [], pools: {} }
  if (!size) return out

  // nuevas: una ventana aleatoria (con vuelta al principio si se acaba)
  const want = Math.max(300, size * 30)
  const start = Math.random()
  let window = await db.all(`SELECT q.key, q.kind, q.cc, q.u FROM gg_quiz q WHERE ${q.where} AND q.r >= ? ORDER BY q.r LIMIT ?`, [...q.params, start, want])
  if (window.length < want) window = [...window, ...(await db.all(`SELECT q.key, q.kind, q.cc, q.u FROM gg_quiz q WHERE ${q.where} AND q.r < ? ORDER BY q.r LIMIT ?`, [...q.params, start, want - window.length]))]
  const fresh = shuffle(window.filter((r) => !seen.has(r.key))).sort((a, b) => (b.kind === 'text' ? b.u ?? 2 : 2) - (a.kind === 'text' ? a.u ?? 2 : 2))

  const chosen = []
  const perCountry = new Map()
  const taken = new Set()
  for (const r of [...shuffle(dueRows), ...fresh]) {
    if (chosen.length >= size) break
    if (taken.has(r.key)) continue
    const n = perCountry.get(r.cc) ?? 0
    if (!q.scope.startsWith('c:') && n >= 2) continue
    perCountry.set(r.cc, n + 1)
    taken.add(r.key)
    chosen.push(r)
  }
  if (!chosen.length) return out
  const [rows, allPools] = await Promise.all([
    db.all(`SELECT key, kind, cc, k, sk, data FROM gg_quiz WHERE key IN (${placeholders(chosen.length)})`, chosen.map((r) => r.key)),
    cachedJson(db, 'gg/quiz/pools', () => quizPools(db)),
  ])
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const dueSet = new Set(dueRows.map((r) => r.key))
  out.items = chosen.map((c) => {
    const r = byKey.get(c.key)
    const pool = r.kind === 'photo' ? `${r.k}|${r.sk ?? ''}` : 'text'
    out.pools[pool] ??= allPools[pool] ?? allPools.text
    return { key: r.key, kind: r.kind, cc: r.cc, due: dueSet.has(r.key), pool, data: JSON.parse(r.data) }
  })
  return out
}

/** Categorías con preguntas de texto (para el selector de Entrenar). */
export async function quizCategories(db) {
  const rows = await db.all("SELECT k, COUNT(*) AS n FROM gg_quiz WHERE kind = 'text' GROUP BY k")
  return { categories: Object.fromEntries(rows.map((r) => [r.k, r.n])) }
}

/** Enruta /api/gg/… → { status, body }. */
export async function handleGuides(db, url, body) {
  const path = url.pathname.replace(/^\/api\/gg\/?/, '')
  try {
    let out
    if (path === 'visual/meta') out = await visualMeta(db)
    else if (path === 'visual') out = await visualList(db, url.searchParams)
    else if (path === 'quiz/categories') out = await quizCategories(db)
    else if (path === 'quiz') {
      let data = {}
      try {
        data = body ? JSON.parse(body) : Object.fromEntries(url.searchParams)
      } catch {
        throw new HttpError(400, 'cuerpo no válido')
      }
      out = await quizSession(db, data)
    } else throw new HttpError(404, 'ruta desconocida')
    return { status: 200, body: out }
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } }
    throw e
  }
}
