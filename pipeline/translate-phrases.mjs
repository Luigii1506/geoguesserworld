// Traducción de frases cortas al español (DeepSeek), para lo que no son pistas: los rasgos de
// los objetos de meta («two black bands»), en qué se diferencian de su gemelo («3 bolts
// instead of 2») y las descripciones de las guías externas (pipeline/resources.mjs). Cada frase distinta se traduce una vez y se guarda en phrase_translations;
// la exportación la usa (pipeline/export.mjs, esPhrase).
//
//   npm run pipeline -- translate-phrases

import { tx, now } from './lib/db.mjs'
import { createLlm } from './lib/llm.mjs'

export const PHRASES_VERSION = 1
const PER_CALL = 60
const CALL_CHARS = 4000 // las descripciones de las guías son más largas: menos por llamada

const SYSTEM = `You translate short descriptive phrases and descriptions from a GeoGuessr study app into neutral Spanish.
Rules:
- Translate faithfully; keep it as short as the original. Do not add explanations.
- Keep unchanged: proper nouns, place names, local words quoted from signs, road codes, numbers, letters or characters being described.
- Vocabulary: bollard → bolardo, utility pole → poste, licence plate → matrícula, reflector → reflector, guardrail → guardarraíl, chevron → chevrón, Google car → coche de Google, road lines → líneas viales.
- If a phrase is already Spanish, return it unchanged.
Answer only with JSON: {"items": [{"id": 0, "es": "..."}]}`

export function ensurePhraseTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS phrase_translations (
    src            TEXT PRIMARY KEY,     -- la frase original
    es             TEXT NOT NULL,
    model          TEXT,
    version        INTEGER NOT NULL,
    translated_at  TEXT NOT NULL
  )`)
}

/** Las frases que hay que tener en español (rasgos y diferencias de los objetos de meta). */
function phrasesOf(db) {
  const out = new Set()
  for (const r of db.prepare('SELECT features FROM meta_objects').all())
    for (const f of JSON.parse(r.features ?? '[]')) if (typeof f === 'string' && f.trim()) out.add(f.trim())
  for (const r of db.prepare("SELECT note FROM object_relations WHERE relation = 'confused_with' AND note IS NOT NULL").all())
    if (r.note.trim()) out.add(r.note.trim())
  return [...out]
}

export async function translatePhrases(db, { model = 'deepseek-flash' } = {}) {
  await translatePhraseList(db, phrasesOf(db), { model })
}

/** Traduce (y guarda en phrase_translations) las frases de la lista que aún no estén. */
export async function translatePhraseList(db, phrases, { model = 'deepseek-flash' } = {}) {
  ensurePhraseTable(db)
  const done = new Set(db.prepare('SELECT src FROM phrase_translations WHERE version = ?').all(PHRASES_VERSION).map((r) => r.src))
  const todo = [...new Set(phrases.map((p) => p.trim()).filter(Boolean))].filter((p) => !done.has(p))
  console.log(`[phrases] ${todo.length} frases por traducir (${done.size} ya en caché)`)
  if (!todo.length) return
  const save = db.prepare(`INSERT INTO phrase_translations (src, es, model, version, translated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(src) DO UPDATE SET es = excluded.es, model = excluded.model, version = excluded.version, translated_at = excluded.translated_at`)
  const llm = createLlm({ model, concurrency: 10 })
  const batches = []
  let cur = []
  let size = 0
  for (const p of todo) {
    if (cur.length && (cur.length >= PER_CALL || size + p.length > CALL_CHARS)) (batches.push(cur), (cur = []), (size = 0))
    cur.push(p)
    size += p.length
  }
  if (cur.length) batches.push(cur)
  let saved = 0
  let calls = 0
  await Promise.all(
    batches.map(async (batch) => {
      const answer = await llm.json(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: JSON.stringify({ items: batch.map((text, id) => ({ id, text })) }) },
        ],
        { maxTokens: 6000 },
      )
      const rows = []
      for (const it of answer?.items ?? []) {
        const src = batch[Number(it.id)]
        const es = typeof it.es === 'string' ? it.es.trim() : ''
        if (src && es) rows.push([src, es])
      }
      const ts = now()
      tx(db, () => {
        for (const [src, es] of rows) save.run(src, es, model, PHRASES_VERSION, ts)
      })
      saved += rows.length
      if (++calls % 10 === 0) console.log(`[phrases] ${calls}/${batches.length} lotes · ${llm.cost().toFixed(3)} USD`)
    }),
  )
  console.log(`[phrases] ✓ ${saved} frases en español · coste ≈ ${llm.cost().toFixed(3)} USD`)
}

/** Traductor para la exportación: la frase en español si la hay, si no la original. */
export function phraseTranslator(db) {
  ensurePhraseTable(db)
  const map = new Map(db.prepare('SELECT src, es FROM phrase_translations').all().map((r) => [r.src, r.es]))
  return (s) => (typeof s === 'string' ? map.get(s.trim()) ?? s : s)
}
