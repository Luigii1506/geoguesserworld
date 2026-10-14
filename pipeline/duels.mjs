// Duelos entre gemelos (países que se confunden): para cada pareja y cada tema
// visual (bolardos, matrículas, líneas, señales…) se elige la mejor foto de
// cada país y DeepSeek escribe, a partir de las pistas de ambos, una frase con
// la diferencia que se ve, más un titular: la forma más rápida de distinguirlos.
//
//   npm run pipeline -- duels        (de pago, con caché; luego `export`)
//
// La etapa guarda el resultado en la tabla `duels`; la exportación escribe
// public/community/duel/<a>_<b>.json (fotos, diferencias y fotos del quiz) y
// public/community/duels.json (el índice de parejas).

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { tx, now } from './lib/db.mjs'
import { createLlm } from './lib/llm.mjs'

export const DUEL_VERSION = 1

// temas que se ven en Street View, en el orden en que conviene mirarlos
export const DUEL_TOPICS = [
  { key: 'google_car', cat: 'google_car', label: 'Coche de Google' },
  { key: 'road_lines', cat: 'road_lines', label: 'Líneas de la carretera' },
  { key: 'bollards', cat: 'bollards', label: 'Bolardos' },
  { key: 'plates', cat: 'plates', label: 'Matrículas' },
  { key: 'speed', cat: 'signs', sub: 'speed', label: 'Límites de velocidad' },
  { key: 'stop', cat: 'signs', sub: 'stop', label: 'Señal de stop' },
  { key: 'chevrons', cat: 'signs', sub: 'chevrons', label: 'Chevrones' },
  { key: 'directions', cat: 'signs', sub: 'directions', label: 'Señales de dirección' },
  { key: 'poles', cat: 'poles', label: 'Postes' },
  { key: 'guardrails', cat: 'guardrails', label: 'Guardarraíles' },
  { key: 'road_numbering', cat: 'road_numbering', label: 'Numeración de carreteras' },
  { key: 'language', cat: 'language', label: 'Idioma y escritura' },
  { key: 'architecture', cat: 'architecture', label: 'Arquitectura' },
  { key: 'landscape', cat: 'landscape', label: 'Paisaje' },
]

const SYSTEM = `You help a GeoGuessr player tell apart two countries that look alike in Street View.
You get, per topic, short tips about country A and country B (taken from community guides).
For each topic decide whether it helps to tell them apart from what is visible in the image:
- "same": true if the tips show the same thing in both or don't give a usable visible difference.
- "diff": if same is false, ONE short sentence in Spanish (max 22 words) with the concrete visible difference, naming both countries, e.g. "En Estados Unidos dice «SPEED LIMIT» en millas; en Canadá, «MAXIMUM» en km/h."
Also give "headline": the single fastest way to tell them apart, in Spanish, max 18 words, starting with a verb or noun (no "La forma más rápida es").
Use ONLY facts present in the tips. Never invent. Spanish from Spain/LatAm, natural and direct.
Answer only JSON: {"headline": "...", "topics": {"<key>": {"same": true|false, "diff": "..."}}}`

const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s ?? '')

/** Pistas de un país en un tema: las de todo el país primero, las más útiles y confirmadas. */
function topicRows(db, cc, t) {
  return db
    .prepare(
      `SELECT c.id, c.region, c.usefulness u, c.source_count sc, h.id hid,
          COALESCE((SELECT text FROM hint_translations x WHERE x.hint_id = h.id AND x.lang = 'en'), h.text) en,
          COALESCE((SELECT text FROM hint_translations x WHERE x.hint_id = h.id AND x.lang = 'es'), h.text) es
       FROM clusters c JOIN hints h ON h.id = c.canonical_id
       WHERE c.country_code = ? AND c.category = ? AND COALESCE(c.quality, 'ok') = 'ok'
         ${t.sub ? 'AND c.subcategory = ?' : ''} AND length(h.text) > 0
       ORDER BY (c.region IS NULL) DESC, COALESCE(c.usefulness, 2) DESC, c.source_count DESC, c.size DESC
       LIMIT 8`,
    )
    .all(...[cc, t.cat, ...(t.sub ? [t.sub] : [])])
}

/** Parejas de gemelos: los 3 primeros de cada país con guía (cada pareja una vez). */
export function duelPairs(countries) {
  const withGuide = new Set(countries.filter((c) => c.groups >= 30).map((c) => c.code))
  const pairs = new Map()
  for (const c of countries) {
    if (!withGuide.has(c.code)) continue
    ;(c.confusable ?? []).slice(0, 3).forEach((o, rank) => {
      if (!withGuide.has(o)) return
      const key = [c.code, o].sort().join('_')
      pairs.set(key, (pairs.get(key) ?? 0) + (3 - rank))
    })
  }
  return [...pairs.entries()].map(([key, score]) => ({ key, a: key.split('_')[0], b: key.split('_')[1], score })).sort((x, y) => y.score - x.score)
}

export function ensureDuelTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS duels (
    pair        TEXT PRIMARY KEY,      -- "ca_us" (códigos ordenados)
    result      TEXT NOT NULL,         -- JSON {headline, topics:{key:{same,diff}}}
    model       TEXT,
    version     INTEGER NOT NULL,
    created_at  TEXT NOT NULL
  )`)
}

export async function duels(db, { model = 'deepseek-flash', limit = Infinity } = {}) {
  ensureDuelTable(db)
  const countries = JSON.parse(
    (await import('node:fs')).readFileSync(path.join(process.cwd(), 'public', 'community', 'countries.json'), 'utf8'),
  )
  const names = new Map(countries.map((c) => [c.code, c.name]))
  const done = new Set(db.prepare('SELECT pair FROM duels WHERE version = ?').all(DUEL_VERSION).map((r) => r.pair))
  const pending = duelPairs(countries).filter((p) => !done.has(p.key)).slice(0, limit)
  console.log(`[duels] ${pending.length} parejas por redactar (${model})`)
  const llm = createLlm({ model, concurrency: 8 })
  const save = db.prepare(`INSERT INTO duels (pair, result, model, version, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(pair) DO UPDATE SET result=excluded.result, model=excluded.model, version=excluded.version, created_at=excluded.created_at`)

  let ok = 0
  await Promise.all(
    pending.map(async (p) => {
      const topics = {}
      for (const t of DUEL_TOPICS) {
        const ra = topicRows(db, p.a, t).slice(0, 3)
        const rb = topicRows(db, p.b, t).slice(0, 3)
        if (!ra.length || !rb.length) continue
        topics[t.key] = { topic: t.label, A: ra.map((r) => clip(r.en, 280)), B: rb.map((r) => clip(r.en, 280)) }
      }
      if (!Object.keys(topics).length) return
      const answer = await llm.json(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: JSON.stringify({ A: names.get(p.a), B: names.get(p.b), topics }) },
        ],
        { maxTokens: 2500 },
      )
      if (!answer?.topics) return
      tx(db, () => save.run(p.key, JSON.stringify(answer), model, DUEL_VERSION, now()))
      ok++
      if (ok % 25 === 0) console.log(`[duels] ${ok}/${pending.length} · ${llm.cost().toFixed(3)} USD`)
    }),
  )
  console.log(`[duels] ✓ ${ok} parejas · coste ≈ ${llm.cost().toFixed(3)} USD`)
}

/** Exporta un JSON por pareja (fotos, diferencias y fotos del quiz) y el índice. */
export function exportDuels(db, countries, servable, outDir) {
  ensureDuelTable(db)
  const results = new Map(db.prepare('SELECT pair, result FROM duels').all().map((r) => [r.pair, JSON.parse(r.result)]))
  const imgStmt = db.prepare(`SELECT i.url FROM cluster_members m JOIN hint_images i ON i.hint_id = m.hint_id
    WHERE m.cluster_id = ? ORDER BY (m.hint_id = ?) DESC, i.ord LIMIT 4`)
  const sentence = (s) => {
    const t = (s ?? '').split(/\s*-{2,}\s*(?:NOTE|NOTA)\s*:?/i)[0].replace(/^[\s•▪●◦·*–-]+/gm, '').replace(/\s+/g, ' ').trim()
    return clip(t, 220)
  }
  /** Mejor pista con foto de un país en un tema. */
  const side = (cc, t) => {
    for (const r of topicRows(db, cc, t)) {
      const imgs = imgStmt.all(r.id, r.hid).map((x) => servable(x.url)).filter(Boolean)
      if (imgs.length) return { img: imgs[0], more: imgs.slice(1), text: sentence(r.es), region: r.region }
    }
    const r = topicRows(db, cc, t)[0]
    return r ? { img: null, more: [], text: sentence(r.es), region: r.region } : null
  }

  mkdirSync(path.join(outDir, 'duel'), { recursive: true })
  const index = []
  for (const p of duelPairs(countries)) {
    const res = results.get(p.key)
    const topics = []
    const quiz = { [p.a]: [], [p.b]: [] }
    for (const t of DUEL_TOPICS) {
      const a = side(p.a, t)
      const b = side(p.b, t)
      if (!a && !b) continue
      const r = res?.topics?.[t.key]
      topics.push({ key: t.key, label: t.label, a, b, same: r ? Boolean(r.same) : null, diff: r && !r.same ? r.diff ?? null : null })
      for (const [cc, s] of [[p.a, a], [p.b, b]]) if (s?.img) quiz[cc].push({ img: s.img, topic: t.label, text: s.text })
    }
    // más fotos para el quiz: otras pistas con foto de esos temas
    for (const cc of [p.a, p.b]) {
      for (const t of DUEL_TOPICS) {
        if (quiz[cc].length >= 16) break
        for (const r of topicRows(db, cc, t).slice(1, 3)) {
          const img = imgStmt.all(r.id, r.hid).map((x) => servable(x.url))[0]
          if (img && !quiz[cc].some((q) => q.img === img)) quiz[cc].push({ img, topic: t.label, text: sentence(r.es) })
        }
      }
    }
    // primero los temas que distinguen (con frase), luego los que no sabemos, al final los iguales
    topics.sort((x, y) => (x.diff ? 0 : x.same === null ? 1 : 2) - (y.diff ? 0 : y.same === null ? 1 : 2))
    const file = { a: p.a, b: p.b, headline: res?.headline ?? null, topics, quiz }
    writeFileSync(path.join(outDir, 'duel', `${p.key}.json`), JSON.stringify(file))
    index.push({ a: p.a, b: p.b, score: p.score, headline: res?.headline ?? null, diffs: topics.filter((t) => t.diff).length })
  }
  writeFileSync(path.join(outDir, 'duels.json'), JSON.stringify(index))
  return index.length
}
