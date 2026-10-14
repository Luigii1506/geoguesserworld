// Exporta desde la base SQLite lo que consume la app web:
//   public/community/visual-index.json  → comparador visual (todas las fuentes)
//   public/community/countries.json     → base global de países
//   public/community/country/<cc>.json  → todas las pistas y atributos de un país
// Todo bajo public/community/ (fuera de git, uso personal).

import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { ROOT } from './lib/paths.mjs'
import { ensureImageTable, imagePath } from './images.mjs'
import { buildMaps } from './maps.mjs'
import { exportDuels } from './duels.mjs'
import { admin1Names } from './lib/gazetteer.mjs'
import { ensurePlaceTables } from './places.mjs'

const OUT = path.join(ROOT, 'public', 'community')
const SOURCE_LETTER = { plonkit: 'p', geometas: 'g', geohints: 'h', geotips: 't', learnablemeta: 'l', openguessr: 'o' }

// Imágenes: si hay copia propia (etapa images) se usa su ruta /images/img/ab/<sha1>.webp,
// que la app resuelve a disco local o al Worker de R2. Si no, la URL original
// (plonkit.net bloquea sin su Referer: esas van por el proxy /pi-img).
let ownImages = new Map()
function servable(url) {
  if (!url) return url
  const hash = ownImages.get(url)
  if (hash) return `/images/${imagePath(hash)}`
  return url.startsWith('https://www.plonkit.net/') ? url.replace('https://www.plonkit.net', '/pi-img') : url
}

/**
 * Muchas pistas regionales llegan sin región ("este bolardo es exclusivo de Utah
 * e Idaho"): si el texto nombra una región ya conocida del país, se le asigna
 * (la primera que aparece en las primeras palabras) y se marca como inferida. Así no cuentan como pistas
 * de todo el país ni salen en "Reconócelo". No se usan nombres que también son
 * países (Georgia) ni nombres muy cortos.
 */
function inferRegions(clusters, byId, countryNames, extra = []) {
  // nombres conocidos: las regiones que ya usan sus pistas, las divisiones de Natural
  // Earth (Wales, Texas, Bahia…) y los territorios dependientes (Isla de Man, Guam…)
  const taken = new Set(countryNames.map((n) => n.toLowerCase()))
  const deps = new Set(extra.dependents ?? [])
  const names = [...new Set([...clusters.map((c) => c.region).filter(Boolean), ...(extra.admin1 ?? []), ...deps])]
    .filter((n) => n.length >= 4 && (deps.has(n) || !taken.has(n.toLowerCase())))
    .sort((a, b) => b.length - a.length)
  if (!names.length) return
  const esc = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?<![\\p{L}])(${names.map(esc).join('|')})(?![\\p{L}])`, 'u')
  for (const c of clusters) {
    if (c.region) continue
    const h = byId.get(c.canonical_id)
    // solo al principio: una pista nacional puede nombrar una región como ejemplo más adelante
    const m = (h?.text_en ?? h?.text ?? '').slice(0, 140).match(re)
    if (m) {
      c.region = m[1]
      c.region_inferred = true
    }
  }
}

// parejas que las fuentes "relacionan" por un nombre ambiguo (el estado de Georgia en EE. UU.)
const NOT_TWINS = new Set(['us|ge'])

const placeId = (key) => createHash('sha1').update(key).digest('hex').slice(0, 10)
// consultas unidas a un mismo lugar (las pistas apuntan al id del lugar unido)
let placeAlias = new Map()

/**
 * Lugares con ficha de Wikipedia o coordenadas: places-index.json (para la galería:
 * nombre, tipo, país, coordenadas, miniatura y en cuántas pistas sale) y
 * places/<cc>.json (resumen, foto grande y enlace, para la ficha).
 */
function exportPlaces(db, OUT) {
  const hasInfo = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'place_info'").get().n > 0
  const hasEs = db.prepare('PRAGMA table_info(hint_places)').all().some((c) => c.name === 'name_es')
  if (!hasInfo) return 0
  const hasType = db.prepare('PRAGMA table_info(place_info)').all().some((c) => c.name === 'type')
  const rows = db
    .prepare(
      `SELECT k.key, k.cc, MIN(hp.name) name, MIN(${hasEs ? 'hp.name_es' : 'NULL'}) name_es, MIN(hp.kind) kind, COUNT(DISTINCT hp.hint_id) hints,
          i.title, i.description, i.extract, i.image, i.thumb, i.url, i.lang, ${hasType ? 'i.type' : 'NULL'} AS type,
          ${db.prepare('PRAGMA table_info(place_info)').all().some((c) => c.name === 'sitelinks') ? 'i.sitelinks' : 'NULL'} AS sitelinks,
          COALESCE(p.lat, i.lat) lat, COALESCE(p.lng, i.lng) lng
       FROM (SELECT DISTINCT lower(COALESCE(cc, '')) || '|' || lower(trim(query)) key, cc FROM hint_places) k
       JOIN hint_places hp ON lower(COALESCE(hp.cc, '')) || '|' || lower(trim(hp.query)) = k.key
       LEFT JOIN place_info i ON i.key = k.key AND i.status = 'ok'
       LEFT JOIN places p ON p.key = k.key AND p.status = 'ok'
       GROUP BY k.key`,
    )
    .all()
    .filter((r) => r.lat != null && r.cc)
  // el mismo lugar extraído con consultas distintas ("Valdés Peninsula, Chubut" / "Península Valdés"):
  // se une por artículo de Wikipedia o, sin artículo, por nombre dentro del país
  const merged = new Map()
  const fold = (t) => (t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  for (const r of rows) {
    const k = r.title ? `${r.cc}|w|${r.lang}|${r.title}` : `${r.cc}|n|${fold(r.name_es ?? r.name)}`
    const prev = merged.get(k)
    if (!prev) merged.set(k, { ...r, keys: [r.key] })
    else {
      prev.hints += r.hints
      prev.keys.push(r.key)
    }
  }
  // un lugar sin artículo que se llama igual que otro del país con artículo es el mismo
  // (el del mismo tipo si lo hay): se une a ese
  const titled = new Map()
  for (const [k, r] of merged) if (r.title) {
    const nk = `${r.cc}|${fold(r.name_es ?? r.name)}`
    if (!titled.has(nk)) titled.set(nk, [])
    titled.get(nk).push(r)
  }
  for (const [k, r] of [...merged]) {
    if (r.title) continue
    const cands = titled.get(`${r.cc}|${fold(r.name_es ?? r.name)}`)
    if (!cands?.length) continue
    const target = cands.find((x) => (x.type ?? x.kind) === (r.type ?? r.kind)) ?? cands[0]
    target.hints += r.hints
    target.keys.push(...r.keys)
    merged.delete(k)
  }
  // mismo nombre y mismo tipo en el país (ciudad y cantón de Guayaquil): uno solo, el de más pistas
  const byNameType = new Map()
  for (const [k, r] of [...merged]) {
    const nk = `${r.cc}|${fold(r.name_es ?? r.name)}|${r.type ?? r.kind}`
    const prev = byNameType.get(nk)
    if (!prev) byNameType.set(nk, [k, r])
    else {
      const [keep, drop, dropKey] = prev[1].hints >= r.hints ? [prev[1], r, k] : [r, prev[1], prev[0]]
      keep.hints += drop.hints
      keep.keys.push(...drop.keys)
      merged.delete(dropKey)
      byNameType.set(nk, [keep === r ? k : prev[0], keep])
    }
  }
  // atlas (Wikidata): los lugares más importantes de cada país. Si un lugar de las pistas
  // es el mismo artículo de Wikipedia, se funden (conserva sus pistas y gana los datos)
  const hasAtlas = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'atlas'").get().n > 0
  if (hasAtlas) {
    const byTitle = new Map()
    for (const r of merged.values()) if (r.title) byTitle.set(`${r.cc}|${r.lang}|${r.title}`, r)
    const wikiUrl = (lang, t) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`
    for (const a of db.prepare('SELECT * FROM atlas').all()) {
      // lugares que ya no existen (Tenochtitlan…) fuera; montañas que son volcanes, como volcán
      if (a.dissolved) continue
      if (a.volcanic && a.type === 'mountain') a.type = 'volcano'
      const facts = {
        ele: a.elevation ?? undefined, pop: a.population ?? undefined, len: a.length_km ?? undefined, unesco: a.unesco ? 1 : undefined,
        area: a.area_km2 ?? undefined, q: a.discharge ?? undefined, basin: a.basin_km2 ?? undefined, prom: a.prominence ?? undefined,
        depth: a.depth ?? undefined, vis: a.visitors ?? undefined, nc: a.countries && a.countries > 1 ? a.countries : undefined,
      }
      const lang = a.extract_lang ?? (a.es_title ? 'es' : 'en')
      const title = lang === 'es' ? a.es_title : a.en_title
      const hit = (a.es_title && byTitle.get(`${a.cc}|es|${a.es_title}`)) || (a.en_title && byTitle.get(`${a.cc}|en|${a.en_title}`))
      if (hit) {
        if (a.ccs) hit.ccs = [...new Set([hit.cc, ...a.ccs.split(',')])]
        Object.assign(hit, {
          type: a.type === 'heritage' ? hit.type ?? 'landmark' : a.type, facts, sitelinks: a.sitelinks, qid: a.qid,
          image: hit.image ?? a.image, thumb: hit.thumb ?? (a.image ? `${a.image}?width=480` : null),
          description: hit.description ?? a.description, name_es: a.name_es ?? hit.name_es,
        })
        continue
      }
      merged.set(`atlas|${a.qid}`, {
        key: `atlas|${a.qid}`, keys: [`atlas|${a.qid}`], cc: a.cc, name: a.name_en ?? a.name_es, name_es: a.name_es ?? a.name_en,
        type: a.type === 'heritage' ? 'landmark' : a.type, hints: 0, lat: a.lat, lng: a.lng, description: a.description,
        title: title ?? null, extract: a.extract, image: a.image, thumb: a.image ? `${a.image}?width=480` : null,
        url: title ? wikiUrl(lang, title) : null, lang, facts, sitelinks: a.sitelinks, qid: a.qid,
        ccs: a.ccs ? [...new Set([a.cc, ...a.ccs.split(',')])] : undefined,
      })
    }
  }

  // un mismo lugar en varios países (lago de Constanza, Danubio…): una sola ficha con todos sus países
  const global = new Map()
  for (const [k, r] of [...merged]) {
    if (!r.title) continue
    const gk = `${r.lang}|${r.title}`
    const prev = global.get(gk)
    if (!prev) {
      global.set(gk, r)
      r.ccs ??= [r.cc]
      continue
    }
    if (!prev.ccs.includes(r.cc)) prev.ccs.push(r.cc)
    prev.hints += r.hints
    prev.keys.push(...r.keys)
    prev.sitelinks = Math.max(prev.sitelinks ?? 0, r.sitelinks ?? 0) || prev.sitelinks
    prev.facts ??= r.facts
    merged.delete(k)
  }

  const index = []
  const byCc = new Map()
  const aliasOf = new Map() // id de cada consulta → id del lugar unido
  for (const r of merged.values()) {
    if (!(r.name_es ?? r.name)) continue
    const id = placeId(r.keys.sort()[0])
    for (const k of r.keys) aliasOf.set(placeId(k), id)
    const f = r.facts && Object.values(r.facts).some((v) => v !== undefined) ? r.facts : undefined
    index.push({
      id, n: r.name_es ?? r.name, en: r.name, t: r.type ?? r.kind ?? 'other', cc: r.cc,
      lat: Math.round(r.lat * 1e4) / 1e4, lng: Math.round(r.lng * 1e4) / 1e4,
      th: r.thumb ?? undefined, d: r.description ?? undefined, h: r.hints, s: r.sitelinks ?? undefined, f,
      cs: r.ccs && r.ccs.length > 1 ? r.ccs : undefined,
    })
    if (r.title || r.extract) {
      // la ficha se guarda en el archivo de cada uno de sus países
      for (const cc of r.ccs ?? [r.cc]) {
        if (!byCc.has(cc)) byCc.set(cc, {})
        byCc.get(cc)[id] = { title: r.title, x: r.extract, img: r.image, url: r.url, lang: r.lang }
      }
    }
  }
  mkdirSync(path.join(OUT, 'places'), { recursive: true })
  for (const [cc, m] of byCc) writeFileSync(path.join(OUT, 'places', `${cc}.json`), JSON.stringify(m))
  writeFileSync(path.join(OUT, 'places-index.json'), JSON.stringify(index))
  placeAlias = aliasOf
  console.log(`[export] ${index.length} lugares (${index.filter((x) => x.th).length} con foto)`)
  return index.length
}

const clamp = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s ?? '')

const IMAGE_SOURCE_RANK = { plonkit: 0, geotips: 1, geometas: 2, geohints: 3, openguessr: 4, learnablemeta: 5 }

/**
 * Imágenes de un grupo sin copias. Learnable Meta vuelve a subir las fotos de
 * Plonk It (con otra URL) una vez por cada mapa donde aparece la meta, así que
 * comparar URLs no basta:
 *   · si el grupo tiene la pista de Plonk It, se descartan las imágenes de
 *     Learnable Meta que declaran venir de plonkit.net;
 *   · de las copias de una misma meta de Learnable Meta se toma solo una (la
 *     que más imágenes tiene).
 */
function clusterImages(members) {
  const hasPlonkit = members.some((h) => h.source_id === 'plonkit' && h.images.length)
  const ordered = [...members].sort((a, b) => (IMAGE_SOURCE_RANK[a.source_id] ?? 9) - (IMAGE_SOURCE_RANK[b.source_id] ?? 9))
  const lm = members
    .filter((h) => h.source_id === 'learnablemeta' && !(hasPlonkit && /plonkit\.net/.test(h.upstream ?? '')))
    .sort((a, b) => b.images.length - a.images.length)[0]
  const seen = new Set()
  const out = []
  for (const h of ordered) {
    if (h.source_id === 'learnablemeta' && h !== lm) continue
    for (const u of h.images) {
      if (seen.has(u)) continue
      seen.add(u)
      out.push(u)
    }
  }
  return out
}

// Nombres en español que los datasets no traen y delatarían el país en una pregunta.
const ALT_MASK = {
  gb: ['Gran Bretaña', 'Inglaterra', 'Escocia', 'Gales', 'Irlanda del Norte', 'England', 'Scotland', 'Wales', 'escocés', 'escocesa', 'galés', 'galesa'],
  us: ['EE. UU.', 'EEUU', 'EE.UU.'],
  nl: ['Holanda'],
  cz: ['República Checa', 'Czech Republic', 'checo', 'checa'],
  kr: ['Corea', 'Korea'],
}

export function exportAll(db) {
  mkdirSync(path.join(OUT, 'country'), { recursive: true })
  ensureImageTable(db)
  ownImages = new Map(db.prepare(`SELECT url, hash FROM image_files WHERE status = 'ok'`).all().map((r) => [r.url, r.hash]))

  // ── países ──
  const countries = db.prepare('SELECT * FROM countries ORDER BY name').all().map((c) => ({
    ...c,
    languages: JSON.parse(c.languages ?? '[]'),
    currencies: JSON.parse(c.currencies ?? '[]'),
    calling_codes: JSON.parse(c.calling_codes ?? '[]'),
    tlds: JSON.parse(c.tlds ?? '[]'),
    borders: JSON.parse(c.borders ?? '[]'),
    alt_names: undefined,
  }))
  const hintCounts = new Map(
    db.prepare('SELECT country_code, COUNT(*) n FROM hints WHERE country_code IS NOT NULL GROUP BY country_code').all()
      .map((r) => [r.country_code, r.n]),
  )
  writeFileSync(
    path.join(OUT, 'countries.json'),
    JSON.stringify(countries.map((c) => ({ ...c, hints: hintCounts.get(c.code) ?? 0 }))),
  )

  // ── índice visual: una entrada por imagen ──
  const rows = db.prepare(`
    SELECT h.id, h.source_id, h.country_code, h.country_raw, h.category, h.subcategory,
           h.text, h.location_url, h.url, i.url AS image
    FROM hints h JOIN hint_images i ON i.hint_id = h.id
    ORDER BY h.country_code, h.category, h.source_id, h.id, i.ord`).all()
  const items = rows.map((r) => ({
    c: r.country_code,
    n: r.country_code ? undefined : r.country_raw ?? undefined,
    s: SOURCE_LETTER[r.source_id] ?? r.source_id,
    k: r.category,
    sk: r.subcategory ?? undefined,
    t: clamp(r.text, 280),
    i: servable(r.image),
    l: r.location_url ?? r.url,
  }))
  const counts = {}
  for (const it of items) counts[it.k] = (counts[it.k] ?? 0) + 1
  const categories = db.prepare('SELECT id, name, grp FROM categories ORDER BY ord').all()
  writeFileSync(
    path.join(OUT, 'visual-index.json'),
    JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), counts, categories, items }),
  )

  // ── un archivo por país con todo lo que sabemos ──
  // incluye las pistas cuyo país asignó la revisión (no solo las que lo traían de origen)
  const hintStmt = db.prepare(`
    SELECT h.id, h.source_id, h.region, h.category, h.subcategory, h.source_label, h.title, h.text,
           h.location_url, h.lat, h.lng, h.url, json_extract(h.extra, '$.upstream') AS upstream,
           json_extract(h.extra, '$.links') AS links
    FROM hints h WHERE h.id IN (
      SELECT m.hint_id FROM cluster_members m JOIN clusters c ON c.id = m.cluster_id WHERE c.country_code = ?
    ) ORDER BY h.category, h.source_id, h.id`)
  const imgStmt = db.prepare('SELECT url FROM hint_images WHERE hint_id = ? ORDER BY ord')
  const attrStmt = db.prepare(
    'SELECT source_id, attribute, value, detail FROM attributes WHERE country_code = ? ORDER BY attribute, value',
  )
  const hasClusters = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'clusters'").get().n > 0
  const clusterStmt = hasClusters
    ? db.prepare(`SELECT c.id, c.region, c.category, c.subcategory, c.canonical_id, c.size, c.sources,
          c.source_count, c.level, c.maps, c.usefulness, c.reviewed, GROUP_CONCAT(m.hint_id) AS members
        FROM clusters c JOIN cluster_members m ON m.cluster_id = c.id
        WHERE c.country_code = ? AND COALESCE(c.quality, 'ok') = 'ok'
        GROUP BY c.id
        ORDER BY c.usefulness DESC, c.source_count DESC, c.level IS NULL, c.level, c.size DESC`)
    : null
  const hasTr = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'hint_translations'").get().n > 0
  const trStmt = hasTr ? db.prepare('SELECT lang, text FROM hint_translations WHERE hint_id = ?') : null
  const resStmt = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'resources'").get().n > 0
    ? db.prepare(`SELECT source_id, url, title, author, note, kind FROM resources WHERE country_code = ?
        ORDER BY CASE kind WHEN 'practice_map' THEN 0 WHEN 'community_doc' THEN 1 ELSE 2 END, title`)
    : null
  // infografía resumen de Plonk It: la primera imagen centrada de la guía del país
  // (bandera, dominio, generaciones de cámara, lado de circulación…)
  const summaryStmt = db.prepare(`SELECT i.url FROM hints h JOIN hint_images i ON i.hint_id = h.id
    WHERE h.source_id = 'plonkit' AND h.country_code = ? AND h.region IS NULL
      AND json_extract(h.extra, '$.kind') = 'centeredImage'
    ORDER BY json_extract(h.extra, '$.order'), i.ord LIMIT 1`)
  const summaryImage = (code) => {
    const r = summaryStmt.get(code)
    return r ? servable(r.url) : null
  }
  const withTranslations = (h) => {
    if (!trStmt) return h
    const tr = Object.fromEntries(trStmt.all(h.id).map((t) => [t.lang, t.text]))
    return { ...h, text_es: tr.es ?? null, text_en: tr.en ?? null }
  }

  // lugares mencionados en cada pista, con coordenadas (etapas places + geocode)
  ensurePlaceTables(db)
  const hasEs = db.prepare('PRAGMA table_info(hint_places)').all().some((c) => c.name === 'name_es')
  const placeStmt = db.prepare(`SELECT hp.name, ${hasEs ? 'hp.name_es' : 'NULL'} AS name_es, hp.kind, p.lat, p.lng, p.key FROM hint_places hp
    JOIN places p ON p.key = lower(COALESCE(hp.cc, '')) || '|' || lower(trim(hp.query))
    WHERE hp.hint_id = ? AND p.status = 'ok' ORDER BY hp.rowid`)
  // ── base de lugares (Geografía): índice ligero + detalle por país (antes de las fichas: fija los ids) ──
  exportPlaces(db, OUT)
  const admin1 = admin1Names()
  const countryNames = countries.flatMap((x) => [x.name, x.name_es].filter(Boolean))
  const dependents = countries.filter((x) => !x.independent).flatMap((x) => [x.name, x.name_es].filter(Boolean))
  let files = 0
  for (const c of countries) {
    const hints = hintStmt.all(c.code).map((h) => {
      const links = h.links ? JSON.parse(h.links) : []
      const places = placeStmt ? placeStmt.all(h.id).map((p) => ({ id: placeAlias.get(placeId(p.key)) ?? placeId(p.key), n: p.name, es: p.name_es && p.name_es !== p.name ? p.name_es : undefined, lat: p.lat, lng: p.lng, k: p.kind ?? undefined, cc: c.code })) : []
      return withTranslations({
        ...h,
        links: links.length ? links : undefined,
        images: imgStmt.all(h.id).map((i) => servable(i.url)),
        places: places.length ? places : undefined,
      })
    })
    const attributes = attrStmt.all(c.code).map((a) => ({ ...a, detail: a.detail ? JSON.parse(a.detail) : undefined }))
    if (!hints.length && !attributes.length) continue
    // grupos deduplicados: cada uno apunta a su pista canónica, a sus miembros
    // y a sus imágenes sin copias
    const byId = new Map(hints.map((h) => [h.id, h]))
    const clusters = clusterStmt
      ? clusterStmt.all(c.code).map((g) => {
          const members = g.members.split(',').map(Number)
          return {
            ...g,
            sources: JSON.parse(g.sources),
            members,
            images: clusterImages(members.map((id) => byId.get(id)).filter(Boolean)),
          }
        })
      : []
    inferRegions(clusters, byId, countryNames, { admin1: admin1[c.code] ?? [], dependents })
    for (const h of hints) delete h.upstream
    const resources = resStmt ? resStmt.all(c.code) : []
    writeFileSync(
      path.join(OUT, 'country', `${c.code}.json`),
      JSON.stringify({ country: c, summaryImage: summaryImage(c.code), clusters, hints, attributes, resources }),
    )
    files++
  }


  // ── objetos de meta con rasgos, relaciones y rasgos comunes/exclusivos ──
  let objectsOut = 0
  const hasObjects = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'object_matches'").get().n > 0
  if (hasObjects) {
    const rels = db.prepare('SELECT relation, other_country, note FROM object_relations WHERE object_id = ?')
    const matches = db.prepare('SELECT other_country, shared, total FROM object_matches WHERE object_id = ?')
    // foto de ejemplo del objeto: la primera imagen de sus pistas (para reconocerlo de un vistazo)
    const firstImg = db.prepare('SELECT url FROM hint_images WHERE hint_id = ? ORDER BY ord LIMIT 1')
    const objectImage = (ids) => {
      for (const id of ids) {
        const r = firstImg.get(id)
        if (r) return servable(r.url)
      }
      return null
    }
    const objects = db.prepare('SELECT * FROM meta_objects ORDER BY type, country_code, variant').all().map((o) => ({
      id: o.id,
      country: o.country_code,
      type: o.type,
      variant: o.variant,
      region: o.region,
      attrs: JSON.parse(o.attrs),
      features: JSON.parse(o.features),
      hints: JSON.parse(o.hint_ids),
      img: objectImage(JSON.parse(o.hint_ids)),
      alsoIn: rels.all(o.id).filter((r) => r.relation === 'also_in').map((r) => r.other_country),
      confusedWith: rels.all(o.id).filter((r) => r.relation === 'confused_with').map((r) => ({ country: r.other_country, difference: r.note })),
      sameDesign: matches.all(o.id).map((m) => ({ country: m.other_country, shared: m.shared, total: m.total })),
    }))
    const traits = db.prepare('SELECT type, key, value, n, countries FROM trait_stats ORDER BY type, key, n').all()
      .map((t) => ({ ...t, countries: JSON.parse(t.countries) }))
    writeFileSync(path.join(OUT, 'meta-objects.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), objects, traits }))
    objectsOut = objects.length
  }

  const quizOut = hasClusters ? exportAppData(db, countries, summaryImage) : 0

  console.log(
    `[export] ✓ ${countries.length} países · ${items.length} imágenes en el índice visual · ${files} fichas de país` +
      `${objectsOut ? ` · ${objectsOut} objetos de meta` : ''}${quizOut ? ` · ${quizOut} preguntas` : ''} → public/community/`,
  )
}

/**
 * Datos compactos para la app: meta.json (categorías, fuentes, totales),
 * resúmenes por país en countries.json (cuánto hay, con quién se confunde) y
 * quiz.json (pistas útiles y fotos, recortadas, para generar preguntas).
 */
function exportAppData(db, countries, summaryImage) {
  const has = (t) => db.prepare('SELECT COUNT(*) n FROM sqlite_master WHERE name = ?').get(t).n > 0
  const hasTr = has('hint_translations')
  const hasObjects = has('object_relations')

  // ── países confundibles: relaciones explícitas + diseños compartidos raros + subregión ──
  const score = new Map() // "a|b" → peso
  const bump = (a, b, w) => {
    if (!a || !b || a === b) return
    score.set(`${a}|${b}`, (score.get(`${a}|${b}`) ?? 0) + w)
  }
  if (hasObjects) {
    for (const r of db.prepare('SELECT country_code a, other_country b, relation FROM object_relations').all()) {
      bump(r.a, r.b, r.relation === 'confused_with' ? 5 : 3)
      bump(r.b, r.a, r.relation === 'confused_with' ? 5 : 3)
    }
    // diseños compartidos, pero solo en objetos poco comunes (los comunes no confunden)
    for (const r of db
      .prepare(`SELECT a.country_code a, m.other_country b FROM object_matches m
        JOIN meta_objects a ON a.id = m.object_id
        WHERE a.type NOT IN ('road_lines', 'licence_plate') AND a.variant = 'main'`)
      .all())
      bump(r.a, r.b, 1)
  }
  const bySub = new Map()
  for (const c of countries) {
    if (!c.subregion) continue
    if (!bySub.has(c.subregion)) bySub.set(c.subregion, [])
    bySub.get(c.subregion).push(c.code)
  }

  // Lo que dicen las fuentes: una pista de A que nombra a B ("a diferencia de
  // Canadá", "también en México") es la mejor señal de que se confunden.
  const nameToCode = new Map()
  for (const c of countries) for (const n of [c.name, c.name_es]) if (n && n.length >= 4) nameToCode.set(n.toLowerCase(), c.code)
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const nameRe = new RegExp(`(?<![\\p{L}])(${[...nameToCode.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![\\p{L}])`, 'giu')
  // regiones de cada país: "Georgia" o "New Jersey" en una pista de EE. UU. son estados, no países
  const regionsOf = new Map()
  for (const r of db.prepare('SELECT DISTINCT country_code cc, lower(region) region FROM clusters WHERE region IS NOT NULL').all()) {
    if (!regionsOf.has(r.cc)) regionsOf.set(r.cc, [])
    regionsOf.get(r.cc).push(r.region)
  }
  const mentions = new Map()
  for (const r of db
    .prepare(`SELECT c.country_code cc, h.text FROM clusters c JOIN hints h ON h.id = c.canonical_id
      WHERE c.country_code IS NOT NULL AND COALESCE(c.quality, 'ok') = 'ok' AND length(h.text) > 0`)
    .all()) {
    const seen = new Set()
    const lower = r.text.toLowerCase()
    for (const m of r.text.matchAll(nameRe)) {
      const name = m[1].toLowerCase()
      const other = nameToCode.get(name)
      if (!other || other === r.cc || seen.has(other)) continue
      // la mención es parte del nombre de una región del propio país ("New Mexico", "New Jersey")
      const inRegion = (regionsOf.get(r.cc) ?? []).some((reg) => {
        if (!reg.includes(name)) return false
        const at = lower.indexOf(reg, Math.max(0, m.index - reg.length))
        return at >= 0 && at <= m.index && at + reg.length >= m.index + name.length
      })
      if (inRegion) continue
      seen.add(other)
      const k = `${r.cc}|${other}`
      mentions.set(k, (mentions.get(k) ?? 0) + 1)
    }
  }
  for (const [k, n] of mentions) {
    const [a, b] = k.split('|')
    const w = Math.min(n, 8) * 2
    bump(a, b, w)
    bump(b, a, w)
  }
  // cercanía: misma subregión o mismo continente (los gemelos casi siempre son vecinos)
  const geo = new Map(countries.map((c) => [c.code, c]))
  for (const k of [...score.keys()]) {
    const [a, b] = k.split('|')
    const ca = geo.get(a)
    const cb = geo.get(b)
    if (!ca || !cb) continue
    if (ca.subregion && ca.subregion === cb.subregion) score.set(k, score.get(k) + 4)
    else if (ca.region && ca.region === cb.region) score.set(k, score.get(k) + 2)
  }

  const summary = db
    .prepare(`SELECT country_code cc, COUNT(*) groups, SUM(usefulness = 3) essential,
        SUM(region IS NOT NULL) regional, SUM(source_count > 1) confirmed
      FROM clusters WHERE COALESCE(quality, 'ok') = 'ok' GROUP BY country_code`)
    .all()
  const sumBy = new Map(summary.map((s) => [s.cc, s]))
  const objCount = hasObjects
    ? new Map(db.prepare('SELECT country_code cc, COUNT(*) n FROM meta_objects GROUP BY cc').all().map((r) => [r.cc, r.n]))
    : new Map()
  // gemelo = país con guía propia y suficiente contenido para compararlo
  const withData = new Set(summary.filter((s) => s.groups >= 30).map((s) => s.cc))

  const enriched = countries.map((c) => {
    const s = sumBy.get(c.code)
    const ranked = [...score.entries()]
      .filter(([k]) => k.startsWith(`${c.code}|`))
      .map(([k, w]) => [k.split('|')[1], w])
      .filter(([cc]) => withData.has(cc))
      // un país que se llama como una región propia (Georgia para EE. UU.) no es un gemelo
      .filter(([cc]) => !(regionsOf.get(c.code) ?? []).includes((geo.get(cc)?.name ?? '').toLowerCase()))
      .filter(([cc]) => !NOT_TWINS.has(`${c.code}|${cc}`) && !NOT_TWINS.has(`${cc}|${c.code}`))
      .sort((x, y) => y[1] - x[1])
      .map(([cc]) => cc)
    const neighbours = (bySub.get(c.subregion) ?? []).filter((cc) => cc !== c.code && withData.has(cc))
    // términos que delatan el país (nombre, nombre oficial, gentilicios en/es):
    // el entrenamiento los oculta en el texto de la pregunta
    const raw = db.prepare('SELECT official_name, demonyms_en, demonyms_es, alt_names, capital FROM countries WHERE code = ?').get(c.code) ?? {}
    const mask = [
      c.name, c.name_es, raw.official_name, raw.capital,
      ...JSON.parse(raw.demonyms_en ?? '[]'), ...JSON.parse(raw.demonyms_es ?? '[]'),
      // nombres alternativos ("Great Britain", "Holland"…), sin siglas como "UK"
      ...JSON.parse(raw.alt_names ?? '[]').filter((t) => t.length >= 4 && !/^[A-Z]{2,4}$/.test(t)),
      ...(ALT_MASK[c.code] ?? []),
    ].filter((t) => t && t.length >= 3)
    return {
      code: c.code, name: c.name, name_es: c.name_es, flag: c.flag, region: c.region, subregion: c.subregion,
      mask: [...new Set(mask)],
      summary_image: summaryImage(c.code),
      capital: c.capital, population: c.population, driving_side: c.driving_side, languages: c.languages,
      currencies: c.currencies, calling_codes: c.calling_codes, tlds: c.tlds, lat: c.lat, lng: c.lng, ccn3: c.ccn3, area: c.area_km2,
      groups: s?.groups ?? 0, essential: s?.essential ?? 0, regional: s?.regional ?? 0,
      confirmed: s?.confirmed ?? 0, objects: objCount.get(c.code) ?? 0,
      confusable: [...new Set([...ranked, ...neighbours])].slice(0, 8),
    }
  })
  writeFileSync(path.join(OUT, 'countries.json'), JSON.stringify(enriched))
  // mapas temáticos: un rasgo de la meta por capa
  writeFileSync(path.join(OUT, 'maps.json'), JSON.stringify({ generatedAt: new Date().toISOString(), layers: buildMaps(db, enriched) }))
  // duelos entre gemelos: fotos enfrentadas, diferencias y quiz
  const duelCount = exportDuels(db, enriched, servable, OUT)
  console.log(`[export] ${duelCount} duelos`)

  // ── meta.json ──
  const categories = db.prepare('SELECT id, name, grp FROM categories ORDER BY ord').all()
  const sources = db.prepare("SELECT id, name, homepage, license, method FROM sources WHERE id <> 'countries' ORDER BY id").all()
  const totals = db
    .prepare(`SELECT (SELECT COUNT(*) FROM hints) hints, (SELECT COUNT(*) FROM hint_images) images,
        (SELECT COUNT(*) FROM clusters WHERE COALESCE(quality,'ok')='ok') groups,
        (SELECT COUNT(*) FROM clusters WHERE usefulness = 3) essential,
        (SELECT COUNT(DISTINCT country_code) FROM clusters WHERE country_code IS NOT NULL) countries`)
    .get()
  writeFileSync(
    path.join(OUT, 'meta.json'),
    JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), categories, sources, totals }),
  )

  // ── quiz.json: pistas útiles con texto + fotos con país ──
  const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s ?? null)
  const textRows = db
    .prepare(`SELECT c.id, c.country_code cc, c.category cat, c.subcategory sub, c.region, c.usefulness u,
        c.source_count sc, h.text,
        ${hasTr ? "(SELECT text FROM hint_translations WHERE hint_id = h.id AND lang = 'es') es," : 'NULL es,'}
        ${hasTr ? "(SELECT text FROM hint_translations WHERE hint_id = h.id AND lang = 'en') en," : 'NULL en,'}
        (SELECT url FROM hint_images i WHERE i.hint_id = h.id ORDER BY ord LIMIT 1) img
      FROM clusters c JOIN hints h ON h.id = c.canonical_id
      WHERE COALESCE(c.quality, 'ok') = 'ok' AND c.usefulness >= 2 AND c.country_code IS NOT NULL
        AND length(h.text) > 30`)
    .all()
  const photoRows = db
    .prepare(`SELECT c.id, c.country_code cc, c.category cat, c.subcategory sub, i.url img
      FROM clusters c JOIN hints h ON h.id = c.canonical_id JOIN hint_images i ON i.hint_id = h.id
      WHERE h.source_id = 'geohints' AND c.country_code IS NOT NULL AND i.ord = 0`)
    .all()
  const quiz = {
    texts: textRows.map((r) => ({
      id: r.id, c: r.cc, k: r.cat, sk: r.sub ?? undefined, r: r.region ?? undefined, u: r.u, n: r.sc,
      es: clip(r.es ?? r.text, 260), en: clip(r.en ?? r.text, 260), i: r.img ? servable(r.img) : undefined,
    })),
    photos: photoRows.map((r) => ({ id: r.id, c: r.cc, k: r.cat, sk: r.sub ?? undefined, i: servable(r.img) })),
  }
  writeFileSync(path.join(OUT, 'quiz.json'), JSON.stringify(quiz))
  return quiz.texts.length + quiz.photos.length
}
