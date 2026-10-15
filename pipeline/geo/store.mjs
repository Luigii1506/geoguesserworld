// GeoStore: construye data/geo.db (el mismo esquema que D1, geo/schema.sql).
//
// Las fuentes escriben con estos métodos y nunca con SQL propio:
//   store.source(meta)                       licencia y atribución
//   store.entity(e, { source })              crea o completa una entidad
//   store.xref(id, scheme, value)            identificador externo
//   store.resolve(scheme, value)             → id de la entidad (o null)
//   store.name(id, lang, name)
//   store.fact(id, key, value, opts)         dato medido
//   store.relate(subject, predicate, object, source)
//
// Unir fuentes: si una entidad trae ids externos (wd, gn, gvp…) ya conocidos,
// se completa la existente en vez de crear otra. Los campos ya rellenos no se
// pisan salvo con { override: true }: el orden de ingesta fija la prioridad.

import { DatabaseSync } from 'node:sqlite'
import { readFileSync, existsSync, renameSync, rmSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR, ROOT } from '../lib/paths.mjs'

export const GEO_DB = path.join(DATA_DIR, 'geo.db')
const SCHEMA = path.join(ROOT, 'geo', 'schema.sql')
const KINDS = JSON.parse(readFileSync(path.join(ROOT, 'geo', 'kinds.json'), 'utf8'))

/** Tipo canónico (geo/kinds.json): los alias de las fuentes se traducen y lo desconocido es `other`. */
export const canonicalKind = (k) => {
  const x = KINDS.aliases[k] ?? k
  return x && KINDS.kinds[x] ? x : 'other'
}

// esquemas que identifican una sola entidad (los demás son solo para buscar)
const IDENTITY = new Set(['wd', 'gn', 'gvp', 'gmba', 'hylak', 'ucdb', 'eco', 'iso', 'wp_es', 'wp_en'])

const FIELDS = ['kind', 'name', 'name_en', 'cc', 'admin1', 'lat', 'lng', 'bbox', 'fame', 'hints', 'image', 'thumb', 'descr', 'summary', 'wiki', 'wiki_lang']

export const round = (v, d = 4) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d)
export const fold = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Abre una base nueva (archivo temporal) o la existente para completarla.
 * @param {{ fresh?: boolean, file?: string }} [opts]
 */
export function openStore({ fresh = false, file = GEO_DB } = {}) {
  mkdirSync(path.dirname(file), { recursive: true })
  const target = fresh ? `${file}.building` : file
  if (fresh) for (const f of [target, `${target}-wal`, `${target}-shm`]) rmSync(f, { force: true })
  const db = new DatabaseSync(target)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = OFF; PRAGMA busy_timeout = 15000;')
  db.exec(readFileSync(SCHEMA, 'utf8'))

  const q = {
    get: db.prepare('SELECT * FROM entity WHERE id = ?'),
    insert: db.prepare(`INSERT INTO entity (id, ${FIELDS.join(', ')}, ccs, tags) VALUES (?, ${FIELDS.map(() => '?').join(', ')}, ?, ?)`),
    resolve: db.prepare('SELECT entity_id FROM entity_xref WHERE scheme = ? AND value = ?'),
    xref: db.prepare('INSERT OR IGNORE INTO entity_xref (entity_id, scheme, value) VALUES (?, ?, ?)'),
    name: db.prepare('INSERT OR IGNORE INTO entity_name (entity_id, lang, name) VALUES (?, ?, ?)'),
    fact: db.prepare(`INSERT INTO fact (entity_id, key, scope, value, text, unit, year, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_id, key, scope) DO UPDATE SET value = excluded.value, text = excluded.text, unit = excluded.unit,
        year = excluded.year, source_id = excluded.source_id`),
    factKeep: db.prepare(`INSERT OR IGNORE INTO fact (entity_id, key, scope, value, text, unit, year, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    relate: db.prepare('INSERT OR IGNORE INTO relation (subject, predicate, object, source_id) VALUES (?, ?, ?, ?)'),
    source: db.prepare(`INSERT INTO source (id, name, url, license, attribution, version, retrieved) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, url = excluded.url, license = excluded.license,
        attribution = excluded.attribution, version = excluded.version, retrieved = excluded.retrieved`),
    hint: db.prepare('INSERT OR IGNORE INTO entity_hint (entity_id, hint_id, cc) VALUES (?, ?, ?)'),
  }

  let finalized = false
  const store = {
    db,
    file: target,

    tx(fn) {
      db.exec('BEGIN')
      try {
        const r = fn()
        db.exec('COMMIT')
        return r
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },

    source(meta) {
      q.source.run(meta.id, meta.name, meta.url ?? null, meta.license, meta.attribution, meta.version ?? null, meta.retrieved ?? null)
    },

    get: (id) => q.get.get(id) ?? null,

    resolve(scheme, value) {
      if (value == null || value === '') return null
      return q.resolve.get(scheme, String(value))?.entity_id ?? null
    },

    xref(id, scheme, value) {
      if (value == null || value === '') return
      q.xref.run(id, scheme, String(value))
    },

    name(id, lang, name) {
      const n = name?.trim()
      if (n) q.name.run(id, lang, n)
    },

    /**
     * Crea la entidad o completa la que ya existe (por id o por cualquiera de sus xref).
     * @param {object} e  { id?, kind, name, name_en?, cc?, ccs?, admin1?, lat?, lng?, bbox?, fame?, hints?,
     *                     image?, thumb?, descr?, summary?, wiki?, wiki_lang?, tags?, xref?: { wd, gn, … },
     *                     names?: { es, en, … } | [lang, name][] }
     * @param {{ override?: boolean | string[] }} [opts]  true: pisa todos los campos; lista: solo esos
     * @returns {string} id de la entidad
     */
    entity(e, { override = false } = {}) {
      const xrefs = Object.entries(e.xref ?? {}).filter(([, v]) => v != null && v !== '')
      // con id explícito solo vale ese id (o un alias suyo); sin él, los ids externos que
      // identifican de verdad (no códigos compartidos como gna1 o iso2)
      let id = e.id ? (q.get.get(e.id) ? e.id : store.resolve('id', e.id) ?? store.resolve('wd', e.id)) : null
      if (!e.id) for (const [s, v] of xrefs) if (IDENTITY.has(s)) id ??= store.resolve(s, v)
      if (!id) {
        e.name ??= e.name_en
        if (!e.name) throw new Error(`entidad sin nombre: ${JSON.stringify(e.xref ?? e.id)}`)
        id = e.id ?? (e.xref?.wd ? e.xref.wd : xrefs.length ? `${xrefs[0][0]}:${xrefs[0][1]}` : null)
        if (!id) throw new Error(`entidad sin id: ${e.name}`)
        q.insert.run(id, ...FIELDS.map((f) => clean(f, e[f]) ?? (f === 'fame' || f === 'hints' ? 0 : null)), joinList(e.ccs), joinList(e.tags))
      } else {
        const cur = q.get.get(id)
        const set = {}
        for (const f of FIELDS) {
          const v = clean(f, e[f])
          if (v == null) continue
          if (f === 'fame' || f === 'hints') {
            if (v > (cur[f] ?? 0)) set[f] = v
          } else if (override === true || (Array.isArray(override) && override.includes(f)) || cur[f] == null || cur[f] === '') set[f] = v
        }
        const ccs = mergeList(cur.ccs, e.ccs)
        if (ccs !== cur.ccs) set.ccs = ccs
        const tags = mergeList(cur.tags, e.tags)
        if (tags !== cur.tags) set.tags = tags
        const keys = Object.keys(set)
        if (keys.length) db.prepare(`UPDATE entity SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => set[k]), id)
      }
      if (e.id) q.xref.run(id, 'id', e.id)
      for (const [s, v] of xrefs) q.xref.run(id, s, String(v))
      const names = Array.isArray(e.names) ? e.names : Object.entries(e.names ?? {})
      for (const [lang, n] of names) store.name(id, lang, n)
      store.name(id, 'es', e.name)
      if (e.name_en) store.name(id, 'en', e.name_en)
      return id
    },

    /** Añade etiquetas de filtro a una entidad existente. */
    tag(id, ...tags) {
      const cur = q.get.get(id)
      if (!cur) return
      const merged = mergeList(cur.tags, tags)
      if (merged !== cur.tags) db.prepare('UPDATE entity SET tags = ? WHERE id = ?').run(merged, id)
    },

    /**
     * @param {string} id
     * @param {string} key
     * @param {number|string|null} value
     * @param {{ scope?: string, unit?: string, year?: number, source: string, keep?: boolean }} opts
     *        keep: no reemplaza un valor ya guardado (prioridad de la primera fuente)
     */
    fact(id, key, value, { scope = '', unit = null, year = null, source, keep = false }) {
      if (value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value))) return
      const num = typeof value === 'number' ? value : null
      const text = typeof value === 'string' ? value : null
      ;(keep ? q.factKeep : q.fact).run(id, key, scope, num, text, unit, year ?? null, source)
    },

    relate(subject, predicate, object, source) {
      if (subject && object && subject !== object) q.relate.run(subject, predicate, object, source)
    },

    hint(id, hintId, cc) {
      q.hint.run(id, String(hintId), cc ?? null)
    },

    country(c) {
      db.prepare(`INSERT OR REPLACE INTO country (cc, entity_id, name, name_en, continent, subregion, flag, guide) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        c.cc, c.entity_id, c.name, c.name_en ?? null, c.continent ?? null, c.subregion ?? null, c.flag ?? null, c.guide ? 1 : 0,
      )
    },

    meta(key, value) {
      db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, typeof value === 'string' ? value : JSON.stringify(value))
    },

    /** Índices derivados (países, búsqueda, importancia, ordenación); se puede llamar antes de finish. */
    finalize() {
      finalize(db)
      finalized = true
    },

    /** Índices derivados (si faltan) y cierre. */
    finish({ publish = true } = {}) {
      if (!finalized) finalize(db)
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      db.close()
      if (fresh && publish) {
        for (const f of [`${file}-wal`, `${file}-shm`]) rmSync(f, { force: true })
        renameSync(target, file)
      }
      return file
    },

    /**
     * Funde la entidad `from` en `into`: ids externos, nombres, pistas, datos y relaciones
     * pasan a `into` (sin pisar lo que ya tenía) y `from` desaparece.
     */
    merge(from, into) {
      if (!from || !into || from === into) return
      const a = q.get.get(from)
      const b = q.get.get(into)
      if (!a || !b) return
      const fill = FIELDS.filter((f) => f !== 'kind' && (b[f] == null || b[f] === '') && a[f] != null)
      if (fill.length) db.prepare(`UPDATE entity SET ${fill.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).run(...fill.map((f) => a[f]), into)
      const tags = mergeList(b.tags, a.tags)
      const ccs = mergeList(b.ccs, a.ccs)
      db.prepare('UPDATE entity SET tags = ?, ccs = ?, fame = MAX(fame, ?) WHERE id = ?').run(tags, ccs, a.fame ?? 0, into)
      for (const [table, col] of [['entity_xref', 'entity_id'], ['entity_name', 'entity_id'], ['entity_hint', 'entity_id'], ['fact', 'entity_id'], ['relation', 'subject'], ['relation', 'object']]) {
        db.prepare(`UPDATE OR IGNORE ${table} SET ${col} = ? WHERE ${col} = ?`).run(into, from)
        db.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).run(from)
      }
      db.prepare("DELETE FROM relation WHERE subject = object").run()
      db.prepare('UPDATE entity SET admin1 = ? WHERE admin1 = ?').run(into, from)
      db.prepare('DELETE FROM entity WHERE id = ?').run(from)
      q.xref.run(into, 'id', from)
    },

    close: () => db.close(),
  }
  return store
}

function clean(f, v) {
  if (typeof v === 'string') v = v.trim()
  if (v === undefined || v === null || v === '') return null
  if (f === 'lat' || f === 'lng') return round(Number(v), 5)
  if (f === 'fame' || f === 'hints') return Math.round(Number(v)) || 0
  if (f === 'cc') return String(v).toLowerCase()
  if (f === 'kind') return canonicalKind(v)
  return v
}
const joinList = (v) => (Array.isArray(v) ? (v.length ? [...new Set(v)].join(',') : null) : v ?? null)
function mergeList(cur, add) {
  const extra = Array.isArray(add) ? add : add ? String(add).split(',') : []
  if (!extra.length) return cur
  const set = new Set([...(cur ? cur.split(',') : []), ...extra.filter(Boolean)])
  return [...set].join(',') || null
}

/**
 * - entity_country: cada entidad en todos sus países
 * - rank: importancia 0–1 (Wikipedias, con la población como apoyo en las ciudades)
 * - entity_fts: todos sus nombres para la búsqueda
 */
function finalize(db) {
  db.exec('BEGIN')
  db.exec('DELETE FROM entity_country')
  const add = db.prepare('INSERT OR IGNORE INTO entity_country (entity_id, cc) VALUES (?, ?)')
  for (const r of db.prepare('SELECT id, cc, ccs FROM entity').all()) {
    for (const cc of new Set([r.cc, ...(r.ccs ? r.ccs.split(',') : [])])) if (cc) add.run(r.id, cc)
  }
  // importancia: log de las Wikipedias (400 ≈ lo más conocido del mundo); en lugares
  // sin artículo, la población (10 M hab. ≈ 0,7) y las pistas aportan algo
  db.exec(`UPDATE entity SET rank = MIN(1, MAX(
      ln(1 + fame) / ln(401),
      COALESCE((SELECT 0.1 * log10(MAX(value, 1)) FROM fact WHERE entity_id = entity.id AND key = 'population' ORDER BY scope = 'city' DESC LIMIT 1), 0),
      0.05 * MIN(hints, 6)
    ))`)
  // ordenación: la población del ámbito de cada tipo (o, si no la tiene, la mayor); el resto, el máximo
  db.exec('DELETE FROM entity_sort')
  const popCase = `CASE e.kind ${Object.entries(KINDS.populationScope).filter(([k]) => k !== '_').map(([k, v]) => `WHEN '${k}' THEN '${v}'`).join(' ')} ELSE 'city' END`
  db.exec(`INSERT INTO entity_sort (key, entity_id, value)
    SELECT 'population', e.id, COALESCE(
      (SELECT value FROM fact WHERE entity_id = e.id AND key = 'population' AND scope = ${popCase}),
      (SELECT MAX(value) FROM fact WHERE entity_id = e.id AND key = 'population'))
    FROM entity e WHERE EXISTS (SELECT 1 FROM fact WHERE entity_id = e.id AND key = 'population' AND value IS NOT NULL)`)
  db.exec(`INSERT INTO entity_sort (key, entity_id, value)
    SELECT key, entity_id, MAX(value) FROM fact
    WHERE value IS NOT NULL AND key != 'population' AND instr(key, ':') = 0 GROUP BY key, entity_id`)
  db.exec(`INSERT INTO entity_sort (key, entity_id, value) SELECT 'hints', id, hints FROM entity WHERE hints > 0`)
  // la importancia también: ordenar por ella recorre el índice y se detiene al llenar la página
  db.exec(`INSERT INTO entity_sort (key, entity_id, value) SELECT 'rank', id, rank FROM entity`)
  // cuántos valores tiene cada orden (para que la API elija el camino más barato)
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('sort_counts', ?)").run(
    JSON.stringify(Object.fromEntries(db.prepare('SELECT key, COUNT(*) n FROM entity_sort GROUP BY key').all().map((r) => [r.key, r.n]))),
  )
  db.exec(`UPDATE country SET places = (SELECT COUNT(*) FROM entity_country ec JOIN entity e ON e.id = ec.entity_id
    WHERE ec.cc = country.cc AND e.kind NOT IN ('country', 'admin1'))`)
  db.exec('DELETE FROM entity_tag')
  const tag = db.prepare('INSERT OR IGNORE INTO entity_tag (tag, entity_id) VALUES (?, ?)')
  for (const r of db.prepare('SELECT id, tags FROM entity WHERE tags IS NOT NULL').all()) for (const t of r.tags.split(',')) if (t) tag.run(t, r.id)
  db.exec('DELETE FROM entity_fts')
  // en orden de importancia: FTS5 devuelve por rowid, así que las primeras coincidencias
  // ya son las más conocidas y la búsqueda no necesita leerlas todas
  db.exec(`INSERT INTO entity_fts (rowid, entity_id, names)
    SELECT ROW_NUMBER() OVER (ORDER BY e.rank DESC, e.id), n.entity_id, n.names
    FROM (SELECT entity_id, group_concat(name, ' | ') names FROM entity_name GROUP BY entity_id) n
    JOIN entity e ON e.id = n.entity_id`)
  db.exec('COMMIT')
  db.exec("INSERT INTO entity_fts(entity_fts) VALUES ('optimize')")
  db.exec('ANALYZE')
}

export function storeExists(file = GEO_DB) {
  return existsSync(file)
}
