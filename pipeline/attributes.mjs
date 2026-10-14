// Extracción de atributos de meta con DeepSeek: convierte la prosa de las
// pistas en objetos con rasgos comparables (bolardo: cuerpo blanco, reflector
// delantero rojo…), más las relaciones que el texto menciona: "también en
// Italia", "se confunde con Croacia (diferencia: …)".
//
// Tablas (reconstruidas por cada país+categoría procesado):
//   meta_objects      un objeto por diseño o variante de un país
//   object_traits     rasgo → valor, aplanado para contar países
//   object_relations  also_in / confused_with explícitos en el texto
// Y después, sin modelo:
//   trait_stats       para cada rasgo, cuántos y qué países lo tienen
//   object_matches    objetos de otros países con el mismo diseño

import { tx, now } from './lib/db.mjs'
import { createLlm } from './lib/llm.mjs'
import { createResolver } from './lib/countries.mjs'
import { OBJECT_TYPES, describeSchema, typesForCategory } from './lib/meta-schema.mjs'

export const ATTR_VERSION = 2
const CHUNK_CHARS = 7000
const CATEGORIES = [...new Set(Object.values(OBJECT_TYPES).flatMap((o) => o.categories))]

const SYSTEM = (types) => `You extract structured GeoGuessr meta from tips about one country.
Object types to look for and their attributes (use ONLY these values):
${describeSchema(types)}
Rules:
- One object per distinct design or variant. A country's main bollard and a regional bollard are two objects.
- "variant": "main" for the standard design used across the country, "regional" if specific to part of it, "special" for special uses (taxi, commercial, diplomatic, electric, temporary), "old" for designs being replaced.
- Set an attribute only when the tips state it. Never guess; omit unknown attributes.
- Bollards: "body_color" is the dominant colour of the post; "marking_color" the stripe, band or top of another colour. For "black-and-white" bollards the body is white unless the text says otherwise.
- Licence plates: an EU-style blue strip with stars on the left is "eu_blue"; use "blue" only for other blue strips.
- "features": other distinctive details as short phrases (max 6 words each), e.g. "two black bands", "reflector off-centre".
- "region": the region if the variant is specific to part of the country, else null.
- "also_in": ISO 3166-1 alpha-2 codes of OTHER countries where the tips say the same object is used.
- "confused_with": countries the tips say it looks similar to, with the difference in under 15 words.
- "tips": ids of the tips that describe the object.
- Ignore tips that do not describe these object types.
Answer only with JSON: {"objects": [{"type": "...", "variant": "main", "region": null, "attrs": {}, "features": [], "also_in": [], "confused_with": [{"country": "..", "difference": "..."}], "tips": []}]}`

function chunk(items, budget) {
  const out = []
  let cur = []
  let size = 0
  for (const it of items) {
    if (cur.length && size + it.text.length > budget) {
      out.push(cur)
      cur = []
      size = 0
    }
    cur.push(it)
    size += it.text.length
  }
  if (cur.length) out.push(cur)
  return out
}

export async function extractAttributes(db, { model = 'deepseek-flash', countries, categories } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta_objects (
      id            INTEGER PRIMARY KEY,
      country_code  TEXT NOT NULL,
      category      TEXT NOT NULL,
      type          TEXT NOT NULL,
      region        TEXT,
      attrs         TEXT NOT NULL,   -- JSON
      features      TEXT NOT NULL,   -- JSON
      hint_ids      TEXT NOT NULL,   -- JSON: pistas canónicas que lo describen
      model         TEXT,
      version       INTEGER NOT NULL,
      created_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS meta_objects_bucket ON meta_objects(country_code, category);
    CREATE TABLE IF NOT EXISTS object_traits (
      object_id     INTEGER NOT NULL,
      country_code  TEXT NOT NULL,
      type          TEXT NOT NULL,
      key           TEXT NOT NULL,
      value         TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS object_traits_kv ON object_traits(type, key, value);
    CREATE TABLE IF NOT EXISTS object_relations (
      object_id     INTEGER NOT NULL,
      country_code  TEXT NOT NULL,
      relation      TEXT NOT NULL,   -- also_in | confused_with
      other_country TEXT NOT NULL,
      note          TEXT
    );
  `)

  // columna añadida en la versión 2 del esquema
  const cols = db.prepare('PRAGMA table_info(meta_objects)').all().map((c) => c.name)
  if (!cols.includes('variant')) db.exec("ALTER TABLE meta_objects ADD COLUMN variant TEXT NOT NULL DEFAULT 'main'")

  const resolver = createResolver(db)
  const countryName = new Map(db.prepare('SELECT code, name FROM countries').all().map((r) => [r.code, r.name]))
  const hasTr = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'hint_translations'").get().n > 0

  const cats = categories?.length ? categories.filter((c) => CATEGORIES.includes(c)) : CATEGORIES
  const rows = db
    .prepare(
      `SELECT c.country_code cc, c.category cat, c.region, c.usefulness, h.id,
              ${hasTr ? "COALESCE(t.text, h.text)" : 'h.text'} AS text
       FROM clusters c JOIN hints h ON h.id = c.canonical_id
       ${hasTr ? "LEFT JOIN hint_translations t ON t.hint_id = h.id AND t.lang = 'en'" : ''}
       WHERE COALESCE(c.quality, 'ok') = 'ok' AND length(h.text) > 0 AND c.country_code IS NOT NULL
         AND c.category IN (${cats.map(() => '?').join(',')})
       ORDER BY c.country_code, c.category, c.usefulness DESC, h.id`,
    )
    .all(...cats)

  const buckets = new Map()
  for (const r of rows) {
    if (countries?.length && !countries.includes(r.cc)) continue
    const k = `${r.cc}|${r.cat}`
    if (!buckets.has(k)) buckets.set(k, { cc: r.cc, cat: r.cat, items: [] })
    const prefix = r.region ? `[region: ${r.region}] ` : ''
    buckets.get(k).items.push({ id: r.id, text: prefix + r.text.replace(/\s+/g, ' ').slice(0, 1500) })
  }

  const jobs = []
  for (const b of buckets.values()) {
    const types = typesForCategory(b.cat)
    for (const part of chunk(b.items, CHUNK_CHARS)) jobs.push({ ...b, types, part })
  }
  console.log(`[attributes] ${buckets.size} combinaciones país+categoría · ${jobs.length} llamadas (${model})`)

  const llm = createLlm({ model, concurrency: 10 })
  const results = new Map() // bucket → objetos validados
  const stats = { objects: 0, droppedValues: 0, droppedTypes: 0, relations: 0 }
  let done = 0

  const toCode = (v) => {
    if (typeof v !== 'string') return null
    const s = v.trim()
    if (/^[a-z]{2}$/i.test(s) && resolver.has(s.toLowerCase())) return s.toLowerCase()
    return resolver.lookup(s).code
  }

  await Promise.all(
    jobs.map(async (job) => {
      const tips = job.part.map((t, i) => `[${i + 1}] ${t.text}`).join('\n')
      const answer = await llm.json(
        [
          { role: 'system', content: SYSTEM(job.types) },
          {
            role: 'user',
            content: `Country: ${countryName.get(job.cc) ?? job.cc}. Object types: ${job.types.join(', ')}.\nTips:\n${tips}`,
          },
        ],
        { maxTokens: 6000 },
      )
      const key = `${job.cc}|${job.cat}`
      if (!results.has(key)) results.set(key, [])
      for (const o of answer?.objects ?? []) {
        const schema = OBJECT_TYPES[o?.type]
        if (!schema || !job.types.includes(o.type)) {
          stats.droppedTypes++
          continue
        }
        const attrs = {}
        for (const [k, v] of Object.entries(o.attrs ?? {})) {
          const val = typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, '_') : null
          const allowed = schema.attrs[k]?.map((x) => x.toLowerCase())
          if (allowed && val && allowed.includes(val)) attrs[k] = val
          else stats.droppedValues++
        }
        const features = (Array.isArray(o.features) ? o.features : [])
          .filter((f) => typeof f === 'string' && f.trim())
          .map((f) => f.trim().slice(0, 60))
          .slice(0, 8)
        const alsoIn = [...new Set((o.also_in ?? []).map(toCode).filter((c) => c && c !== job.cc))]
        const confused = (o.confused_with ?? [])
          .map((c) => ({ country: toCode(c?.country), difference: typeof c?.difference === 'string' ? c.difference.slice(0, 160) : null }))
          .filter((c) => c.country && c.country !== job.cc)
        const hintIds = (o.tips ?? []).map(Number).filter((n) => n >= 1 && n <= job.part.length).map((n) => job.part[n - 1].id)
        if (Object.keys(attrs).length === 0 && features.length === 0) continue
        const region = typeof o.region === 'string' && o.region.trim() ? o.region.trim().slice(0, 80) : null
        const variant = ['main', 'regional', 'special', 'old'].includes(o.variant) ? o.variant : region ? 'regional' : 'main'
        results.get(key).push({
          type: o.type,
          variant,
          region,
          attrs, features, alsoIn, confused, hintIds,
        })
      }
      done++
      if (done % 50 === 0) console.log(`[attributes] ${done}/${jobs.length} · ${llm.cost().toFixed(3)} USD`)
    }),
  )

  // ── guardar: se reemplazan los objetos de cada país+categoría procesado ──
  const del = (table) => db.prepare(`DELETE FROM ${table} WHERE object_id IN (SELECT id FROM meta_objects WHERE country_code = ? AND category = ?)`)
  const delTraits = del('object_traits')
  const delRels = del('object_relations')
  const delObjs = db.prepare('DELETE FROM meta_objects WHERE country_code = ? AND category = ?')
  const insObj = db.prepare(`INSERT INTO meta_objects (country_code, category, type, variant, region, attrs, features, hint_ids, model, version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
  const insTrait = db.prepare('INSERT INTO object_traits (object_id, country_code, type, key, value) VALUES (?, ?, ?, ?, ?)')
  const insRel = db.prepare('INSERT INTO object_relations (object_id, country_code, relation, other_country, note) VALUES (?, ?, ?, ?, ?)')

  const ts = now()
  tx(db, () => {
    for (const [key, objects] of results) {
      const [cc, cat] = key.split('|')
      delTraits.run(cc, cat)
      delRels.run(cc, cat)
      delObjs.run(cc, cat)
      // fusionar objetos idénticos que vinieron de trozos distintos
      const merged = new Map()
      for (const o of objects) {
        const k = `${o.type}|${o.variant}|${o.region ?? ''}|${JSON.stringify(Object.entries(o.attrs).sort())}`
        const prev = merged.get(k)
        if (!prev) merged.set(k, o)
        else {
          prev.features = [...new Set([...prev.features, ...o.features])].slice(0, 10)
          prev.alsoIn = [...new Set([...prev.alsoIn, ...o.alsoIn])]
          prev.confused = [...prev.confused, ...o.confused]
          prev.hintIds = [...new Set([...prev.hintIds, ...o.hintIds])]
        }
      }
      for (const o of merged.values()) {
        const { id } = insObj.get(cc, cat, o.type, o.variant, o.region, JSON.stringify(o.attrs), JSON.stringify(o.features),
          JSON.stringify(o.hintIds), model, ATTR_VERSION, ts)
        for (const [k, v] of Object.entries(o.attrs)) insTrait.run(id, cc, o.type, k, v)
        for (const c of o.alsoIn) insRel.run(id, cc, 'also_in', c, null)
        for (const c of o.confused) insRel.run(id, cc, 'confused_with', c.country, c.difference)
        stats.objects++
        stats.relations += o.alsoIn.length + o.confused.length
      }
    }
  })

  const u = llm.usage
  console.log(
    `[attributes] ✓ ${stats.objects} objetos · ${stats.relations} relaciones entre países · ` +
      `${stats.droppedValues} valores fuera de vocabulario descartados · ${stats.droppedTypes} tipos inválidos · ` +
      `${u.calls} llamadas, ${u.cached} desde caché, ${u.failed} fallidas · coste ≈ ${llm.cost().toFixed(3)} USD`,
  )
  computeTraitStats(db)
}

/**
 * Sin modelo: cuántos países tiene cada rasgo y qué objetos de otros países
 * comparten diseño. Dos objetos del mismo tipo "coinciden" si comparten al
 * menos la mitad de los rasgos del esquema (4 de 8 en bolardos) y no se
 * contradicen en ninguno: con menos, rasgos genéricos como "blanco con
 * reflector rojo" emparejaban medio continente.
 */
export function computeTraitStats(db) {
  db.exec(`
    DROP TABLE IF EXISTS trait_stats;
    CREATE TABLE trait_stats (
      type TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
      countries TEXT NOT NULL,  -- JSON
      n INTEGER NOT NULL,
      PRIMARY KEY (type, key, value)
    );
    DROP TABLE IF EXISTS object_matches;
    CREATE TABLE object_matches (
      object_id INTEGER NOT NULL, other_id INTEGER NOT NULL, other_country TEXT NOT NULL,
      shared INTEGER NOT NULL, total INTEGER NOT NULL
    );
  `)
  const rows = db
    .prepare("SELECT type, key, value, GROUP_CONCAT(DISTINCT country_code) cs FROM object_traits WHERE value NOT IN ('other','none') GROUP BY type, key, value")
    .all()
  const ins = db.prepare('INSERT INTO trait_stats (type, key, value, countries, n) VALUES (?, ?, ?, ?, ?)')
  tx(db, () => {
    for (const r of rows) {
      const cs = r.cs.split(',')
      ins.run(r.type, r.key, r.value, JSON.stringify(cs), cs.length)
    }
  })

  const objects = db.prepare('SELECT id, country_code, type, attrs FROM meta_objects').all()
    .map((o) => ({ ...o, attrs: JSON.parse(o.attrs) }))
  const byType = new Map()
  for (const o of objects) {
    if (!byType.has(o.type)) byType.set(o.type, [])
    byType.get(o.type).push(o)
  }
  const insMatch = db.prepare('INSERT INTO object_matches (object_id, other_id, other_country, shared, total) VALUES (?, ?, ?, ?, ?)')
  let matches = 0
  tx(db, () => {
    for (const [type, list] of byType) {
      const minShared = Math.max(2, Math.ceil(Object.keys(OBJECT_TYPES[type].attrs).length / 2))
      for (const a of list)
        for (const b of list) {
          if (a.country_code === b.country_code || a.id === b.id) continue
          const keys = Object.keys(a.attrs).filter((k) => k in b.attrs && !['other', 'none'].includes(a.attrs[k]))
          const shared = keys.filter((k) => a.attrs[k] === b.attrs[k]).length
          const conflict = keys.length - shared
          if (shared >= minShared && conflict === 0) {
            insMatch.run(a.id, b.id, b.country_code, shared, Object.keys(a.attrs).length)
            matches++
          }
        }
    }
  })
  console.log(`[attributes] ✓ ${rows.length} rasgos con su lista de países · ${matches} coincidencias de diseño entre países`)
}
