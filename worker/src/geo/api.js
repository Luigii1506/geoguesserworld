// API de la base geográfica. Manejadores puros: reciben un adaptador de base
// de datos { all(sql, params), first(sql, params) } — D1 en el Worker,
// node:sqlite en `npm run dev` — y devuelven objetos JSON. Ver docs/geo.md.
//
//   GET /api/geo/meta                       tipos, familias, fuentes, capas, fecha
//   GET /api/geo/countries                  países con cuántos lugares tiene cada uno
//   GET /api/geo/list?…                     lista filtrada, ordenada y paginada (+ facetas)
//   GET /api/geo/search?q=…                 búsqueda por nombre (cualquier idioma)
//   GET /api/geo/entity/<id>                ficha completa
//   GET /api/geo/country/<cc>               perfil del país: datos, regiones, capas
//   GET /api/geo/near?lat=&lng=             lugares cercanos

import KINDS from '../../../geo/kinds.json' with { type: 'json' }

const FAMILY = new Map(KINDS.families.map((f) => [f.id, f]))
// datos numéricos que se muestran en las tarjetas
const CARD_FACTS = ['population', 'elevation', 'length', 'area', 'discharge', 'basin', 'prominence', 'depth', 'visitors', 'last_eruption', 'countries']
// ámbito de población que representa a cada tipo (ciudad ≠ área urbana ≠ región), en geo/kinds.json
const POP_SCOPE = KINDS.populationScope

const MAX_LIMIT = 200
const int = (v, d, max = Infinity) => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : d
}
const list = (v) => (v ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : [])
const placeholders = (n) => Array.from({ length: n }, () => '?').join(', ')
const SAFE_KEY = /^[a-z_][a-z0-9_:.-]{0,60}$/

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** Texto libre → consulta FTS5: prefijo de cada palabra, sin acentos (null si no hay palabras). */
function ftsQuery(q) {
  const words = (q ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 6)
  return words.length ? words.map((w) => `"${w}"*`).join(' ') : null
}

/** Filtros comunes de list (WHERE + parámetros). */
function filters(p, { skipKind = false, skipTags = false, skipHints = false } = {}) {
  const where = []
  const params = []
  const kinds = [...list(p.get('kind')), ...(p.get('family') ? FAMILY.get(p.get('family'))?.kinds ?? [] : [])]
  if (kinds.length && !skipKind) {
    where.push(`e.kind IN (${placeholders(kinds.length)})`)
    params.push(...kinds)
  } else if (!p.get('kind') && !p.get('family') && !p.get('q')) {
    // sin tipo ni búsqueda: lugares, no divisiones administrativas (al buscar, sí: "Jalisco" es el estado)
    where.push("e.kind NOT IN ('country', 'admin1')")
  }
  const ccs = list(p.get('cc'))
  if (ccs.length) {
    where.push(`e.id IN (SELECT entity_id FROM entity_country WHERE cc IN (${placeholders(ccs.length)}))`)
    params.push(...ccs)
  }
  if (p.get('continent')) {
    // por su país principal (mucho más rápido que por todos sus países y casi siempre igual)
    where.push('e.cc IN (SELECT cc FROM country WHERE continent = ?)')
    params.push(p.get('continent'))
  }
  if (p.get('admin1')) {
    where.push('e.admin1 = ?')
    params.push(p.get('admin1'))
  }
  if (p.get('within')) {
    where.push("e.id IN (SELECT subject FROM relation WHERE object = ? AND predicate IN ('in_range', 'in_urban', 'part_of', 'in_admin1'))")
    params.push(p.get('within'))
  }
  if (!skipTags)
    for (const t of list(p.get('tags'))) {
      where.push('e.id IN (SELECT entity_id FROM entity_tag WHERE tag = ?)')
      params.push(t)
    }
  const match = ftsQuery(p.get('q'))
  if (match) {
    where.push('e.id IN (SELECT entity_id FROM entity_fts WHERE entity_fts MATCH ?)')
    params.push(match)
  }
  if (p.get('hints') === '1' && !skipHints) where.push('e.hints > 0')
  if (p.get('photo') === '1') where.push('e.thumb IS NOT NULL')
  // conocidos: con artículo en al menos 20 Wikipedias
  if (p.get('famous') === '1') where.push('e.fame >= 20')
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
}

const CARD_COLS = 'e.id, e.kind, e.name, e.name_en, e.cc, e.ccs, e.admin1, e.lat, e.lng, e.thumb, e.descr, e.fame, e.rank, e.hints, e.tags'

function card(r, facts) {
  return {
    id: r.id, kind: r.kind, name: r.name, name_en: r.name_en ?? undefined, cc: r.cc ?? undefined,
    ccs: r.ccs ? r.ccs.split(',') : undefined, admin1: r.admin1 ?? undefined, lat: r.lat, lng: r.lng,
    thumb: r.thumb ?? undefined, descr: r.descr ?? undefined, fame: r.fame, rank: Math.round(r.rank * 1000) / 1000,
    hints: r.hints, tags: r.tags ? r.tags.split(',') : undefined, facts: facts ?? undefined,
    value: r.sort_value ?? undefined,
  }
}

/** Datos de tarjeta (altura, población…) de varias entidades en una consulta. */
async function cardFacts(db, ids, kinds) {
  if (!ids.length) return new Map()
  const rows = await db.all(
    `SELECT entity_id, key, scope, value, text FROM fact WHERE entity_id IN (${placeholders(ids.length)})
       AND (key IN (${placeholders(CARD_FACTS.length)}) OR key IN ('volcano_status', 'volcano_type'))`,
    [...ids, ...CARD_FACTS],
  )
  const out = new Map()
  for (const r of rows) {
    const f = out.get(r.entity_id) ?? {}
    if (r.key === 'population') {
      // el ámbito adecuado al tipo gana; si no lo hay, cualquiera
      const want = POP_SCOPE[kinds.get(r.entity_id)] ?? 'city'
      if (f.population == null || r.scope === want) {
        f.population = r.value
        f.population_scope = r.scope
      }
    } else f[r.key] = r.value ?? r.text
    out.set(r.entity_id, f)
  }
  return out
}

async function withFacts(db, rows) {
  const facts = await cardFacts(db, rows.map((r) => r.id), new Map(rows.map((r) => [r.id, r.kind])))
  return rows.map((r) => card(r, facts.get(r.id)))
}

// órdenes que no son un dato: por nombre; los demás (y "rank", la importancia), por el índice entity_sort
const SORTS = { name: 'e.name COLLATE NOCASE ASC' }

/**
 * Cuántos valores tiene cada orden en entity_sort (precalculado al construir la base).
 * Se guarda el valor, no la promesa: en un Worker no se puede reutilizar la E/S de otra petición.
 */
let sortCounts = null
async function sortCount(db, key) {
  if (!sortCounts) {
    const r = await db.first("SELECT value FROM meta WHERE key = 'sort_counts'").catch(() => null)
    sortCounts = r ? JSON.parse(r.value) : {}
  }
  return sortCounts[key] ?? 0
}

/**
 * Filas de una página ordenada por un dato (o por importancia, "rank"). Dos caminos:
 *   · recorrer el índice ordenado y quedarse con las que cumplen los filtros hasta llenar
 *     la página: ~ (offset + limit) × N / total filas leídas (bueno si el filtro es amplio)
 *   · filtrar primero y ordenar lo que queda: ~ total filas (bueno si el filtro es selectivo)
 * Se elige el más barato con el total ya conocido; CROSS JOIN fija el orden de lectura.
 */
async function sortedRows(db, { where, params, key, asc, limit, offset, total }) {
  const n = await sortCount(db, key)
  const and = where ? `${where} AND` : 'WHERE'
  const indexFirst = total === Infinity || (total > 0 && ((offset + limit) * n) / total < total)
  const sql = indexFirst
    ? `SELECT ${CARD_COLS}, s.value AS sort_value FROM entity_sort s CROSS JOIN entity e ON e.id = s.entity_id
       ${and} s.key = ? ORDER BY s.value ${asc ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`
    : `SELECT ${CARD_COLS}, s.value AS sort_value FROM entity e CROSS JOIN entity_sort s ON s.entity_id = e.id AND s.key = ?
       ${where} ORDER BY s.value ${asc ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`
  return db.all(sql, indexFirst ? [...params, key, limit, offset] : [key, ...params, limit, offset])
}

export async function listEntities(db, p) {
  const limit = int(p.get('limit'), 36, MAX_LIMIT)
  const offset = int(p.get('offset'), 0)
  const sort = p.get('sort') ?? 'rank'
  const asc = p.get('order') === 'asc'
  const { where, params } = filters(p)
  const and = where ? `${where} AND` : 'WHERE'
  if (!SORTS[sort] && sort !== 'random' && !SAFE_KEY.test(sort)) throw new HttpError(400, 'orden no válido')

  // al azar (Sorpréndeme): un punto cualquiera entre los ~400 más importantes que cumplen
  // los filtros, sin contar ni ordenar todo
  if (sort === 'random') {
    let rows = await sortedRows(db, { where, params, key: 'rank', asc: false, limit, offset: Math.floor(Math.random() * 400), total: Infinity })
    if (!rows.length) rows = await sortedRows(db, { where, params, key: 'rank', asc: false, limit, offset: 0, total: Infinity })
    return { total: rows.length, offset: 0, limit, items: await withFacts(db, rows) }
  }

  // total y facetas: precalculados si se puede (una fila); al momento solo si alguien los
  // pide (facets=1 o total=1): un carrusel de 12 no necesita contar 170.000 lugares
  const wantTotal = p.get('facets') === '1' || p.get('total') === '1'
  const sum = (await cachedSummary(db, p)) ?? (wantTotal ? await computeSummary(db, p) : null)
  const total = sum?.total ?? null
  const f = sum?.facets
  let rows
  if (SORTS[sort]) {
    rows = await db.all(`SELECT ${CARD_COLS} FROM entity e ${where} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`, [...params, limit, offset])
  } else {
    // sin total conocido se recorre el índice (lo normal en listas cortas y amplias)
    rows = total === null || offset < total ? await sortedRows(db, { where, params, key: sort, asc, limit, offset, total: total ?? Infinity }) : []
    // los que no tienen el dato, al final por importancia (solo al llegar a esa parte)
    if (rows.length < limit && sort !== 'rank') {
      // cuántos tienen el dato: si caben en la primera página, son los que vinieron
      const nv = offset === 0 ? rows.length
        : (await db.first(`SELECT COUNT(*) AS n FROM entity e CROSS JOIN entity_sort s ON s.entity_id = e.id AND s.key = ? ${where}`, [sort, ...params]))?.n ?? 0
      const rest = await db.all(
        `SELECT ${CARD_COLS} FROM entity e ${and} NOT EXISTS (SELECT 1 FROM entity_sort x WHERE x.key = ? AND x.entity_id = e.id)
         ORDER BY e.rank DESC LIMIT ? OFFSET ?`,
        [...params, sort, limit - rows.length, Math.max(0, offset - nv)],
      )
      rows = [...rows, ...rest]
    }
  }
  const out = { total, offset, limit, items: await withFacts(db, rows) }
  if (p.get('facets') === '1') out.facets = f
  return out
}

// ── contadores precalculados (tabla facet_cache, los genera `geo build`) ──
// Las combinaciones habituales (lugar × tipo) se leen de una fila en lugar de
// recorrer cientos de miles: D1 cobra por filas leídas.
const SUMMARY_PARAMS = ['cc', 'continent', 'family', 'kind']
const NEUTRAL_PARAMS = new Set(['sort', 'order', 'offset', 'limit', 'facets', 'k', 't'])

/** Clave de la combinación en facet_cache, o null si la consulta lleva otros filtros. */
export function summaryKey(p) {
  for (const [k] of p) if (!SUMMARY_PARAMS.includes(k) && !NEUTRAL_PARAMS.has(k)) return null
  if ((p.get('cc') ?? '').includes(',') || (p.get('kind') ?? '').includes(',')) return null
  return SUMMARY_PARAMS.map((k) => `${k}=${p.get(k) ?? ''}`).join('|')
}

/** Total y facetas calculados al momento. */
export async function computeSummary(db, p) {
  const { where, params } = filters(p)
  const [total, f] = await Promise.all([db.first(`SELECT COUNT(*) AS n FROM entity e ${where}`, params), facets(db, p)])
  return { total: total?.n ?? 0, facets: f }
}

/** Total y facetas precalculados (una fila), o null si la combinación no lo está. */
async function cachedSummary(db, p) {
  const key = summaryKey(p)
  if (!key) return null
  const row = await db.first('SELECT data FROM facet_cache WHERE key = ?', [key]).catch(() => null)
  return row ? JSON.parse(row.data) : null
}

/** Total y facetas: precalculados si se puede; si no, al momento. */
async function summary(db, p) {
  return (await cachedSummary(db, p)) ?? computeSummary(db, p)
}

/** Cuántos hay de cada tipo y de cada etiqueta con los filtros actuales. */
async function facets(db, p) {
  const k = filters(p, { skipKind: true })
  const t = filters(p, { skipTags: true })
  const h = filters(p, { skipHints: true })
  const [kinds, tags, hints] = await Promise.all([
    db.all(`SELECT e.kind AS key, COUNT(*) AS n FROM entity e ${k.where} GROUP BY e.kind`, k.params),
    db.all(
      `SELECT et.tag AS key, COUNT(*) AS n FROM entity e JOIN entity_tag et ON et.entity_id = e.id ${t.where} GROUP BY et.tag`,
      t.params,
    ),
    db.first(`SELECT COUNT(*) AS n FROM entity e ${h.where ? `${h.where} AND` : 'WHERE'} e.hints > 0`, h.params),
  ])
  return {
    kinds: Object.fromEntries(kinds.map((r) => [r.key, r.n])),
    tags: Object.fromEntries(tags.map((r) => [r.key, r.n])),
    hints: hints?.n ?? 0,
  }
}

/** Búsqueda por nombre: prefijos de cada palabra, sin acentos; lo más importante primero. */
export async function search(db, p) {
  const q = (p.get('q') ?? '').trim()
  const limit = int(p.get('limit'), 12, 50)
  const match = ftsQuery(q)
  if (!match) return { items: [] }
  const kinds = list(p.get('kind'))
  // el índice de texto está en orden de importancia (rowid): las 200 primeras coincidencias
  // ya son las más conocidas, sin leer todas
  const rows = await db.all(
    `SELECT ${CARD_COLS} FROM (SELECT rowid AS r, entity_id FROM entity_fts WHERE entity_fts MATCH ? ORDER BY rowid LIMIT ${kinds.length ? 1000 : 200}) f
     JOIN entity e ON e.id = f.entity_id ${kinds.length ? `WHERE e.kind IN (${placeholders(kinds.length)})` : ''}
     ORDER BY f.r LIMIT 200`,
    [match, ...kinds],
  )
  // el nombre que empieza igual que la búsqueda, primero
  const fold = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const fq = fold(q)
  const score = (r) => r.rank + (fold(r.name) === fq ? 2 : fold(r.name).startsWith(fq) || fold(r.name_en).startsWith(fq) ? 1 : 0)
  rows.sort((a, b) => score(b) - score(a))
  return { items: await withFacts(db, rows.slice(0, limit)) }
}

export async function getEntity(db, id) {
  const e = await db.first('SELECT * FROM entity WHERE id = ?', [id])
  if (!e) throw new HttpError(404, 'no existe')
  const [facts, names, xrefs, up, down, hints] = await Promise.all([
    db.all('SELECT f.key, f.scope, f.value, f.text, f.unit, f.year, f.source_id FROM fact f WHERE f.entity_id = ?', [id]),
    db.all('SELECT lang, name FROM entity_name WHERE entity_id = ?', [id]),
    db.all('SELECT scheme, value FROM entity_xref WHERE entity_id = ? AND scheme IN (?, ?, ?, ?, ?)', [id, 'wd', 'gn', 'gvp', 'gmba', 'iso']),
    db.all(
      `SELECT r.predicate, ${CARD_COLS} FROM relation r JOIN entity e ON e.id = r.object WHERE r.subject = ? AND r.predicate != 'in_country'`,
      [id],
    ),
    db.all(
      `SELECT e.kind AS kind, COUNT(*) AS n FROM relation r JOIN entity e ON e.id = r.subject WHERE r.object = ? GROUP BY e.kind`,
      [id],
    ),
    db.all('SELECT hint_id, cc FROM entity_hint WHERE entity_id = ?', [id]),
  ])
  return {
    id: e.id, kind: e.kind, name: e.name, name_en: e.name_en ?? undefined, cc: e.cc ?? undefined,
    ccs: e.ccs ? e.ccs.split(',') : undefined, admin1: e.admin1 ?? undefined, lat: e.lat, lng: e.lng,
    bbox: e.bbox ? e.bbox.split(',').map(Number) : undefined, fame: e.fame, rank: e.rank, hints: e.hints,
    image: e.image ?? undefined, thumb: e.thumb ?? undefined, descr: e.descr ?? undefined, summary: e.summary ?? undefined,
    wiki: e.wiki ?? undefined, wiki_lang: e.wiki_lang ?? undefined, tags: e.tags ? e.tags.split(',') : undefined,
    facts: facts.map((f) => ({ key: f.key, scope: f.scope || undefined, value: f.value ?? f.text, unit: f.unit ?? undefined, year: f.year ?? undefined, source: f.source_id })),
    names: names.map((n) => [n.lang, n.name]),
    ids: Object.fromEntries(xrefs.map((x) => [x.scheme, x.value])),
    parents: (await withFacts(db, up)).map((c, i) => ({ ...c, predicate: up[i].predicate })),
    children: Object.fromEntries(down.map((d) => [d.kind, d.n])),
    hintIds: hints.map((h) => ({ id: Number(h.hint_id), cc: h.cc ?? undefined })),
  }
}

export async function getCountry(db, cc) {
  const c = await db.first('SELECT * FROM country WHERE cc = ?', [cc])
  if (!c) throw new HttpError(404, 'país desconocido')
  const [entity, counts, regions, assets, terrain, highest] = await Promise.all([
    getEntity(db, c.entity_id),
    summary(db, new URLSearchParams({ cc })),
    db.all(`SELECT ${CARD_COLS} FROM entity e JOIN entity_tag t ON t.entity_id = e.id AND t.tag = 'admin1' WHERE e.cc = ? ORDER BY e.name`, [cc]),
    db.all('SELECT a.layer_id, a.path, a.bbox, a.width, a.height, a.hash FROM asset a WHERE a.cc = ?', [cc]),
    // repartos del terreno de todas sus regiones (relieve, vegetación, clima, cultivos)
    db.all(
      `SELECT f.entity_id, f.key, f.scope, f.value FROM fact f JOIN entity e ON e.id = f.entity_id
       JOIN entity_tag t ON t.entity_id = e.id AND t.tag = 'admin1'
       WHERE e.cc = ? AND f.key LIKE '%:%'`,
      [cc],
    ),
    // su cumbre más alta (la de la base, no la de la rejilla del relieve)
    db.all(
      `SELECT ${CARD_COLS}, f.value AS sort_value FROM entity_country ec JOIN entity e ON e.id = ec.entity_id
       JOIN fact f ON f.entity_id = e.id AND f.key = 'elevation'
       WHERE ec.cc = ? AND e.kind IN ('mountain', 'volcano') ORDER BY f.value DESC LIMIT 1`,
      [cc],
    ),
  ])
  const byRegion = new Map()
  for (const t of terrain) {
    const m = byRegion.get(t.entity_id) ?? {}
    m[t.scope ? `${t.key}@${t.scope}` : t.key] = t.value
    byRegion.set(t.entity_id, m)
  }
  const regionCards = await withFacts(db, regions)
  return {
    cc, name: c.name, name_en: c.name_en ?? undefined, continent: c.continent ?? undefined, flag: c.flag ?? undefined, guide: !!c.guide,
    entity,
    // los tipos de lugar (precalculados) y sus estados o regiones
    counts: { ...counts.facets.kinds, ...(regions.length ? { admin1: regions.length } : {}) },
    regions: regionCards.map((r) => ({ ...r, terrain: byRegion.get(r.id) })),
    highest: highest.length ? (await withFacts(db, highest))[0] : undefined,
    // con ?v=<huella>: el navegador guarda cada capa para siempre y la vuelve a pedir solo si cambia
    layers: assets.map((a) => ({ id: a.layer_id, path: a.hash ? `${a.path}?v=${a.hash}` : a.path, bbox: a.bbox.split(',').map(Number), width: a.width, height: a.height })),
  }
}

export async function listCountries(db) {
  const rows = await db.all('SELECT cc, name, name_en, continent, flag, guide, places FROM country ORDER BY name')
  return { items: rows.map((r) => ({ cc: r.cc, name: r.name, name_en: r.name_en ?? undefined, continent: r.continent ?? undefined, flag: r.flag ?? undefined, guide: !!r.guide, places: r.places })) }
}

export async function near(db, p) {
  const lat = Number(p.get('lat'))
  const lng = Number(p.get('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, 'lat y lng obligatorios')
  const km = Math.min(Number(p.get('km')) || 50, 500)
  const dLat = km / 111
  const dLng = km / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)))
  const kinds = list(p.get('kind'))
  const rows = await db.all(
    `SELECT ${CARD_COLS} FROM entity e WHERE e.lat BETWEEN ? AND ? AND e.lng BETWEEN ? AND ?
       AND e.kind NOT IN ('country', 'admin1') ${kinds.length ? `AND e.kind IN (${placeholders(kinds.length)})` : ''}
     ORDER BY e.rank DESC LIMIT ?`,
    [lat - dLat, lat + dLat, lng - dLng, lng + dLng, ...kinds, int(p.get('limit'), 20, 100)],
  )
  return { items: await withFacts(db, rows) }
}

export async function getMeta(db) {
  const [sources, layers, built, totals] = await Promise.all([
    db.all('SELECT id, name, url, license, attribution, version FROM source ORDER BY name'),
    db.all('SELECT id, family, name, kind, legend, source_id, ord FROM layer ORDER BY ord'),
    db.first("SELECT value FROM meta WHERE key = 'built_at'"),
    db.all('SELECT kind, COUNT(*) AS n FROM entity GROUP BY kind'),
  ])
  return {
    builtAt: built?.value ?? null,
    families: KINDS.families,
    kinds: KINDS.kinds,
    totals: Object.fromEntries(totals.map((r) => [r.kind, r.n])),
    sources,
    layers: layers.map((l) => ({ ...l, legend: JSON.parse(l.legend) })),
  }
}

/**
 * Enruta /api/geo/… → { status, body }.
 * @param {{ all(sql: string, params?: unknown[]): Promise<any[]>, first(sql: string, params?: unknown[]): Promise<any> }} db
 * @param {URL} url
 */
export async function handleGeo(db, url) {
  const path = url.pathname.replace(/^\/api\/geo\/?/, '')
  const p = url.searchParams
  try {
    let body
    const [head, ...rest] = path.split('/')
    const arg = decodeURIComponent(rest.join('/'))
    if (head === 'meta') body = await getMeta(db)
    else if (head === 'countries') body = await listCountries(db)
    else if (head === 'list') body = await listEntities(db, p)
    else if (head === 'search') body = await search(db, p)
    else if (head === 'near') body = await near(db, p)
    else if (head === 'entity' && arg) body = await getEntity(db, arg)
    else if (head === 'country' && /^[a-z]{2}$/.test(arg)) body = await getCountry(db, arg)
    else throw new HttpError(404, 'ruta desconocida')
    return { status: 200, body }
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } }
    throw e
  }
}
