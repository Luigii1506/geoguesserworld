// Volcanes del Programa Global de Vulcanismo (Smithsonian, "Volcanoes of the
// World"): la referencia mundial. Holoceno (actividad en los últimos ~12.000 años)
// y Pleistoceno (más antiguos). De cada volcán: tipo, última erupción, entorno
// tectónico, roca, altura y resumen geológico.
//
//   npm run pipeline -- volcanes      (gratis; luego `export`)
//
// Se emparejan con el atlas por número GVP (Wikidata P1886) o, si no, por
// cercanía (< 8 km) y nombre parecido; los activos o muy altos que no estén
// en el atlas se añaden.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { tx, now } from './lib/db.mjs'
import { RAW_DIR } from './lib/paths.mjs'

const UA = 'GeoMastery/0.1 (personal GeoGuessr study app; https://github.com/Luigii1506/geoguesserworld)'
async function sparql(query) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query })}`, {
      headers: { accept: 'application/sparql-results+json', 'user-agent': UA }, signal: AbortSignal.timeout(65_000),
    }).catch(() => null)
    if (res?.ok) {
      try {
        return JSON.parse(await res.text()).results.bindings
      } catch {
        /* respuesta cortada */
      }
    }
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error('Wikidata no respondió')
}

const WFS = 'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application/json&typeName=GVP-VOTW:'
const LAYERS = { holocene: 'Smithsonian_VOTW_Holocene_Volcanoes', pleistocene: 'Smithsonian_VOTW_Pleistocene_Volcanoes' }

const fold = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const GENERIC = /\b(volcan|volcano|nevado|nevados|cerro|monte|mount|mt|pico|mont|vulkan|gunung|the|de|del|la|el)\b/g
const core = (s) => fold(s).replace(GENERIC, ' ').split(' ').filter((w) => w.length > 2)
function km(a, b) {
  const r = Math.PI / 180
  const d = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(d))
}

async function download(layer) {
  const dir = path.join(RAW_DIR, 'gvp')
  const file = path.join(dir, `${layer}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const res = await fetch(WFS + LAYERS[layer], { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`GVP ${layer}: HTTP ${res.status}`)
  const text = await res.text()
  mkdirSync(dir, { recursive: true })
  writeFileSync(file, text)
  return JSON.parse(text)
}

export function ensureGvpTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS gvp (
    number INTEGER PRIMARY KEY, name TEXT, country TEXT, lat REAL, lng REAL, elevation INTEGER,
    type TEXT, landform TEXT, epoch TEXT, last_eruption INTEGER, evidence TEXT, tectonic TEXT, rock TEXT,
    summary TEXT, qid TEXT, updated_at TEXT
  )`)
}

export async function volcanoes(db) {
  ensureGvpTable(db)
  const save = db.prepare(`INSERT OR REPLACE INTO gvp (number, name, country, lat, lng, elevation, type, landform, epoch, last_eruption, evidence, tectonic, rock, summary, qid, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT qid FROM gvp WHERE number = ?), ?)`)
  let n = 0
  for (const layer of Object.keys(LAYERS)) {
    const j = await download(layer)
    tx(db, () => {
      for (const f of j.features) {
        const p = f.properties
        save.run(
          p.Volcano_Number, p.Volcano_Name, p.Country, p.Latitude, p.Longitude, p.Elevation ?? null, p.Primary_Volcano_Type ?? null,
          p.Volcanic_Landform ?? null, p.Geologic_Epoch ?? layer, p.Last_Eruption_Year ?? null, p.Evidence_Category ?? null,
          p.Tectonic_Setting ?? null, p.Major_Rock_Type ?? null, p.Geological_Summary ?? null, p.Volcano_Number, now(),
        )
        n++
      }
    })
  }
  console.log(`[volcanes] ${n} volcanes del Smithsonian`)

  // emparejar con el atlas: 1) número GVP en Wikidata (P1886), todos de una vez
  const cols = new Set(db.prepare('PRAGMA table_info(atlas)').all().map((c) => c.name))
  if (!cols.has('gvp')) db.exec('ALTER TABLE atlas ADD COLUMN gvp INTEGER')
  const setQ = db.prepare('UPDATE gvp SET qid = ? WHERE number = ?')
  const setG = db.prepare('UPDATE atlas SET gvp = ?, volcanic = 1 WHERE qid = ?')
  const wd = await sparql(`SELECT ?item ?n WHERE { ?item wdt:P1886 ?n . }`)
  const qidOf = new Map()
  for (const r of wd) qidOf.set(Number(r.n.value), r.item.value.split('/').pop())
  const inAtlas = new Set(db.prepare('SELECT qid FROM atlas').all().map((r) => r.qid))
  tx(db, () => {
    for (const [num, q] of qidOf) {
      setQ.run(q, num)
      if (inAtlas.has(q)) setG.run(num, q)
    }
  })
  console.log(`[volcanes] ${qidOf.size} volcanes con número GVP en Wikidata`)
  const byNumber = db.prepare("SELECT qid, gvp FROM atlas WHERE gvp IS NOT NULL").all()
  const linked = new Set(byNumber.map((r) => r.gvp))
  // 2) por cercanía y nombre: montañas o volcanes del atlas a < 8 km con alguna palabra en común
  const vols = db.prepare('SELECT number, name, lat, lng FROM gvp').all()
  const cands = db.prepare("SELECT qid, name_es, name_en, lat, lng FROM atlas WHERE type IN ('mountain', 'volcano', 'range') AND gvp IS NULL").all()
  let near = 0
  tx(db, () => {
    for (const v of vols) {
      if (linked.has(v.number)) continue
      const w = core(v.name)
      let best = null
      for (const c of cands) {
        const d = km([v.lat, v.lng], [c.lat, c.lng])
        if (d > 8) continue
        const cw = core(`${c.name_es ?? ''} ${c.name_en ?? ''}`)
        if (!w.some((x) => cw.includes(x))) continue
        if (!best || d < best.d) best = { c, d }
      }
      if (best) {
        setG.run(v.number, best.c.qid)
        setQ.run(best.c.qid, v.number)
        linked.add(v.number)
        near++
      }
    }
    for (const r of byNumber) setQ.run(r.qid, r.gvp)
  })
  console.log(`[volcanes] ${byNumber.length} enlazados por número GVP · ${near} por cercanía y nombre`)

  // 3) volcanes que faltan en el atlas: activos (erupción desde 1900) o muy altos (> 4.500 m)
  const missing = db
    .prepare(`SELECT number, name, lat, lng, elevation, qid FROM gvp
      WHERE qid IS NOT NULL AND qid NOT IN (SELECT qid FROM atlas) AND (last_eruption >= 1900 OR elevation >= 4500)`)
    .all()
  const add = db.prepare(`INSERT OR IGNORE INTO atlas (qid, cc, type, sitelinks, name_es, name_en, description, lat, lng, image, elevation, es_title, en_title, gvp, volcanic, updated_at)
    VALUES (?, ?, 'volcano', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
  let added = 0
  for (let i = 0; i < missing.length; i += 120) {
    const chunk = missing.slice(i, i + 120)
    const rows = await sparql(`SELECT ?item (SAMPLE(?es) AS ?les) (SAMPLE(?en) AS ?len) (SAMPLE(?d) AS ?desc) (SAMPLE(?img) AS ?image)
        (SAMPLE(?iso) AS ?cc) (MAX(?sl) AS ?s) (SAMPLE(?esT) AS ?esTitle) (SAMPLE(?enT) AS ?enTitle) WHERE {
      VALUES ?item { ${chunk.map((m) => `wd:${m.qid}`).join(' ')} }
      ?item wikibase:sitelinks ?sl .
      OPTIONAL { ?item rdfs:label ?es FILTER(lang(?es) = "es") }
      OPTIONAL { ?item rdfs:label ?en FILTER(lang(?en) = "en") }
      OPTIONAL { ?item schema:description ?d FILTER(lang(?d) = "es") }
      OPTIONAL { ?item wdt:P18 ?img }
      OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P297 ?iso }
      OPTIONAL { ?esA schema:about ?item; schema:isPartOf <https://es.wikipedia.org/>; schema:name ?esT }
      OPTIONAL { ?enA schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?enT }
    } GROUP BY ?item`).catch(() => [])
    const byQ = new Map(chunk.map((m) => [m.qid, m]))
    tx(db, () => {
      for (const r of rows) {
        const q = r.item.value.split('/').pop()
        const m = byQ.get(q)
        if (!m || !r.cc?.value) continue
        const img = r.image?.value ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(r.image.value.split('/').pop()))}` : null
        add.run(q, r.cc.value.toLowerCase(), Number(r.s.value), r.les?.value ?? null, r.len?.value ?? m.name, r.desc?.value ?? null, m.lat, m.lng, img,
          m.elevation, r.esTitle?.value ?? null, r.enTitle?.value ?? null, m.number, now())
        added++
      }
    })
  }
  console.log(`[volcanes] ✓ ${added} volcanes nuevos en el atlas (activos o de más de 4.500 m)`)
}
