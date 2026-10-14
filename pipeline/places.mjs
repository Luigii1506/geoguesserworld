// Lugares mencionados en las pistas ("Cuernavaca", "Tocantins", "Isla Sur"),
// con coordenadas, para poder verlos en un mapa.
//
//   npm run pipeline -- places     DeepSeek extrae los lugares de cada pista (de pago, con caché)
//   npm run pipeline -- geocode    coordenadas: centroides de Natural Earth para estados y
//                                  provincias; el resto, OpenStreetMap Nominatim (1 consulta/s)
//
// DeepSeek nunca da coordenadas (podría inventarlas): solo el nombre, una
// consulta para el geocodificador, el tipo y el país.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { tx, now } from './lib/db.mjs'
import { createLlm } from './lib/llm.mjs'
import { DATA_DIR, RAW_DIR } from './lib/paths.mjs'

export const PLACES_VERSION = 1
const BATCH = 30
// solo ASCII: Wikimedia limita (429) a los clientes con una identificación que no reconoce
const UA = 'GeoMastery/0.1 (personal GeoGuessr study app; https://github.com/Luigii1506/geoguesserworld)'

const SYSTEM = `You extract real geographic places mentioned in GeoGuessr tips, so a learner can see them on a map.
Include: cities, towns, villages, neighbourhoods, states/provinces/regions, islands, peninsulas, rivers, lakes, mountains/ranges, deserts, national parks, named roads or highways.
Exclude: country names, continents, generic directions ("the north", "the coast"), languages, brands, people, and anything that is not a place.
For each place give:
- "name": exactly as written in the tip,
- "query": the best search string for a geocoder, specific and unambiguous (e.g. "Cuernavaca, Morelos, Mexico", "Tocantins, Brazil", "South Island, New Zealand"),
- "kind": one of city | town | region | island | natural | road | area,
- "cc": ISO 3166-1 alpha-2 code (lowercase) of the country where the place is.
Answer only JSON: {"items": [{"id": <tip id>, "places": [{"name": "...", "query": "...", "kind": "...", "cc": ".."}]}]}. Tips with no places get "places": [].`

export function ensurePlaceTables(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS hint_places (
    hint_id   INTEGER NOT NULL,
    name      TEXT NOT NULL,
    query     TEXT NOT NULL,
    kind      TEXT,
    cc        TEXT,
    version   INTEGER NOT NULL,
    PRIMARY KEY (hint_id, name)
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS hint_places_done (hint_id INTEGER PRIMARY KEY, version INTEGER NOT NULL)`)
  db.exec(`CREATE TABLE IF NOT EXISTS places (
    key         TEXT PRIMARY KEY,      -- cc|consulta en minúsculas
    cc          TEXT,
    query       TEXT NOT NULL,
    lat         REAL,
    lng         REAL,
    display     TEXT,
    source      TEXT,                  -- admin1 | nominatim
    status      TEXT NOT NULL,         -- ok | none
    fetched_at  TEXT NOT NULL
  )`)
}
export const placeKey = (cc, query) => `${cc ?? ''}|${query.trim().toLowerCase()}`

// pistas que probablemente nombran un lugar: alguna palabra con mayúscula que no es inicio de frase
const STOP = new Set('gen google street view the this these most some in on if note also both many there they it a an unlike while when road roads signs sign bollards bollard plates plate poles pole trekker camera coverage highway north south east west eastern western northern southern central car cars line lines you however other all only each every one two three such see near around for from with are is of and or to be can will may often usually sometimes more less very just even same new old image images example like common rare unique'.split(' '))
function mayHavePlace(text, countryNames) {
  for (const m of text.matchAll(/(?<![.!?]\s|^)\b([A-Z][a-zà-ÿ]{2,}(?:\s[A-Z][a-zà-ÿ]{2,})*)/g)) {
    const t = m[1].toLowerCase()
    if (!STOP.has(t.split(' ')[0]) && !countryNames.has(t)) return true
  }
  return false
}

export async function places(db, { model = 'deepseek-flash', limit = Infinity } = {}) {
  ensurePlaceTables(db)
  const countryNames = new Set(db.prepare('SELECT name FROM countries').all().map((r) => r.name.toLowerCase()))
  const rows = db
    .prepare(
      `SELECT h.id, c.country_code cc,
          COALESCE((SELECT text FROM hint_translations t WHERE t.hint_id = h.id AND t.lang = 'en'), h.text) en
       FROM clusters c JOIN hints h ON h.id = c.canonical_id
       WHERE COALESCE(c.quality, 'ok') = 'ok' AND c.country_code IS NOT NULL AND length(h.text) > 0
         AND h.id NOT IN (SELECT hint_id FROM hint_places_done WHERE version = ?)`,
    )
    .all(PLACES_VERSION)
  const done = db.prepare('INSERT OR REPLACE INTO hint_places_done (hint_id, version) VALUES (?, ?)')
  const skipped = rows.filter((r) => !mayHavePlace(r.en, countryNames))
  tx(db, () => skipped.forEach((r) => done.run(r.id, PLACES_VERSION)))
  const todo = rows.filter((r) => mayHavePlace(r.en, countryNames)).slice(0, limit)
  console.log(`[places] ${todo.length} pistas por leer (${skipped.length} sin nombres propios) · ${model}`)

  const llm = createLlm({ model, concurrency: 8 })
  const save = db.prepare('INSERT OR REPLACE INTO hint_places (hint_id, name, query, kind, cc, version) VALUES (?, ?, ?, ?, ?, ?)')
  const batches = []
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH))
  let n = 0
  let found = 0
  await Promise.all(
    batches.map(async (batch) => {
      const answer = await llm.json(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: JSON.stringify({ items: batch.map((r) => ({ id: r.id, country: r.cc, tip: r.en.slice(0, 700) })) }) },
        ],
        { maxTokens: 4000 },
      )
      if (!answer?.items) return
      const ids = new Set(batch.map((r) => r.id))
      tx(db, () => {
        for (const it of answer.items) {
          if (!ids.has(it.id)) continue
          for (const p of it.places ?? []) {
            if (!p?.name || !p?.query) continue
            // a veces se cuela un país ("Turkey"): no es un lugar que haya que localizar
            if (countryNames.has(String(p.name).trim().toLowerCase())) continue
            save.run(it.id, String(p.name).slice(0, 120), String(p.query).slice(0, 200), p.kind ?? null, (p.cc ?? '').toLowerCase().slice(0, 2) || null, PLACES_VERSION)
            found++
          }
          done.run(it.id, PLACES_VERSION)
        }
      })
      if (++n % 40 === 0) console.log(`[places] ${n}/${batches.length} lotes · ${found} lugares · ${llm.cost().toFixed(3)} USD`)
    }),
  )
  console.log(`[places] ✓ ${found} lugares en ${todo.length} pistas · coste ≈ ${llm.cost().toFixed(3)} USD`)
}

/** Centroides de las divisiones de Natural Earth: { "cc|nombre": [lat, lng] }. */
function admin1Points() {
  const cache = path.join(DATA_DIR, 'admin1-points.json')
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'))
  const src = path.join(RAW_DIR, 'naturalearth', 'admin1.geojson')
  if (!existsSync(src)) return {}
  const out = {}
  for (const f of JSON.parse(readFileSync(src, 'utf8')).features) {
    const p = f.properties
    const cc = (p.iso_a2 ?? '').toLowerCase()
    const lat = p.latitude
    const lng = p.longitude
    if (!/^[a-z]{2}$/.test(cc) || lat == null || lng == null) continue
    for (const n of [p.name, p.name_en, p.name_es, ...(p.name_alt ?? '').split('|')]) if (n && n.trim()) out[`${cc}|${n.trim().toLowerCase()}`] = [lat, lng]
  }
  writeFileSync(cache, JSON.stringify(out))
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function geocode(db, { limit = Infinity } = {}) {
  ensurePlaceTables(db)
  const pts = admin1Points()
  const pending = db
    .prepare(
      `SELECT DISTINCT p.cc, p.query, p.name, p.kind FROM hint_places p
       WHERE NOT EXISTS (SELECT 1 FROM places x WHERE x.key = lower(COALESCE(p.cc, '')) || '|' || lower(trim(p.query)))`,
    )
    .all()
  const seen = new Set()
  const todo = pending.filter((p) => {
    const k = placeKey(p.cc, p.query)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const save = db.prepare(`INSERT OR REPLACE INTO places (key, cc, query, lat, lng, display, source, status, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)

  // 1) estados y provincias: centroide de Natural Earth, sin consulta externa
  let admin = 0
  const remote = []
  tx(db, () => {
    for (const p of todo) {
      const hit = pts[`${p.cc}|${p.name.trim().toLowerCase()}`] ?? pts[`${p.cc}|${p.query.split(',')[0].trim().toLowerCase()}`]
      if (hit && (p.kind === 'region' || !p.kind)) {
        save.run(placeKey(p.cc, p.query), p.cc, p.query, hit[0], hit[1], p.name, 'admin1', 'ok', now())
        admin++
      } else remote.push(p)
    }
  })
  const list = remote.slice(0, limit)
  console.log(`[geocode] ${admin} por Natural Earth · ${list.length} a OpenStreetMap (~${Math.ceil(list.length / 60)} min)`)

  // 2) el resto: Nominatim, una consulta por segundo, limitado al país
  let ok = 0
  let none = 0
  for (const [i, p] of list.entries()) {
    const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
      q: p.query, format: 'jsonv2', limit: '1', 'accept-language': 'en', ...(p.cc ? { countrycodes: p.cc } : {}),
    })}`
    let row = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20_000) })
        if (res.status === 429 || res.status >= 500) {
          await sleep(5000 * (attempt + 1))
          continue
        }
        row = (await res.json())?.[0] ?? null
        break
      } catch {
        await sleep(3000)
      }
    }
    if (row) {
      save.run(placeKey(p.cc, p.query), p.cc, p.query, Number(row.lat), Number(row.lon), row.display_name?.slice(0, 200) ?? null, 'nominatim', 'ok', now())
      ok++
    } else {
      save.run(placeKey(p.cc, p.query), p.cc, p.query, null, null, null, 'nominatim', 'none', now())
      none++
    }
    if ((i + 1) % 200 === 0) console.log(`[geocode] ${i + 1}/${list.length} · ${ok} encontrados · ${none} sin resultado`)
    await sleep(1100)
  }
  console.log(`[geocode] ✓ ${admin + ok} con coordenadas · ${none} sin resultado`)
}

const ES_SYSTEM = `Give the Spanish name of each place, as a Spanish text would write it (exonym if one is commonly used, e.g. Hamburg → Hamburgo, Frankfurt → Fráncfort, Cologne → Colonia, Munich → Múnich, London → Londres, South Island → Isla Sur; otherwise the same name, e.g. Bielefeld → Bielefeld, Speicherstadt → Speicherstadt).
Answer only JSON: {"items": [{"i": <index>, "es": "..."}]}`

/** Nombre en español de cada lugar (para reconocerlo en el texto traducido). */
export async function placesEs(db, { model = 'deepseek-flash' } = {}) {
  ensurePlaceTables(db)
  const cols = db.prepare('PRAGMA table_info(hint_places)').all().map((c) => c.name)
  if (!cols.includes('name_es')) db.exec('ALTER TABLE hint_places ADD COLUMN name_es TEXT')
  const rows = db.prepare('SELECT DISTINCT name, cc FROM hint_places WHERE name_es IS NULL').all()
  console.log(`[places-es] ${rows.length} nombres por traducir`)
  const llm = createLlm({ model, concurrency: 8 })
  const set = db.prepare('UPDATE hint_places SET name_es = ? WHERE name = ? AND COALESCE(cc, \'\') = COALESCE(?, \'\')')
  const batches = []
  for (let i = 0; i < rows.length; i += 150) batches.push(rows.slice(i, i + 150))
  let n = 0
  await Promise.all(
    batches.map(async (batch) => {
      const answer = await llm.json(
        [
          { role: 'system', content: ES_SYSTEM },
          { role: 'user', content: JSON.stringify({ items: batch.map((r, i) => ({ i, name: r.name, country: r.cc })) }) },
        ],
        { maxTokens: 6000 },
      )
      tx(db, () => {
        for (const it of answer?.items ?? []) {
          const r = batch[it.i]
          if (!r || typeof it.es !== 'string' || !it.es.trim()) continue
          set.run(it.es.trim().slice(0, 120), r.name, r.cc)
          n++
        }
      })
    }),
  )
  console.log(`[places-es] ✓ ${n} nombres · coste ≈ ${llm.cost().toFixed(3)} USD`)
}

// ── ficha de cada lugar desde Wikipedia (descripción, resumen, foto, coordenadas) ──
const WIKI_UA = { 'user-agent': UA, 'api-user-agent': UA }
const fold = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const GENERIC = /\b(national park|park|volcano|mount|mountains?|river|lake|island|state|province|region|town|city|village|parque nacional|volcan|rio|lago|isla|estado|provincia|ciudad|pueblo|de|del|la|el|the|of)\b/g
const coreWords = (s) => fold(s).replace(GENERIC, ' ').split(' ').filter((w) => w.length > 2)

function distanceKm(a, b) {
  const r = Math.PI / 180
  const d = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(d))
}

// Wikipedia pide tráfico moderado: como mucho ~4 peticiones por segundo en total
let wikiNext = 0
async function wikiSlot() {
  const t = Date.now()
  const wait = Math.max(0, wikiNext - t)
  wikiNext = Math.max(t, wikiNext) + 260
  if (wait) await sleep(wait)
}
async function wikiJson(url) {
  for (let i = 0; i < 4; i++) {
    await wikiSlot()
    try {
      const res = await fetch(url, { headers: WIKI_UA, signal: AbortSignal.timeout(20_000) })
      if (res.status === 429) {
        wikiNext = Date.now() + 15000 * (i + 1) // todos esperan
        continue
      }
      if (!res.ok) return null
      return await res.json()
    } catch {
      await sleep(1000)
    }
  }
  return null
}

/** Candidatos de Wikipedia para un lugar, con resumen, foto, descripción y coordenadas (una petición por idioma). */
async function wikiCandidates(place) {
  const out = []
  const context = place.query.split(',').slice(1, 2).join(' ').trim()
  for (const lang of ['es', 'en']) {
    const name = lang === 'es' ? place.name_es ?? place.name : place.name
    const d = await wikiJson(
      `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
        action: 'query', generator: 'search', gsrsearch: `${name} ${context}`.trim(), gsrlimit: '5',
        prop: 'description|coordinates|extracts|pageimages|info', exintro: '1', explaintext: '1', exlimit: '5',
        piprop: 'thumbnail|original', pithumbsize: '640', inprop: 'url', format: 'json', formatversion: '2', redirects: '1',
      })}`,
    )
    for (const pg of (d?.query?.pages ?? []).sort((x, y) => x.index - y.index)) {
      if (!pg.extract) continue
      out.push({
        lang, title: pg.title, desc: pg.description ?? '', extract: pg.extract.slice(0, 900),
        ll: pg.coordinates?.[0] ? [pg.coordinates[0].lat, pg.coordinates[0].lon] : null,
        image: pg.original?.source ?? null, thumb: pg.thumbnail?.source ?? null, url: pg.fullurl ?? null,
      })
    }
    if (out.length) break // con artículo en español basta
  }
  return out
}

export const PLACE_TYPES = ['city', 'town', 'village', 'neighbourhood', 'region', 'island', 'peninsula', 'coast', 'beach', 'volcano', 'mountain', 'range', 'river', 'lake', 'waterfall', 'desert', 'forest', 'national_park', 'monument', 'temple', 'church', 'mosque', 'castle', 'palace', 'bridge', 'road', 'archaeological', 'landmark', 'other']

const PICK_SYSTEM = `For each place mentioned in a GeoGuessr tip, choose the Wikipedia article that is exactly that place (the city, town, volcano, river, state…), not a sports club, event, border, historical state, person or other thing named after it. Prefer the Spanish (es) article when both exist.
Also give "t", the type of the place, one of: ${PLACE_TYPES.join(', ')}.
Answer only JSON: {"items": [{"i": <place index>, "c": <candidate index or -1 if none is that place>, "t": "<type>"}]}`

async function fetchSummary(lang, title) {
  const d = await wikiJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
  if (!d || d.type === 'disambiguation' || !d.extract) return null
  return {
    title: d.title, description: d.description ?? null, extract: d.extract.slice(0, 900), lang,
    image: d.originalimage?.source ?? null, thumb: d.thumbnail?.source ?? null,
    url: d.content_urls?.desktop?.page ?? null,
    lat: d.coordinates?.lat ?? null, lng: d.coordinates?.lon ?? null,
  }
}

export async function placeInfo(db, { limit = Infinity, concurrency = 6 } = {}) {
  ensurePlaceTables(db)
  db.exec(`CREATE TABLE IF NOT EXISTS place_info (
    key TEXT PRIMARY KEY, title TEXT, description TEXT, extract TEXT, image TEXT, thumb TEXT, url TEXT, lang TEXT,
    lat REAL, lng REAL, status TEXT NOT NULL, fetched_at TEXT NOT NULL
  )`)
  const hasEs = db.prepare('PRAGMA table_info(hint_places)').all().some((c) => c.name === 'name_es')
  const all = db
    .prepare(
      `SELECT hp.cc, hp.query, MIN(hp.name) name, MIN(${hasEs ? 'hp.name_es' : 'NULL'}) name_es, MIN(hp.kind) kind, p.lat, p.lng
       FROM hint_places hp LEFT JOIN places p ON p.key = lower(COALESCE(hp.cc, '')) || '|' || lower(trim(hp.query))
       GROUP BY lower(COALESCE(hp.cc, '')), lower(trim(hp.query))`,
    )
    .all()
  const done = new Set(db.prepare('SELECT key FROM place_info').all().map((r) => r.key))
  const todo = all.filter((p) => !done.has(placeKey(p.cc, p.query))).slice(0, limit)
  console.log(`[place-info] ${todo.length} lugares por buscar en Wikipedia`)
  if (!db.prepare('PRAGMA table_info(place_info)').all().some((c) => c.name === 'type')) db.exec('ALTER TABLE place_info ADD COLUMN type TEXT')
  const saveInfo = db.prepare(`INSERT OR REPLACE INTO place_info (key, title, description, extract, image, thumb, url, lang, lat, lng, status, fetched_at, type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const savePlace = db.prepare(`INSERT OR IGNORE INTO places (key, cc, query, lat, lng, display, source, status, fetched_at) VALUES (?, ?, ?, ?, ?, ?, 'wikipedia', 'ok', ?)`)
  const countryNames = new Set(db.prepare('SELECT lower(name) n FROM countries').all().map((r) => r.n))
  const llm = createLlm({ model: 'deepseek-flash', concurrency: 6 })
  let ok = 0
  let located = 0
  let n = 0
  const BATCH_P = 20
  for (let start = 0; start < todo.length; start += BATCH_P * 6) {
    // 6 lotes en paralelo: candidatos de Wikipedia → DeepSeek elige → resumen
    const chunk = todo.slice(start, start + BATCH_P * 6)
    const batches = []
    for (let k = 0; k < chunk.length; k += BATCH_P) batches.push(chunk.slice(k, k + BATCH_P))
    await Promise.all(
      batches.map(async (batch) => {
        const cands = []
        for (const p of batch) cands.push(countryNames.has(fold(p.name)) ? [] : await wikiCandidates(p))
        const items = batch.map((p, i) => ({
          i, place: p.name_es ?? p.name, kind: p.kind, where: p.query,
          candidates: cands[i].map((c, j) => ({ j, lang: c.lang, title: c.title, desc: c.desc })),
        }))
        const ask = items.filter((x) => x.candidates.length)
        const answer = ask.length
          ? await llm.json([{ role: 'system', content: PICK_SYSTEM }, { role: 'user', content: JSON.stringify({ items: ask }) }], { maxTokens: 1500 })
          : { items: [] }
        const pick = new Map((answer?.items ?? []).map((x) => [x.i, { c: x.c, t: PLACE_TYPES.includes(x.t) ? x.t : null }]))
        for (const [i, p] of batch.entries()) {
          const key = placeKey(p.cc, p.query)
          const known = p.lat != null ? [p.lat, p.lng] : null
          const c = cands[i][pick.get(i)?.c ?? -1]
          let w = c ? { title: c.title, description: c.desc || null, extract: c.extract, lang: c.lang, image: c.image, thumb: c.thumb, url: c.url, lat: c.ll?.[0] ?? null, lng: c.ll?.[1] ?? null } : null
          if (w && w.lat != null && known && distanceKm([w.lat, w.lng], known) > (p.kind === 'region' ? 900 : 300)) w = null
          if (w) {
            saveInfo.run(key, w.title, w.description, w.extract, w.image, w.thumb, w.url, w.lang, w.lat, w.lng, 'ok', now(), pick.get(i)?.t ?? null)
            ok++
            if (!known && w.lat != null) {
              savePlace.run(key, p.cc, p.query, w.lat, w.lng, w.title, now())
              located++
            }
          } else saveInfo.run(key, null, null, null, null, null, null, null, null, null, 'none', now(), pick.get(i)?.t ?? null)
        }
      }),
    )
    n += chunk.length
    console.log(`[place-info] ${n}/${todo.length} · ${ok} con ficha · ${located} localizados · ${llm.cost().toFixed(3)} USD`)
  }
  console.log(`[place-info] ✓ ${ok} con ficha · ${located} localizados por Wikipedia · ${todo.length - ok} sin artículo · ${llm.cost().toFixed(3)} USD`)
}

// ── popularidad de los lugares de las pistas: en cuántas Wikipedias está su artículo ──
export async function placeFame(db) {
  const cols = new Set(db.prepare('PRAGMA table_info(place_info)').all().map((c) => c.name))
  if (!cols.has('qid')) db.exec('ALTER TABLE place_info ADD COLUMN qid TEXT')
  if (!cols.has('sitelinks')) db.exec('ALTER TABLE place_info ADD COLUMN sitelinks INTEGER')
  const rows = db.prepare("SELECT key, title, lang FROM place_info WHERE status = 'ok' AND title IS NOT NULL AND sitelinks IS NULL").all()
  console.log(`[place-fame] ${rows.length} lugares`)
  const setQ = db.prepare('UPDATE place_info SET qid = ? WHERE key = ?')
  const setS = db.prepare('UPDATE place_info SET sitelinks = ? WHERE qid = ?')
  // 1) título de Wikipedia → elemento de Wikidata (de 50 en 50)
  for (const lang of ['es', 'en']) {
    const list = rows.filter((r) => r.lang === lang)
    for (let i = 0; i < list.length; i += 50) {
      const chunk = list.slice(i, i + 50)
      const d = await wikiJson(
        `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'pageprops', ppprop: 'wikibase_item', redirects: '1', titles: chunk.map((r) => r.title).join('|'), format: 'json', formatversion: '2' })}`,
      )
      const norm = new Map([...(d?.query?.normalized ?? []), ...(d?.query?.redirects ?? [])].map((x) => [x.to, x.from]))
      tx(db, () => {
        for (const pg of d?.query?.pages ?? []) {
          const q = pg.pageprops?.wikibase_item
          if (!q) continue
          let t = pg.title
          while (norm.has(t) && !chunk.some((r) => r.title === t)) t = norm.get(t)
          for (const r of chunk.filter((r) => r.title === t || r.title === pg.title)) setQ.run(q, r.key)
        }
      })
    }
  }
  // 2) elemento → número de Wikipedias (de 50 en 50)
  const qids = db.prepare('SELECT DISTINCT qid FROM place_info WHERE qid IS NOT NULL AND sitelinks IS NULL').all().map((r) => r.qid)
  for (let i = 0; i < qids.length; i += 50) {
    const chunk = qids.slice(i, i + 50)
    const d = await wikiJson(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', ids: chunk.join('|'), props: 'sitelinks', format: 'json' })}`)
    tx(db, () => {
      for (const [q, e] of Object.entries(d?.entities ?? {})) {
        const n = Object.keys(e.sitelinks ?? {}).filter((k) => k.endsWith('wiki') && k !== 'commonswiki').length
        setS.run(n, q)
      }
    })
    if ((i / 50) % 20 === 0) console.log(`[place-fame] ${Math.min(i + 50, qids.length)}/${qids.length}`)
  }
  const done = db.prepare('SELECT COUNT(*) n FROM place_info WHERE sitelinks IS NOT NULL').get().n
  console.log(`[place-fame] ✓ ${done} lugares con popularidad`)
}
