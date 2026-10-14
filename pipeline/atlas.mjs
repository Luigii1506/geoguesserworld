// Atlas: los lugares más importantes de cada país (volcanes, montañas, ríos,
// lagos, ciudades, templos, castillos, parques, islas, sitios UNESCO…) desde
// Wikidata, con sus datos (nombre en español, foto, altura, población,
// longitud, UNESCO) y el resumen de Wikipedia. Gratis (Wikidata/Wikipedia).
//
//   npm run pipeline -- atlas        (luego `export`)
//
// "Importante" = en cuántas Wikipedias tiene artículo (sitelinks): mide muy bien
// lo conocido que es un lugar.

import { tx, now } from './lib/db.mjs'

const UA = 'GeoMastery/0.1 (personal GeoGuessr study app; https://github.com/Luigii1506/geoguesserworld)'
const SPARQL = 'https://query.wikidata.org/sparql'

// clase de Wikidata (con sus subclases directas) → tipo, cuántos por país y mínimo de Wikipedias
const CATEGORIES = [
  // volcanes y montañas: los más conocidos y, además, los más altos de cada país
  { type: 'volcano', classes: ['Q8072'], per: 15, min: 3, tallest: 8 },
  { type: 'mountain', classes: ['Q8502'], per: 12, min: 6, tallest: 8 },
  { type: 'range', classes: ['Q46831'], per: 6, min: 8 },
  { type: 'river', classes: ['Q4022'], per: 10, min: 8 },
  { type: 'lake', classes: ['Q23397'], per: 8, min: 6 },
  { type: 'waterfall', classes: ['Q34038'], per: 6, min: 4 },
  { type: 'island', classes: ['Q23442'], per: 8, min: 8 },
  { type: 'desert', classes: ['Q8514'], per: 4, min: 4 },
  { type: 'national_park', classes: ['Q46169'], per: 8, min: 5 },
  // ciudades: sin subclases (la consulta sería demasiado pesada) y con población mínima
  // ciudades: varias clases (ciudad, gran ciudad, capital, ciudad con rango de condado, municipio urbano…)
  { type: 'city', classes: ['Q515', 'Q1549591', 'Q5119', 'Q1637706', 'Q200250', 'Q13218690', 'Q15284', 'Q3957', 'Q7930989'], per: 15, min: 15, direct: true, minPop: 50000 },
  // iglesias: catedrales y basílicas ("iglesia" genérica tiene demasiados elementos y la consulta se corta)
  { type: 'church', classes: ['Q2977', 'Q163687', 'Q120560', 'Q56242215'], per: 6, min: 8, direct: true },
  { type: 'mosque', classes: ['Q32815'], per: 6, min: 8 },
  { type: 'temple', classes: ['Q5393308', 'Q842402', 'Q845945', 'Q44539', 'Q160742', 'Q1128397'], per: 6, min: 6, direct: true },
  { type: 'castle', classes: ['Q23413'], per: 6, min: 10 },
  { type: 'palace', classes: ['Q16560'], per: 5, min: 10 },
  { type: 'archaeological', classes: ['Q839954', 'Q15661340', 'Q2232001'], per: 6, min: 8, direct: true },
  { type: 'monument', classes: ['Q4989906', 'Q570116', 'Q575759', 'Q11303'], per: 6, min: 12, direct: true },
  { type: 'bridge', classes: ['Q12280', 'Q158218', 'Q537127'], per: 3, min: 15, direct: true },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function sparql(query) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${SPARQL}?${new URLSearchParams({ query })}`, {
        headers: { accept: 'application/sparql-results+json', 'user-agent': UA },
        signal: AbortSignal.timeout(65_000),
      })
      if (res.status === 429 || res.status >= 500) {
        await sleep(10_000 * (attempt + 1))
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // si la consulta se corta a medias, Wikidata pega el error dentro del JSON: no es válido
      const text = await res.text()
      try {
        return JSON.parse(text).results.bindings
      } catch {
        throw new Error('respuesta cortada (timeout de Wikidata)')
      }
    } catch (e) {
      if (attempt === 1) throw e
      await sleep(5000)
    }
  }
  return []
}

const qid = (uri) => uri.split('/').pop()

const EXTRA_COLS = { gvp: 'INTEGER', volcanic: 'INTEGER', dissolved: 'INTEGER', ccs: 'TEXT', area_km2: 'REAL', discharge: 'REAL', basin_km2: 'REAL', prominence: 'REAL', depth: 'REAL', visitors: 'INTEGER', countries: 'INTEGER' }

export function ensureAtlasTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS atlas (
    qid TEXT PRIMARY KEY, cc TEXT NOT NULL, type TEXT NOT NULL, sitelinks INTEGER,
    name_es TEXT, name_en TEXT, description TEXT, lat REAL, lng REAL, image TEXT,
    elevation REAL, population INTEGER, length_km REAL, unesco INTEGER,
    area_km2 REAL, discharge REAL, basin_km2 REAL, prominence REAL, depth REAL, visitors INTEGER, countries INTEGER,
    es_title TEXT, en_title TEXT, extract TEXT, extract_lang TEXT, updated_at TEXT
  )`)
  const cols = new Set(db.prepare('PRAGMA table_info(atlas)').all().map((c) => c.name))
  for (const [c, t] of Object.entries(EXTRA_COLS)) if (!cols.has(c)) db.exec(`ALTER TABLE atlas ADD COLUMN ${c} ${t}`)
}

/**
 * Métricas de Wikidata de los lugares ya guardados. Una consulta pequeña por
 * dato (una sola con todo multiplicaba las combinaciones y Wikidata la cortaba).
 */
async function fetchMetrics(db, ids) {
  const quantity = (prop, col, div = 1) => ({
    col,
    q: (vals) => `SELECT ?item (MAX(?v) AS ?x) WHERE { VALUES ?item { ${vals} } ?item p:${prop}/psn:${prop}/wikibase:quantityAmount ?v . } GROUP BY ?item`,
    map: (r) => Math.round((Number(r.x.value) / div) * 10) / 10,
  })
  const METRICS = [
    quantity('P2046', 'area_km2', 1e6),
    quantity('P2225', 'discharge'),
    quantity('P2053', 'basin_km2', 1e6),
    quantity('P2660', 'prominence'),
    quantity('P4511', 'depth'),
    { col: 'gvp', q: (vals) => `SELECT ?item (SAMPLE(?v) AS ?x) WHERE { VALUES ?item { ${vals} } ?item wdt:P1886 ?v . } GROUP BY ?item`, map: (r) => Number(r.x.value) },
    { col: 'visitors', q: (vals) => `SELECT ?item (MAX(?v) AS ?x) WHERE { VALUES ?item { ${vals} } ?item wdt:P1174 ?v . } GROUP BY ?item`, map: (r) => Math.round(Number(r.x.value)) },
    {
      col: 'ccs',
      q: (vals) => `SELECT ?item (GROUP_CONCAT(DISTINCT ?iso; separator=",") AS ?x) WHERE { VALUES ?item { ${vals} } ?item wdt:P17 ?c . ?c wdt:P297 ?iso . } GROUP BY ?item`,
      map: (r) => r.x.value.toLowerCase(),
      also: (r) => ['countries', r.x.value.split(',').length],
    },
    // es volcán: por clase (hasta 3 niveles) o por tener número del Programa Global de
    // Vulcanismo del Smithsonian (Ojos del Salado o Pissis solo constan como "montaña")
    { col: 'volcanic', q: (vals) => `SELECT DISTINCT ?item (1 AS ?x) WHERE { VALUES ?item { ${vals} } { ?item wdt:P31/wdt:P279?/wdt:P279?/wdt:P279? wd:Q8072 . } UNION { ?item wdt:P1886 ?gvp . } }`, map: () => 1 },
    // ya no existe: fecha de disolución o clase "paleo-/former/historical/ancient" (lago Tauca…)
    {
      col: 'dissolved',
      // 2 = clase paleo/antigua (desaparecido de verdad); 1 = solo fecha de disolución
      q: (vals) => `SELECT ?item (MAX(?k) AS ?x) WHERE { VALUES ?item { ${vals} }
        { ?item wdt:P576 ?end . BIND(1 AS ?k) } UNION { ?item wdt:P31 ?c . ?c rdfs:label ?l . FILTER(lang(?l) = "en" && REGEX(?l, "^(paleo|palaeo|former|historical|ancient|extinct lake)", "i")) BIND(2 AS ?k) } } GROUP BY ?item`,
      map: (r) => Number(r.x.value),
    },
  ]
  for (const m of METRICS) {
    const set = db.prepare(`UPDATE atlas SET ${m.col} = ? WHERE qid = ?`)
    let got = 0
    let failed = 0
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150)
      const rows = await sparql(m.q(chunk.map((q) => `wd:${q}`).join(' '))).catch(() => {
        failed++
        return []
      })
      tx(db, () => {
        for (const r of rows) {
          if (!r.x) continue
          set.run(m.map(r), qid(r.item.value))
          if (m.also) {
            const [c, v] = m.also(r)
            db.prepare(`UPDATE atlas SET ${c} = ? WHERE qid = ?`).run(v, qid(r.item.value))
          }
          got++
        }
      })
      await sleep(300)
    }
    console.log(`[atlas] métrica ${m.col.padEnd(11)} ${got} lugares${failed ? ` · ${failed} consultas fallidas` : ''}`)
  }
  // población: la cifra más reciente (no la mayor)
  const setPop = db.prepare('UPDATE atlas SET population = ? WHERE qid = ?')
  let pops = 0
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150)
    const rows = await sparql(`SELECT ?item ?pop ?t WHERE {
      VALUES ?item { ${chunk.map((q) => `wd:${q}`).join(' ')} }
      ?item p:P1082 ?st . ?st ps:P1082 ?pop . OPTIONAL { ?st pq:P585 ?t }
    }`).catch(() => [])
    const latest = new Map()
    for (const r of rows) {
      const id = qid(r.item.value)
      const t = r.t?.value ? Date.parse(r.t.value) : 0
      const prev = latest.get(id)
      if (!prev || t > prev.t) latest.set(id, { t, pop: Math.round(Number(r.pop.value)) })
    }
    tx(db, () => {
      for (const [id, v] of latest) setPop.run(v.pop, id)
    })
    pops += latest.size
    await sleep(300)
  }
  console.log(`[atlas] métrica population  ${pops} lugares (cifra más reciente)`)
}

export async function atlas(db, { only } = {}) {
  ensureAtlasTable(db)
  // solo métricas de lo ya guardado: npm run pipeline -- atlas metricas
  if (only?.includes('metricas')) {
    const ids = db.prepare('SELECT qid FROM atlas').all().map((r) => r.qid)
    await fetchMetrics(db, ids)
    return console.log(`[atlas] ✓ métricas de ${ids.length} lugares`)
  }
  const withGuide = new Set(
    db.prepare("SELECT DISTINCT lower(country_code) cc FROM clusters WHERE country_code IS NOT NULL").all().map((r) => r.cc),
  )

  // QID de cada país (para el plan B: consultas país por país)
  const countryQ = new Map()
  for (const r of await sparql(`SELECT ?c ?cc WHERE { ?c wdt:P297 ?cc . ?c wdt:P31/wdt:P279* wd:Q6256 . }`).catch(() => [])) {
    const cc = r.cc.value.toLowerCase()
    if (withGuide.has(cc) && !countryQ.has(cc)) countryQ.set(cc, qid(r.c.value))
  }
  for (const r of await sparql(`SELECT ?c ?cc WHERE { ?c wdt:P297 ?cc . }`).catch(() => [])) {
    const cc = r.cc.value.toLowerCase()
    if (withGuide.has(cc) && !countryQ.has(cc)) countryQ.set(cc, qid(r.c.value))
  }

  // 1) candidatos: por categoría, en todo el mundo, con su país y su número de Wikipedias
  const picked = new Map() // qid → { cc, type, sl }
  // datos de cada lugar elegido, de 150 en 150 (se guarda en cuanto se elige cada categoría)
  const save = db.prepare(`INSERT INTO atlas (qid, cc, type, sitelinks, name_es, name_en, description, lat, lng, image, elevation, population, length_km, unesco, es_title, en_title, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(qid) DO UPDATE SET cc=excluded.cc, type=excluded.type, sitelinks=excluded.sitelinks, name_es=excluded.name_es,
      name_en=excluded.name_en, description=excluded.description, lat=excluded.lat, lng=excluded.lng, image=excluded.image,
      elevation=excluded.elevation, population=excluded.population, length_km=excluded.length_km, unesco=excluded.unesco,
      es_title=excluded.es_title, en_title=excluded.en_title, updated_at=excluded.updated_at`)
  const saveDetails = async (ids) => {
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150)
    const rows = await sparql(`SELECT ?item (SAMPLE(?coord) AS ?c) (SAMPLE(?es) AS ?les) (SAMPLE(?en) AS ?len) (SAMPLE(?desc) AS ?d)
        (SAMPLE(?img) AS ?image) (MAX(?ele) AS ?elev) (MAX(?pop) AS ?popu) (MAX(?lenm) AS ?long) (COUNT(?wh) AS ?u)
        (SAMPLE(?esT) AS ?esTitle) (SAMPLE(?enT) AS ?enTitle) WHERE {
      VALUES ?item { ${chunk.map((q) => `wd:${q}`).join(' ')} }
      OPTIONAL { ?item wdt:P625 ?coord }
      OPTIONAL { ?item rdfs:label ?es FILTER(lang(?es) = "es") }
      OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en) = "en" || lang(?en) = "mul") }
      OPTIONAL { ?item schema:description ?desc FILTER(lang(?desc) = "es") }
      OPTIONAL { ?item wdt:P18 ?img }
      OPTIONAL { ?item p:P2044/psn:P2044/wikibase:quantityAmount ?ele }
      OPTIONAL { ?item wdt:P1082 ?pop }
      OPTIONAL { ?item p:P2043/psn:P2043/wikibase:quantityAmount ?lenm }
      OPTIONAL { ?item wdt:P1435 ?wh FILTER(?wh = wd:Q9259) }
      OPTIONAL { ?esA schema:about ?item; schema:isPartOf <https://es.wikipedia.org/>; schema:name ?esT }
      OPTIONAL { ?enA schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?enT }
    } GROUP BY ?item`).catch(() => [])
    tx(db, () => {
      for (const r of rows) {
        const id = qid(r.item.value)
        const p = picked.get(id)
        const m = r.c?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/)
        if (!p || !m) continue
        const img = r.image?.value ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(r.image.value.split('/').pop()))}` : null
        save.run(
          id, p.cc, p.type, p.sl, r.les?.value ?? null, r.len?.value ?? null, r.d?.value ?? null, Number(m[2]), Number(m[1]), img,
          r.elev ? Math.round(Number(r.elev.value)) : null, r.popu ? Math.round(Number(r.popu.value)) : null,
          // valores normalizados al SI (psn:): altura en metros, longitud en metros → km
          r.long ? Math.round(Number(r.long.value) / 1000) : null,
          Number(r.u?.value ?? 0) > 0 ? 1 : 0, r.esTitle?.value ?? null, r.enTitle?.value ?? null, now(),
        )
      }
    })
    if ((i / 150) % 10 === 0) console.log(`[atlas] datos ${Math.min(i + 150, ids.length)}/${ids.length}`)
    await sleep(800)
  }
  }


  // ── nombres que faltan: Wikidata guarda muchos en la etiqueta multilingüe "mul" ──
  if (only?.includes('nombres')) {
    const ids = db.prepare('SELECT qid FROM atlas WHERE name_es IS NULL AND name_en IS NULL').all().map((r) => r.qid)
    const set = db.prepare('UPDATE atlas SET name_es = COALESCE(name_es, ?), name_en = COALESCE(name_en, ?) WHERE qid = ?')
    let got = 0
    for (let i = 0; i < ids.length; i += 200) {
      const rows = await sparql(`SELECT ?item (SAMPLE(?es) AS ?les) (SAMPLE(?en) AS ?len) (SAMPLE(?mul) AS ?lmul) (SAMPLE(?any) AS ?lany) WHERE {
        VALUES ?item { ${ids.slice(i, i + 200).map((q) => `wd:${q}`).join(' ')} }
        OPTIONAL { ?item rdfs:label ?es FILTER(lang(?es) = "es") }
        OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en) = "en") }
        OPTIONAL { ?item rdfs:label ?mul FILTER(lang(?mul) = "mul") }
        OPTIONAL { ?item rdfs:label ?any FILTER(lang(?any) IN ("fr", "de", "pt", "it", "ca")) }
      } GROUP BY ?item`).catch(() => [])
      tx(db, () => {
        for (const r of rows) {
          const en = r.len?.value ?? r.lmul?.value ?? r.lany?.value ?? null
          if (!r.les && !en) continue
          set.run(r.les?.value ?? null, en, qid(r.item.value))
          got++
        }
      })
      await sleep(400)
    }
    return console.log(`[atlas] ✓ nombres de ${got} de ${ids.length} lugares sin nombre`)
  }

  // ── lugares de las pistas que no están en el atlas: se unen por su QID ──
  if (only?.includes('unir')) {
    const cols = new Set(db.prepare('PRAGMA table_info(place_info)').all().map((c) => c.name))
    if (cols.has('qid')) {
      const rows = db
        .prepare(
          `SELECT i.qid, MIN(hp.cc) cc, MIN(i.type) type, MAX(i.sitelinks) sl FROM place_info i
           JOIN hint_places hp ON lower(COALESCE(hp.cc, '')) || '|' || lower(trim(hp.query)) = i.key
           WHERE i.qid IS NOT NULL AND i.qid NOT IN (SELECT qid FROM atlas) AND hp.cc IS NOT NULL
           GROUP BY i.qid`,
        )
        .all()
      for (const r of rows) picked.set(r.qid, { cc: r.cc, type: r.type ?? 'other', sl: r.sl ?? 0 })
      console.log(`[atlas] unir: ${rows.length} lugares de las pistas`)
      await saveDetails([...picked.keys()])
    }
  }

  // ── imprescindibles del mundo: listas de referencia, sin depender de GeoGuessr ──
  if (only?.includes('mundial')) {
    const WORLD = [
      { type: 'river', classes: ['Q4022'], by: 'P2043', n: 150 },
      { type: 'mountain', classes: ['Q8502'], by: 'P2044', n: 150 },
      { type: 'mountain', classes: ['Q8502'], by: 'P2660', n: 100 },
      { type: 'volcano', classes: ['Q8072', 'Q169358', 'Q212057'], by: 'P2044', n: 100 },
      { type: 'lake', classes: ['Q23397'], by: 'P2046', n: 100 },
      { type: 'island', classes: ['Q23442'], by: 'P2046', n: 100 },
      { type: 'desert', classes: ['Q8514'], by: 'P2046', n: 40 },
      { type: 'waterfall', classes: ['Q34038'], by: 'P2048', n: 50 },
      { type: 'city', classes: ['Q515', 'Q1549591', 'Q5119', 'Q1637706', 'Q200250'], by: 'pop', n: 300 },
      { type: 'river', classes: ['Q4022'], by: 'sl', n: 200 },
      { type: 'mountain', classes: ['Q8502'], by: 'sl', n: 200 },
      { type: 'volcano', classes: ['Q8072', 'Q169358'], by: 'sl', n: 120 },
      { type: 'lake', classes: ['Q23397'], by: 'sl', n: 150 },
      { type: 'island', classes: ['Q23442'], by: 'sl', n: 150 },
      { type: 'city', classes: ['Q515', 'Q1549591', 'Q5119', 'Q1637706'], by: 'sl', n: 300 },
      { type: 'national_park', classes: ['Q46169'], by: 'sl', n: 150 },
      { type: 'church', classes: ['Q2977', 'Q163687', 'Q120560'], by: 'sl', n: 150 },
      { type: 'mosque', classes: ['Q32815'], by: 'sl', n: 100 },
      { type: 'temple', classes: ['Q5393308', 'Q842402', 'Q845945', 'Q44539'], by: 'sl', n: 150 },
      { type: 'castle', classes: ['Q23413'], by: 'sl', n: 150 },
      { type: 'palace', classes: ['Q16560'], by: 'sl', n: 100 },
      { type: 'archaeological', classes: ['Q839954'], by: 'sl', n: 150 },
      { type: 'bridge', classes: ['Q12280'], by: 'sl', n: 80 },
      { type: 'monument', classes: ['Q4989906', 'Q570116'], by: 'sl', n: 150 },
      { type: 'heritage', unesco: true, by: 'sl', n: 300 },
    ]
    const known = new Set(db.prepare('SELECT qid FROM atlas').all().map((r) => r.qid))
    // imprescindibles que Wikidata clasifica de forma que las consultas no los encuentran
    const MUST = [
      { qid: 'Q4148644', type: 'island', cc: 'gl' }, // isla de Groenlandia
    ]
    for (const m of MUST) if (!known.has(m.qid)) picked.set(m.qid, { cc: m.cc, type: m.type, sl: 200 })
    for (const w of WORLD) {
      const cls = w.unesco ? '?item wdt:P1435 wd:Q9259 .' : `VALUES ?cls { ${w.classes.map((q) => `wd:${q}`).join(' ')} } ?item wdt:P31 ?cls .`
      const val =
        w.by === 'sl' ? '' : w.by === 'pop' ? '?item wdt:P1082 ?v .' : `?item p:${w.by}/psn:${w.by}/wikibase:quantityAmount ?v .`
      const order = w.by === 'sl' ? 'DESC(?s)' : 'DESC(?val)'
      const rows = await sparql(`SELECT ?item (MAX(?v) AS ?val) (MAX(?sl) AS ?s) (SAMPLE(?iso) AS ?cc) WHERE {
        ${cls} ${val} ?item wikibase:sitelinks ?sl; wdt:P625 ?coord .
        OPTIONAL { ?item wdt:P17 ?ct . ?ct wdt:P297 ?iso }
      } GROUP BY ?item ORDER BY ${order} LIMIT ${w.n}`).catch((e) => {
        console.warn(`[atlas] mundial ${w.type}/${w.by}: ${e.message}`)
        return []
      })
      let added = 0
      for (const r of rows) {
        const id = qid(r.item.value)
        if (!r.cc?.value || picked.has(id) || known.has(id)) continue
        added++
        picked.set(id, { cc: r.cc.value.toLowerCase(), type: w.type, sl: Number(r.s.value) })
      }
      console.log(`[atlas] mundial ${w.type.padEnd(14)} por ${w.by.padEnd(5)} ${rows.length} → ${added} nuevos`)
      await sleep(1200)
    }
    // los ya guardados conservan su tipo: solo se añaden los nuevos (luego métricas y resúmenes)
    await saveDetails([...picked.keys()])
    await fetchMetrics(db, [...picked.keys()])
  }

  let eleOf = null
  for (const c of CATEGORIES.filter((x) => (!only || only.includes(x.type)) && !only?.includes('mundial') && !only?.includes('unir'))) {
    eleOf = null
    const values = c.classes.map((q) => `wd:${q}`).join(' ')
    const rows = await sparql(`SELECT DISTINCT ?item ?sl ?cc ${c.tallest ? '?ele' : ''} WHERE {
      VALUES ?cls { ${values} }
      ?item ${c.direct ? 'wdt:P31' : 'wdt:P31/wdt:P279?'} ?cls; wikibase:sitelinks ?sl .
      FILTER(?sl >= ${c.tallest ? 2 : c.min})
      ${c.tallest ? 'OPTIONAL { ?item p:P2044/psn:P2044/wikibase:quantityAmount ?ele }' : ''}
      ${c.minPop ? `?item wdt:P1082 ?pop . FILTER(?pop >= ${c.minPop})` : ''}
      ?item wdt:P625 ?coord; wdt:P17 ?c . ?c wdt:P297 ?cc .
    }`).catch((e) => {
      console.warn(`[atlas] ${c.type}: ${e.message}`)
      return []
    })
    const byCc = new Map()
    for (const r of rows) {
      const cc = r.cc.value.toLowerCase()
      if (!withGuide.has(cc)) continue
      if (!byCc.has(cc)) byCc.set(cc, new Map())
      byCc.get(cc).set(qid(r.item.value), Number(r.sl.value))
      if (c.tallest && r.ele) (eleOf ??= new Map()).set(qid(r.item.value), Number(r.ele.value))
    }
    // plan B: la consulta mundial se cortó → país por país (pequeñas y rápidas)
    if (!rows.length) {
      console.log(`[atlas] ${c.type}: consulta mundial cortada, voy país por país (${countryQ.size})`)
      for (const [cc, cq] of countryQ) {
        const part = await sparql(`SELECT DISTINCT ?item ?sl WHERE {
          VALUES ?cls { ${values} }
          ?item wdt:P17 wd:${cq}; wdt:P31 ?cls; wikibase:sitelinks ?sl .
          FILTER(?sl >= ${Math.max(3, Math.floor(c.min / 2))})
          ${c.minPop ? `?item wdt:P1082 ?pop . FILTER(?pop >= ${c.minPop})` : ''}
          ?item wdt:P625 ?coord .
        } ORDER BY DESC(?sl) LIMIT ${c.per * 2}`).catch(() => [])
        for (const r of part) {
          if (!byCc.has(cc)) byCc.set(cc, new Map())
          byCc.get(cc).set(qid(r.item.value), Number(r.sl.value))
        }
        await sleep(250)
      }
    }
    let n = 0
    for (const [cc, items] of byCc) {
      // los más conocidos (con el mínimo de Wikipedias)…
      const known = [...items.entries()].filter(([, sl]) => sl >= c.min).sort((a, b) => b[1] - a[1]).slice(0, c.per)
      // …y los más altos aunque sean poco conocidos
      const tall = c.tallest && eleOf
        ? [...items.entries()].filter(([id]) => eleOf.has(id)).sort((a, b) => eleOf.get(b[0]) - eleOf.get(a[0])).slice(0, c.tallest)
        : []
      const top = [...new Map([...known, ...tall]).entries()]
      for (const [id, sl] of top) {
        // un mismo lugar en dos categorías (catedral y UNESCO…): la primera que lo eligió
        if (!picked.has(id)) {
          picked.set(id, { cc, type: c.type, sl })
          n++
        }
      }
    }
    console.log(`[atlas] ${c.type.padEnd(15)} ${rows.length || 'país a país'} candidatos → ${n} elegidos en ${byCc.size} países`)
    await saveDetails([...picked.entries()].filter(([, p]) => p.type === c.type).map(([id]) => id))
    await sleep(1500)
  }
  // sitios UNESCO (todos los del país), como monumentos si no estaban ya
  if ((!only || only.includes('unesco')) && !only?.includes('mundial') && !only?.includes('unir')) {
    let rows = await sparql(`SELECT ?item ?sl ?cc WHERE {
      ?item wdt:P1435 wd:Q9259; wikibase:sitelinks ?sl; wdt:P625 ?coord; wdt:P17 ?c . ?c wdt:P297 ?cc .
    }`).catch(() => [])
    // plan B: país por país
    if (!rows.length) {
      rows = []
      for (const [cc, cq] of countryQ) {
        const part = await sparql(`SELECT ?item ?sl WHERE { ?item wdt:P1435 wd:Q9259; wdt:P17 wd:${cq}; wikibase:sitelinks ?sl; wdt:P625 ?coord . }`).catch(() => [])
        for (const r of part) rows.push({ ...r, cc: { value: cc } })
        await sleep(250)
      }
    }
    let n = 0
    for (const r of rows) {
      const cc = r.cc.value.toLowerCase()
      const id = qid(r.item.value)
      if (!withGuide.has(cc) || picked.has(id)) continue
      picked.set(id, { cc, type: 'heritage', sl: Number(r.sl.value) })
      n++
    }
    console.log(`[atlas] UNESCO          ${rows.length} sitios → ${n} nuevos`)
    await saveDetails([...picked.entries()].filter(([, p]) => p.type === 'heritage').map(([id]) => id))
  }

  const ids = [...picked.keys()]

  // 2b) métricas: superficie, caudal, cuenca, prominencia, profundidad, visitantes, países
  await fetchMetrics(db, ids)

  // 3) resumen de Wikipedia (español, o inglés si no hay), de 20 en 20
  const needs = db.prepare('SELECT qid, es_title, en_title FROM atlas WHERE extract IS NULL AND (es_title IS NOT NULL OR en_title IS NOT NULL)').all()
  const setExtract = db.prepare('UPDATE atlas SET extract = ?, extract_lang = ? WHERE qid = ?')
  let got = 0
  for (const lang of ['es', 'en']) {
    const list = needs.filter((r) => (lang === 'es' ? r.es_title : !r.es_title && r.en_title))
    for (let i = 0; i < list.length; i += 20) {
      const chunk = list.slice(i, i + 20)
      const byTitle = new Map(chunk.map((r) => [lang === 'es' ? r.es_title : r.en_title, r.qid]))
      let data = null
      for (let attempt = 0; attempt < 3 && !data; attempt++) {
        const res = await fetch(
          `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
            action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', exlimit: '20', redirects: '1',
            titles: [...byTitle.keys()].join('|'), format: 'json', formatversion: '2',
          })}`,
          { headers: { 'user-agent': UA } },
        ).catch(() => null)
        if (res?.status === 429) await sleep(15000)
        else if (res?.ok) data = await res.json()
        else await sleep(3000)
      }
      const redirects = new Map((data?.query?.redirects ?? []).map((r) => [r.to, r.from]))
      const normalized = new Map((data?.query?.normalized ?? []).map((r) => [r.to, r.from]))
      tx(db, () => {
        for (const pg of data?.query?.pages ?? []) {
          if (!pg.extract) continue
          const t = redirects.get(pg.title) ?? pg.title
          const id = byTitle.get(normalized.get(t) ?? t) ?? byTitle.get(t)
          if (!id) continue
          setExtract.run(pg.extract.slice(0, 900), lang, id)
          got++
        }
      })
      await sleep(300)
    }
  }
  const total = db.prepare('SELECT COUNT(*) n, SUM(image IS NOT NULL) img, SUM(extract IS NOT NULL) ext FROM atlas').get()
  console.log(`[atlas] ✓ ${total.n} lugares · ${total.img} con foto · ${total.ext} con resumen (${got} nuevos)`)
}
