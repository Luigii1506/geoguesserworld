// Deduplicación local (opción A): agrupa pistas del mismo país que dicen lo
// mismo, sin modelo de lenguaje.
//
// Método:
//   1. Normaliza el texto (minúsculas, sin acentos ni coletillas de la fuente).
//   2. Lo convierte en "shingles": grupos de 3 palabras consecutivas.
//   3. Con un índice invertido por país encuentra pares que comparten
//      shingles, y mide su parecido:
//        jaccard     = comunes / unión          (textos casi iguales)
//        contención  = comunes / el más pequeño (uno copia al otro y añade algo)
//   4. Une los pares parecidos con union-find: cada componente es un grupo.
//   5. También une pistas que comparten exactamente la misma imagen.
//
// Resultado: tablas clusters + cluster_members, reconstruidas en cada ejecución.
// El id de un grupo es el menor id de pista que contiene, así que es estable
// mientras sus pistas no cambien.

import { tx } from './lib/db.mjs'

export const THRESHOLDS = {
  shingle: 3,
  jaccard: 0.6, // casi iguales (0.5 juntaba descripciones distintas con la misma estructura)
  containment: 0.8, // uno contiene al otro
  minShingles: 6, // por debajo, solo cuenta la igualdad exacta
  maxPosting: 300, // shingles más frecuentes que esto no generan candidatos
}

const BOILERPLATE = [
  /_?you can click on the image to enlarge it\.?_?/gi,
  /\bclick (on )?the image to (enlarge|see) it\b\.?/gi,
  /\bsee the image\b\.?/gi,
]

export function normalize(text) {
  let t = text ?? ''
  for (const re of BOILERPLATE) t = t.replace(re, ' ')
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const vocab = new Map()
const tokenId = (s) => {
  let id = vocab.get(s)
  if (id === undefined) vocab.set(s, (id = vocab.size))
  return id
}

/** Conjunto ordenado de ids de shingles (o de la frase entera si es corta). */
export function shingles(norm, size = THRESHOLDS.shingle) {
  const words = norm.split(' ').filter(Boolean)
  if (words.length === 0) return []
  const out = new Set()
  if (words.length < size) out.add(tokenId(words.join(' ')))
  for (let i = 0; i + size <= words.length; i++) out.add(tokenId(words.slice(i, i + size).join(' ')))
  return [...out].sort((a, b) => a - b)
}

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Datos distintivos de un texto: números, nombres propios a media frase,
 * términos entre comillas y sufijos tipo "-ac". Muchas metas son plantillas
 * ("Phone Code 12 can be found…" / "Phone Code 67 can be found…") que solo se
 * distinguen por estos datos: dos textos no son la misma pista si el más
 * corto tiene un dato que el otro no tiene.
 */
export function keyTokens(text) {
  const t = (text ?? '').replace(/_?you can click on the image to enlarge it\.?_?/gi, ' ')
  const keys = new Set()
  for (const m of t.matchAll(/\b\d+(?:[.,]\d+)?\b/g)) keys.add(m[0].replace(',', '.'))
  // códigos de carretera y similares: A380, N1, M4, E45, SH2, BR-101
  for (const m of t.matchAll(/\b[A-Z]{1,3}-?\d{1,4}[A-Z]?\b/g)) keys.add(m[0].toLowerCase().replace('-', ''))
  for (const m of t.matchAll(/["“«]([^"”»]{2,40})["”»]/g)) keys.add(fold(m[1]).trim())
  for (const m of t.matchAll(/(?:^|[\s(])-([a-zà-ÿ]{2,})\b/g)) keys.add('-' + fold(m[1]))
  // palabras con mayúscula, también a principio de frase: muchas metas
  // empiezan por el nombre que las distingue ("Llanos de Challe National Park…").
  // Las copias entre fuentes conservan las mismas palabras, así que no estorba.
  for (const m of t.matchAll(/\b([A-ZÀ-Ý][\p{Ll}]{2,}(?:[-\s][A-ZÀ-Ý][\p{Ll}]+)*)/gu)) keys.add(fold(m[1]))
  return keys
}

export function keysCovered(smallKeys, bigKeys) {
  for (const k of smallKeys) if (!bigKeys.has(k)) return false
  return true
}

export function similarity(a, b, shared) {
  const union = a.length + b.length - shared
  return { jaccard: union ? shared / union : 0, containment: shared / Math.min(a.length, b.length) }
}

/** a, b: { sh, norm, keys } */
export function isDuplicate(a, b, sim) {
  const [small, big] = a.sh.length <= b.sh.length ? [a, b] : [b, a]
  if (a.norm === b.norm) return keysCovered(small.keys, big.keys)
  if (Math.min(a.sh.length, b.sh.length) < THRESHOLDS.minShingles) return false
  if (sim.jaccard < THRESHOLDS.jaccard && sim.containment < THRESHOLDS.containment) return false
  return keysCovered(small.keys, big.keys)
}

/** Devuelve los pares candidatos de un país con su parecido. */
export function candidatePairs(items) {
  const posting = new Map()
  items.forEach((it, idx) => {
    for (const s of it.sh) {
      let list = posting.get(s)
      if (!list) posting.set(s, (list = []))
      list.push(idx)
    }
  })
  const counts = new Map()
  for (const list of posting.values()) {
    if (list.length < 2 || list.length > THRESHOLDS.maxPosting) continue
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const key = list[i] * 100000 + list[j]
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
  }
  const pairs = []
  for (const [key, shared] of counts) {
    const i = Math.floor(key / 100000)
    const j = key % 100000
    pairs.push({ i, j, shared, sim: similarity(items[i].sh, items[j].sh, shared) })
  }
  return pairs
}

const isSubset = (a, b) => {
  if (a.size > b.size) return false
  for (const k of a) if (!b.has(k)) return false
  return true
}

/**
 * Union-find que evita el efecto cadena: cada grupo guarda la unión de los
 * datos distintivos de sus pistas, y dos grupos solo se unen si la de uno
 * está contenida en la del otro. Así un tip genérico ("cada prefectura tiene
 * su pegatina") no arrastra a un mismo grupo 70 metas de prefecturas distintas.
 */
function unionFind(n, keysOf) {
  const parent = Array.from({ length: n }, (_, i) => i)
  // Array.from y no .map: keysOf es disperso (pistas sin texto) y map salta huecos
  const keys = Array.from(keysOf, (k) => k ?? new Set())
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  /** force: une aunque los datos distintivos no encajen (decisión del modelo) */
  function union(a, b, force = false) {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return true
    if (force) {
      for (const k of keys[ra]) keys[rb].add(k)
      parent[ra] = rb
    } else if (isSubset(keys[ra], keys[rb])) parent[ra] = rb
    else if (isSubset(keys[rb], keys[ra])) parent[rb] = ra
    else return false
    return true
  }
  return { find, union }
}

const SOURCE_RANK = { plonkit: 0, geotips: 1, learnablemeta: 2, geometas: 3, openguessr: 4, geohints: 5 }

export function dedup(db, { quiet = false } = {}) {
  // la tabla se reconstruye entera en cada ejecución: recrearla mantiene el
  // esquema al día cuando se añaden columnas
  db.exec(`
    DROP TABLE IF EXISTS clusters;
    CREATE TABLE clusters (
      id             INTEGER PRIMARY KEY,   -- menor id de pista del grupo
      country_code   TEXT,
      region         TEXT,                  -- región concreta (revisión)
      category       TEXT NOT NULL,
      subcategory    TEXT,
      canonical_id   INTEGER NOT NULL,      -- pista cuyo texto representa al grupo
      size           INTEGER NOT NULL,
      sources        TEXT NOT NULL,         -- JSON: fuentes distintas
      source_count   INTEGER NOT NULL,      -- cuántas fuentes lo confirman
      level          INTEGER,               -- 1 imprescindible … 4 experto (Learnable Meta)
      maps           INTEGER,               -- mapas de Learnable Meta donde aparece
      quality        TEXT,                  -- ok | junk | global (revisión); NULL sin revisar
      usefulness     INTEGER,               -- 1 detalle · 2 útil · 3 determinante (revisión)
      reviewed       INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS cluster_members (
      hint_id     INTEGER PRIMARY KEY,
      cluster_id  INTEGER NOT NULL,
      similarity  REAL                      -- parecido con la canónica (1 = la propia)
    );
    CREATE INDEX IF NOT EXISTS cluster_members_cluster ON cluster_members(cluster_id);
    CREATE INDEX IF NOT EXISTS clusters_country ON clusters(country_code, category);
  `)

  // la revisión (hint_review), si existe, prevalece sobre la clasificación por reglas
  const hasReview = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'hint_review'").get().n > 0
  const hints = db
    .prepare(
      hasReview
        ? `SELECT h.id, h.source_id, COALESCE(h.country_code, r.country_code) AS country_code,
              COALESCE(r.category, h.category) AS category,
              CASE WHEN r.category IS NOT NULL THEN r.subcategory ELSE h.subcategory END AS subcategory,
              h.text, h.source_label,
              r.hint_id IS NOT NULL AS reviewed, r.region AS r_region, r.quality AS r_quality,
              r.usefulness AS r_usefulness,
              json_extract(h.extra, '$.level') AS level,
              json_array_length(json_extract(h.extra, '$.maps')) AS maps
           FROM hints h LEFT JOIN hint_review r ON r.hint_id = h.id ORDER BY h.id`
        : `SELECT h.id, h.source_id, h.country_code, h.category, h.subcategory, h.text, h.source_label,
              0 AS reviewed, NULL AS r_region, NULL AS r_quality, NULL AS r_usefulness,
              json_extract(h.extra, '$.level') AS level,
              json_array_length(json_extract(h.extra, '$.maps')) AS maps
           FROM hints h ORDER BY h.id`,
    )
    .all()
  const images = db.prepare('SELECT hint_id, url FROM hint_images').all()
  const imagesByHint = new Map()
  for (const im of images) {
    if (!imagesByHint.has(im.hint_id)) imagesByHint.set(im.hint_id, [])
    imagesByHint.get(im.hint_id).push(im.url)
  }

  const idx = new Map(hints.map((h, i) => [h.id, i]))
  const sims = new Map() // "i-j" → parecido, para guardarlo luego
  const stats = { textPairs: 0, imagePairs: 0, compared: 0, blockedChains: 0 }

  // ── 1. texto, por país ──
  const keysOf = new Array(hints.length)
  const byCountry = new Map()
  for (const h of hints) {
    if (!h.country_code || !h.text) continue
    const norm = normalize(h.text)
    if (!norm) continue
    const keys = keyTokens(h.text)
    // En Learnable Meta muchas metas comparten texto y se distinguen solo por
    // el título ("Aomori Sticker" / "Nagano Sticker"): el título cuenta como dato.
    if (h.source_id === 'learnablemeta' && h.source_label) for (const k of keyTokens(h.source_label)) keys.add(k)
    const item = { h, norm, sh: shingles(norm), keys }
    keysOf[idx.get(h.id)] = item.keys
    if (!byCountry.has(h.country_code)) byCountry.set(h.country_code, [])
    byCountry.get(h.country_code).push(item)
  }
  const uf = unionFind(hints.length, keysOf)

  const matches = []
  for (const items of byCountry.values()) {
    for (const p of candidatePairs(items)) {
      stats.compared++
      const a = items[p.i]
      const b = items[p.j]
      if (isDuplicate(a, b, p.sim)) matches.push({ a: a.h.id, b: b.h.id, s: Math.max(p.sim.jaccard, p.sim.containment) })
    }
  }
  // los pares más parecidos primero: deciden la forma de cada grupo
  matches.sort((x, y) => y.s - x.s)
  for (const m of matches) {
    if (!uf.union(idx.get(m.a), idx.get(m.b))) {
      stats.blockedChains++
      continue
    }
    sims.set(m.a < m.b ? `${m.a}-${m.b}` : `${m.b}-${m.a}`, m.s)
    stats.textPairs++
  }

  // ── 2. misma imagen exacta ──
  const byImage = new Map()
  for (const [hintId, urls] of imagesByHint)
    for (const u of urls) {
      if (!byImage.has(u)) byImage.set(u, [])
      byImage.get(u).push(hintId)
    }
  for (const ids of byImage.values()) {
    if (ids.length < 2 || ids.length > 20) continue // imágenes genéricas reutilizadas
    for (let k = 1; k < ids.length; k++) {
      const a = hints[idx.get(ids[0])]
      const b = hints[idx.get(ids[k])]
      if (a.country_code !== b.country_code) continue
      // dentro de una misma fuente, una imagen repetida es la página reutilizando
      // una foto en secciones distintas; solo en Learnable Meta es la misma meta
      // copiada en otro mapa
      if (a.source_id === b.source_id && a.source_id !== 'learnablemeta') continue
      if (uf.union(idx.get(a.id), idx.get(b.id))) stats.imagePairs++
      else stats.blockedChains++
    }
  }

  // ── 3. vínculos semánticos (paráfrasis detectadas por el modelo) ──
  const hasLinks = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'semantic_links'").get().n > 0
  if (hasLinks) {
    for (const l of db.prepare('SELECT hint_a, hint_b FROM semantic_links').all()) {
      const a = idx.get(l.hint_a)
      const b = idx.get(l.hint_b)
      if (a === undefined || b === undefined) continue
      if (uf.find(a) !== uf.find(b)) stats.semanticLinks = (stats.semanticLinks ?? 0) + 1
      uf.union(a, b, true)
    }
  }

  // ── 4. construir grupos ──
  const groups = new Map()
  hints.forEach((h, i) => {
    const root = uf.find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(h)
  })

  const insCluster = db.prepare(`INSERT INTO clusters
    (id, country_code, region, category, subcategory, canonical_id, size, sources, source_count,
     level, maps, quality, usefulness, reviewed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const insMember = db.prepare('INSERT INTO cluster_members (hint_id, cluster_id, similarity) VALUES (?, ?, ?)')

  const result = { clusters: 0, multi: 0, multiSource: 0, merged: 0 }
  tx(db, () => {
    db.exec('DELETE FROM cluster_members; DELETE FROM clusters;')
    for (const members of groups.values()) {
      // canónica: el texto más completo; a igualdad, la fuente más detallada
      const canonical = [...members].sort(
        (a, b) =>
          (b.text?.length ?? 0) - (a.text?.length ?? 0) ||
          (SOURCE_RANK[a.source_id] ?? 9) - (SOURCE_RANK[b.source_id] ?? 9),
      )[0]
      const id = Math.min(...members.map((m) => m.id))
      const sources = [...new Set(members.map((m) => m.source_id))].sort()
      const levels = members.map((m) => m.level).filter((l) => l != null)
      const maps = members.reduce((s, m) => s + (m.maps ?? 0), 0)
      // la revisión de la canónica manda; si la canónica cambió tras una
      // fusión nueva, se usa la de cualquier miembro revisado
      const rev = canonical.reviewed ? canonical : members.find((m) => m.reviewed)
      const useful = members.map((m) => m.r_usefulness).filter((u) => u != null)
      insCluster.run(
        id, canonical.country_code ?? rev?.country_code ?? null, rev?.r_region ?? null,
        rev?.category ?? canonical.category, rev ? rev.subcategory : canonical.subcategory, canonical.id,
        members.length, JSON.stringify(sources), sources.length,
        levels.length ? Math.min(...levels) : null, maps || null,
        rev?.r_quality ?? null, useful.length ? Math.max(...useful) : null, rev ? 1 : 0,
      )
      for (const m of members) {
        const key = m.id < canonical.id ? `${m.id}-${canonical.id}` : `${canonical.id}-${m.id}`
        insMember.run(m.id, id, m.id === canonical.id ? 1 : sims.get(key) ?? null)
      }
      result.clusters++
      if (members.length > 1) {
        result.multi++
        result.merged += members.length - 1
      }
      if (sources.length > 1) result.multiSource++
    }
  })

  if (quiet) return result
  console.log(
    `[dedup] ✓ ${hints.length} pistas → ${result.clusters} grupos ` +
      `(${result.merged} fusionadas · ${result.multi} grupos con repetidas · ` +
      `${result.multiSource} confirmados por varias fuentes) · ` +
      `${stats.textPairs} uniones por texto, ${stats.imagePairs} por imagen, ` +
      `${stats.blockedChains} cadenas bloqueadas, ${stats.semanticLinks ?? 0} por el modelo, ` +
      `${stats.compared} pares comparados`,
  )
  return result
}
