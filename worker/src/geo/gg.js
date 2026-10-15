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

/** Fotos de una categoría con filtros de subcategoría, país, continente y fuente. */
export async function visualList(db, p) {
  const cat = p.get('cat')
  if (!cat) throw new HttpError(400, 'falta cat')
  const limit = int(p.get('limit'), 60, 200)
  const offset = int(p.get('offset'), 0)
  const base = ['ph.k = ?']
  const params = [cat]
  const sub = p.get('sub')
  const cc = p.get('cc')
  const src = p.get('src')
  const cont = p.get('continent')
  const extra = []
  const extraParams = []
  if (sub) (extra.push('ph.sk = ?'), extraParams.push(sub))
  if (cc) (extra.push('ph.cc = ?'), extraParams.push(cc))
  if (src) (extra.push('ph.src = ?'), extraParams.push(src))
  if (cont && CONTINENTS.has(cont)) (extra.push('ph.cc IN (SELECT cc FROM country WHERE continent = ?)'), extraParams.push(cont))
  const where = `WHERE ${[...base, ...extra].join(' AND ')}`
  const all = [...params, ...extraParams]
  const [rows, total] = await Promise.all([
    db.all(`SELECT ph.id, ph.cc, ph.place, ph.src, ph.k, ph.sk, ph.text, ph.img, ph.link FROM gg_photo ph ${where} ORDER BY ph.sort_name, ph.id LIMIT ? OFFSET ?`, [...all, limit, offset]),
    db.first(`SELECT COUNT(*) AS n FROM gg_photo ph ${where}`, all),
  ])
  const out = {
    total: total?.n ?? 0, offset, limit,
    items: rows.map((r) => ({ id: r.id, c: r.cc, n: r.place ?? undefined, s: r.src, k: r.k, sk: r.sk ?? undefined, t: r.text ?? '', i: r.img, l: r.link ?? '' })),
  }
  // facetas (solo en la primera página): subcategorías de la categoría y países con fotos
  if (offset === 0) {
    const [subs, countries] = await Promise.all([
      db.all('SELECT sk, COUNT(*) AS n FROM gg_photo WHERE k = ? AND sk IS NOT NULL GROUP BY sk ORDER BY n DESC', [cat]),
      db.all('SELECT cc, COUNT(*) AS n FROM gg_photo WHERE k = ? AND cc IS NOT NULL GROUP BY cc', [cat]),
    ])
    out.facets = { subs: subs.map((r) => [r.sk, r.n]), countries: Object.fromEntries(countries.map((r) => [r.cc, r.n])) }
  }
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

/**
 * Sesión de Entrenar. Elige igual que antes hacía la app con quiz.json entero:
 * primero lo que toca repasar (`due`), luego lo nuevo (no está en `seen`), lo más
 * útil antes y, si no es un solo país, como mucho 2 preguntas por país.
 * Con size = 0 solo cuenta (preguntas posibles y cuántas tocan repasar).
 */
export async function quizSession(db, body) {
  const mode = ['mix', 'text', 'photo'].includes(body.mode) ? body.mode : 'mix'
  const scope = String(body.scope ?? '')
  const size = Math.min(int(String(body.size ?? 10), 10), 50)
  const due = new Set(Array.isArray(body.due) ? body.due.map(String) : [])
  const seen = new Set(Array.isArray(body.seen) ? body.seen.map(String) : [])
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
  const pool = await db.all(`SELECT q.key, q.kind, q.cc, q.u FROM gg_quiz q WHERE ${where.join(' AND ')}`, params)
  const dueInPool = pool.filter((r) => due.has(r.key))
  const out = { pool: pool.length, due: dueInPool.length, items: [], pools: {} }
  if (!size) return out

  const fresh = shuffle(pool.filter((r) => !seen.has(r.key))).sort((a, b) => (b.kind === 'text' ? b.u ?? 2 : 2) - (a.kind === 'text' ? a.u ?? 2 : 2))
  const chosen = []
  const perCountry = new Map()
  for (const r of [...shuffle(dueInPool), ...fresh]) {
    if (chosen.length >= size) break
    const n = perCountry.get(r.cc) ?? 0
    if (!scope.startsWith('c:') && n >= 2) continue
    perCountry.set(r.cc, n + 1)
    chosen.push(r)
  }
  if (!chosen.length) return out
  const rows = await db.all(`SELECT key, kind, cc, k, sk, data FROM gg_quiz WHERE key IN (${placeholders(chosen.length)})`, chosen.map((r) => r.key))
  const byKey = new Map(rows.map((r) => [r.key, r]))
  // distractores: en texto, cualquier país con pistas; en foto, solo los que tienen ese mismo objeto
  const poolKeys = new Set()
  for (const r of rows) poolKeys.add(r.kind === 'photo' ? `${r.k}|${r.sk ?? ''}` : 'text')
  for (const pk of poolKeys) {
    const list = pk === 'text'
      ? await db.all("SELECT DISTINCT cc FROM gg_quiz WHERE kind = 'text'")
      : await db.all("SELECT DISTINCT cc FROM gg_quiz WHERE kind = 'photo' AND k = ? AND COALESCE(sk, '') = ?", pk.split('|'))
    out.pools[pk] = list.map((x) => x.cc)
  }
  out.items = chosen.map((c) => {
    const r = byKey.get(c.key)
    return { key: r.key, kind: r.kind, cc: r.cc, due: due.has(r.key), pool: r.kind === 'photo' ? `${r.k}|${r.sk ?? ''}` : 'text', data: JSON.parse(r.data) }
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
