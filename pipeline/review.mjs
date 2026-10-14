// Revisión de calidad con DeepSeek: para cada pista canónica (y las pistas sin
// país) el modelo confirma o corrige la categoría, añade la región mencionada,
// el país si falta, marca basura o datos globales y puntúa su utilidad.
//
// El resultado vive en hint_review, separado de la extracción: re-extraer una
// fuente no lo borra, y lo que dice la revisión prevalece sobre las reglas.
// Las pistas ya revisadas con la misma versión de instrucciones no se reenvían.

import { tx, now } from './lib/db.mjs'
import { createLlm } from './lib/llm.mjs'
import { CATEGORIES } from './lib/taxonomy.mjs'
import { createResolver } from './lib/countries.mjs'
import { dedup } from './dedup.mjs'

export const PROMPT_VERSION = 3
const BATCH = 25
const MAX_CHARS = 600

// Secciones de GeoTips que solo repiten la base global de países.
const GLOBAL_LABELS = /^(country flag|capital city|domain|internet domain)$/i

const SIGN_SUBS = [
  'stop', 'yield', 'chevrons', 'speed', 'pedestrian', 'railway', 'animal_warning', 'bus_stop',
  'tram', 'back_of_signs', 'city_signs', 'directions', 'sign_posts', 'warning', 'other',
]

const CATEGORY_HELP = {
  general: 'overview of how to recognise the country as a whole',
  regions: 'how to tell regions/states/provinces apart inside the country',
  google_car: 'the Street View car, its colour, rack, antenna, snorkel, follow cars, trekker',
  camera: 'camera generation, image quality, blur, rifts',
  coverage: 'where coverage exists, its age, unofficial coverage',
  road_lines: 'road markings and line colours',
  bollards: 'roadside bollards / delineator posts',
  guardrails: 'crash barriers and guardrails',
  signs: 'traffic and road signs (use subcategory)',
  road_numbering: 'road numbers and highway designations',
  milestones: 'kilometre markers and milestones',
  road_surface: 'pavement, dirt roads, shoulders',
  driving_side: 'which side traffic drives on',
  plates: 'licence plates',
  vehicles: 'local vehicles, buses, taxis, trucks',
  poles: 'utility / electricity / telephone poles, insulators, transformers',
  street_furniture: 'lamps, post boxes, traffic lights, hydrants, kerbs, fences, house numbers',
  language: 'language, alphabet, letters, script',
  naming: 'street names, place-name patterns, suffixes',
  domain: 'internet domain',
  phone: 'phone numbers and area codes',
  flag: 'flags',
  currency: 'currency',
  architecture: 'houses, buildings, roofs, religious buildings',
  landscape: 'vegetation, terrain, soil, climate, crops, scenery',
  sun: 'sun position, latitude, hemisphere',
  culture: 'shops, brands, gas stations, customs, symbols',
  landmarks: 'specific recognisable places, cities, monuments, pinpointable spots',
  other: 'nothing above fits',
}

const SYSTEM = `You clean a database of GeoGuessr tips (hints that help a player recognise where a Street View image was taken).
For each tip return:
- "cat": the single best category id from the list.
- "sub": for "signs" only, one of: ${SIGN_SUBS.join(', ')}; otherwise null.
- "region": the part of the country the tip is specifically about: a state, province, island, city or national park (e.g. "Hokkaido", "Bahia", "Kruger National Park"). Never a country name. Null if the tip applies to the whole country.
- "country": ISO 3166-1 alpha-2 code ONLY if the tip has no country and the text or label names one (a text that is just "Serbia" means country "rs"); otherwise null.
- "q": "ok" for a real tip, including general advice about playing; "junk" if it has no usable information for locating an image (empty, credits, website or competition news, map-making instructions, "see image" with no content); "global" ONLY if it just states the country's capital, internet domain, flag, currency or international phone code.
- "u": usefulness for locating the image: 3 = decisive on its own for this country/region; 2 = useful, narrows it down or works combined with other clues; 1 = minor detail or background.
Categories:
${CATEGORIES.map(([id]) => `${id}: ${CATEGORY_HELP[id] ?? ''}`).join('\n')}
Notes:
- A card about one province/state/county (its capital, population, area, island group) is "regions", with that unit as "region".
- Roof tiles, roofs and building materials are "architecture"; road pavement and dirt roads are "road_surface".
- Crops, trees and terrain are "landscape" even when the tip says where in the country they grow.
Answer only with JSON: {"items": [{"id": ..., "cat": ..., "sub": ..., "region": ..., "country": ..., "q": ..., "u": ...}]}`

export async function review(db, { model = 'deepseek-flash', limit = Infinity } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS hint_review (
    hint_id        INTEGER PRIMARY KEY,
    category       TEXT,
    subcategory    TEXT,
    country_code   TEXT,
    region         TEXT,
    quality        TEXT NOT NULL,      -- ok | junk | global
    usefulness     INTEGER,            -- 1 detalle · 2 útil · 3 determinante
    method         TEXT NOT NULL,      -- llm | rule
    model          TEXT,
    prompt_version INTEGER NOT NULL,
    reviewed_at    TEXT NOT NULL
  )`)

  const validCats = new Set(CATEGORIES.map(([id]) => id))
  const validCountries = new Set(db.prepare('SELECT code FROM countries').all().map((r) => r.code))
  const countryName = new Map(db.prepare('SELECT code, name FROM countries').all().map((r) => [r.code, r.name]))

  const save = db.prepare(`INSERT INTO hint_review
      (hint_id, category, subcategory, country_code, region, quality, usefulness, method, model, prompt_version, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(hint_id) DO UPDATE SET category=excluded.category, subcategory=excluded.subcategory,
      country_code=excluded.country_code, region=excluded.region, quality=excluded.quality,
      usefulness=excluded.usefulness, method=excluded.method, model=excluded.model,
      prompt_version=excluded.prompt_version, reviewed_at=excluded.reviewed_at`)

  // candidatas: canónica de cada grupo + pistas sin país, con texto, aún sin revisar
  const pending = db
    .prepare(
      `SELECT h.id, h.source_id, h.source_label, h.country_code, h.category, h.text
       FROM hints h
       WHERE length(h.text) > 0
         AND (h.id IN (SELECT canonical_id FROM clusters) OR h.country_code IS NULL)
         AND h.id NOT IN (SELECT hint_id FROM hint_review WHERE prompt_version = ?)
       ORDER BY h.country_code, h.id`,
    )
    .all(PROMPT_VERSION)

  // ── reglas gratuitas ──
  const ts = now()
  const toModel = []
  let byRule = 0
  tx(db, () => {
    for (const h of pending) {
      const trimmed = h.text.replace(/[\s\-–—•.]+/g, '')
      if (h.source_id === 'geotips' && GLOBAL_LABELS.test((h.source_label ?? '').trim())) {
        save.run(h.id, null, null, null, null, 'global', 1, 'rule', null, PROMPT_VERSION, ts)
        byRule++
      } else if (h.source_id === 'geohints' && /^companies\//.test(h.source_label ?? '')) {
        // marca con nombre (cerveza, gasolinera, correos): pista válida, la categoría ya viene fijada
        save.run(h.id, null, null, null, null, 'ok', 2, 'rule', null, PROMPT_VERSION, ts)
        byRule++
      } else if (trimmed.length < 3) {
        save.run(h.id, null, null, null, null, 'junk', 1, 'rule', null, PROMPT_VERSION, ts)
        byRule++
      } else toModel.push(h)
    }
  })

  // con --limit (prueba) se toma una muestra aleatoria para que sea representativa
  if (Number.isFinite(limit)) toModel.sort(() => Math.random() - 0.5)
  const items = toModel.slice(0, limit)
  const resolver = createResolver(db)
  const batches = []
  for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH))
  console.log(`[review] ${byRule} resueltas por regla · ${items.length} al modelo en ${batches.length} lotes (${model})`)

  const llm = createLlm({ model, concurrency: 10 })
  const stats = { saved: 0, changedCat: 0, invalid: 0, missing: 0 }
  let done = 0

  await Promise.all(
    batches.map(async (batch) => {
      const payload = batch.map((h) => ({
        id: h.id,
        country: h.country_code ? countryName.get(h.country_code) ?? h.country_code : null,
        label: h.source_label ?? null,
        text: h.text.replace(/\s+/g, ' ').slice(0, MAX_CHARS),
      }))
      const answer = await llm.json(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: JSON.stringify({ items: payload }) },
        ],
        { maxTokens: 4000 },
      )
      const byId = new Map((answer?.items ?? []).map((it) => [Number(it.id), it]))
      const rows = []
      for (const h of batch) {
        const r = byId.get(h.id)
        if (!r) {
          stats.missing++
          continue
        }
        let cat = typeof r.cat === 'string' ? r.cat.trim() : null
        if (cat && !validCats.has(cat)) {
          stats.invalid++
          cat = null
        }
        const sub = cat === 'signs' && SIGN_SUBS.includes(r.sub) ? r.sub : null
        const cc = typeof r.country === 'string' ? r.country.trim().toLowerCase() : null
        let country = !h.country_code && cc && validCountries.has(cc) ? cc : null
        const quality = ['ok', 'junk', 'global'].includes(r.q) ? r.q : 'ok'
        const usefulness = [1, 2, 3].includes(Number(r.u)) ? Number(r.u) : null
        let region = typeof r.region === 'string' && r.region.trim() ? r.region.trim().slice(0, 80) : null
        // una "región" que es en realidad un país pasa al campo país (o se descarta)
        const asCountry = region ? resolver.lookup(region).code : null
        if (asCountry && !resolver.lookup(region).region) {
          if (!h.country_code && !country) country = asCountry
          region = null
        }
        if (cat && cat !== h.category) stats.changedCat++
        rows.push([h.id, cat, sub, country, region, quality, usefulness])
      }
      tx(db, () => {
        for (const row of rows) save.run(...row, 'llm', model, PROMPT_VERSION, now())
      })
      stats.saved += rows.length
      done++
      if (done % 50 === 0) console.log(`[review] ${done}/${batches.length} lotes · ${llm.cost().toFixed(3)} USD`)
    }),
  )

  const u = llm.usage
  console.log(
    `[review] ✓ ${stats.saved} revisadas por el modelo · categoría corregida en ${stats.changedCat} · ` +
      `${stats.missing} sin respuesta · ${stats.invalid} categorías inválidas descartadas · ` +
      `${u.calls} llamadas, ${u.cached} desde caché, ${u.failed} fallidas · ` +
      `tokens ${u.promptMiss + u.promptHit} entrada / ${u.completion} salida · coste ≈ ${llm.cost().toFixed(3)} USD`,
  )
  dedup(db)
}
