// Deduplicación semántica (opción B) con DeepSeek: detecta paráfrasis que la
// comparación de texto no ve. GeoTips, Geometas y OpenGuessr cuentan lo mismo
// que Plonk It / Learnable Meta con otras palabras.
//
// Para cada país + categoría se manda al modelo una lista corta: los grupos de
// esas fuentes y, para cada uno, sus candidatos más parecidos del resto. El
// modelo devuelve qué textos dicen lo mismo; se guardan como vínculos entre
// pistas (semantic_links) y la deduplicación los aplica encima de la local.

import { tx } from './lib/db.mjs'
import { createLlm } from './lib/llm.mjs'
import { dedup } from './dedup.mjs'

const PARAPHRASE_SOURCES = new Set(['geotips', 'geometas', 'openguessr'])
const CANDIDATES_PER_ITEM = 10
const MAX_CHARS = 450

const STOP = new Set(
  ('the and are for with that this these those can you your from have has was were will its into than then ' +
    'also very often usually mostly some most many more such only which where when there their they them ' +
    'found seen common commonly typically country countries look looks like used use uses being been other')
    .split(' '),
)

const contentWords = (t) =>
  new Set(
    (t ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  )

function overlap(a, b) {
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared / Math.sqrt(a.size * b.size || 1)
}

const SYSTEM = `You deduplicate GeoGuessr tips collected from several websites.
Two tips are DUPLICATES only when the longer one states every main fact of the shorter one, so the shorter could be deleted without losing information. Different wording and extra notes in the longer one are fine.
They are NOT duplicates when they mention different features of the same object, different vehicles or camera setups, different designs, different places or regions, or different facts that only share a topic.
Example of NOT duplicates: "Plates are shorter than usual and lack the blue EU stripe" vs "Plates have an orange dot on the left" (same object, different facts).
Example of NOT duplicates: "Gen 4 was taken with a truck in Dubai" vs "Regular Gen 4 was taken with a black car" (different vehicles).
Example of duplicates: "The UAE is a desert nation with some mountains in the east" vs "Mountains are only found in the far east of the country".
When unsure, do not group. Answer only with JSON.`

function buildPrompt(countryName, category, items) {
  const lines = items.map((it, i) => `[${i + 1}] (${it.source}) ${it.text.replace(/\s+/g, ' ').slice(0, MAX_CHARS)}`)
  return (
    `Country: ${countryName}. Topic: ${category.replace(/_/g, ' ')}.\nTips:\n${lines.join('\n')}\n\n` +
    `Return {"groups": [[1, 2], ...]} listing only groups of 2 or more duplicate tips. ` +
    `Each tip may appear in at most one group. If there are no duplicates, return {"groups": []}.`
  )
}

export async function semantic(db, { model = 'deepseek-flash', limit = Infinity } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS semantic_links (
    hint_a INTEGER NOT NULL,
    hint_b INTEGER NOT NULL,
    model  TEXT NOT NULL,
    PRIMARY KEY (hint_a, hint_b)
  )`)

  // partir de los grupos locales (sin vínculos previos) para que las listas
  // sean estables entre ejecuciones y la caché funcione
  db.exec('DELETE FROM semantic_links')
  dedup(db, { quiet: true })

  const rows = db
    .prepare(
      `SELECT c.id, c.country_code cc, c.category cat, c.sources, h.id hint_id, h.source_id, h.text
       FROM clusters c JOIN hints h ON h.id = c.canonical_id
       WHERE c.country_code IS NOT NULL AND length(h.text) > 20
       ORDER BY c.country_code, c.category, c.id`,
    )
    .all()
  const countryName = new Map(db.prepare('SELECT code, name FROM countries').all().map((r) => [r.code, r.name]))

  const buckets = new Map()
  for (const r of rows) {
    const k = `${r.cc}|${r.cat}`
    if (!buckets.has(k)) buckets.set(k, { cc: r.cc, cat: r.cat, para: [], other: [] })
    const item = { hintId: r.hint_id, source: r.source_id, text: r.text, words: contentWords(r.text) }
    const srcs = JSON.parse(r.sources)
    if (srcs.some((s) => PARAPHRASE_SOURCES.has(s))) buckets.get(k).para.push(item)
    else buckets.get(k).other.push(item)
  }

  // listas para el modelo: cada pista de fuente "parafraseadora" + sus candidatos
  const jobs = []
  for (const b of buckets.values()) {
    if (b.para.length === 0) continue
    const chosen = new Map(b.para.map((p) => [p.hintId, p]))
    for (const p of b.para) {
      b.other
        .map((o) => ({ o, s: overlap(p.words, o.words) }))
        .filter((x) => x.s > 0.12)
        .sort((x, y) => y.s - x.s)
        .slice(0, CANDIDATES_PER_ITEM)
        .forEach(({ o }) => chosen.set(o.hintId, o))
    }
    if (chosen.size < 2) continue
    jobs.push({ ...b, items: [...chosen.values()].sort((x, y) => x.hintId - y.hintId) })
  }
  const selected = jobs.slice(0, limit)
  console.log(`[semantic] ${selected.length} listas (${selected.reduce((s, j) => s + j.items.length, 0)} pistas) con ${model}`)

  const llm = createLlm({ model })
  const links = []
  let done = 0
  await Promise.all(
    selected.map(async (job) => {
      const answer = await llm.json([
        { role: 'system', content: SYSTEM },
        { role: 'user', content: buildPrompt(countryName.get(job.cc) ?? job.cc, job.cat, job.items) },
      ])
      for (const group of answer?.groups ?? []) {
        if (!Array.isArray(group)) continue
        const ids = [...new Set(group.map(Number).filter((n) => n >= 1 && n <= job.items.length))].map(
          (n) => job.items[n - 1].hintId,
        )
        for (let i = 1; i < ids.length; i++) links.push([Math.min(ids[0], ids[i]), Math.max(ids[0], ids[i])])
      }
      done++
      if (done % 100 === 0) console.log(`[semantic] ${done}/${selected.length} · ${llm.cost().toFixed(3)} USD`)
    }),
  )

  const ins = db.prepare('INSERT OR IGNORE INTO semantic_links (hint_a, hint_b, model) VALUES (?, ?, ?)')
  tx(db, () => {
    for (const [a, b] of links) ins.run(a, b, model)
  })

  const u = llm.usage
  console.log(
    `[semantic] ✓ ${links.length} vínculos · ${u.calls} llamadas nuevas, ${u.cached} desde caché, ${u.failed} fallidas · ` +
      `tokens: ${u.promptMiss + u.promptHit} entrada, ${u.completion} salida · coste ≈ ${llm.cost().toFixed(3)} USD`,
  )
  dedup(db)
}
