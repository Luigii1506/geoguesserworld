// Traducción con DeepSeek: guarda cada texto canónico en español e inglés.
//
// Se traduce solo la pista canónica de cada grupo útil (las copias del grupo
// dicen lo mismo). El original se conserva siempre en hints.text; aquí se
// guardan las versiones es/en en hint_translations. Si el original ya está
// en inglés, la versión inglesa es el propio original (no se paga).

import { tx, now } from './lib/db.mjs'
import { createLlm } from './lib/llm.mjs'

export const TRANSLATE_VERSION = 1
const BATCH_CHARS = 6000 // texto por llamada: la salida duplica aproximadamente la entrada
const MAX_ITEMS = 20
const MAX_TEXT = 10000 // el más largo de la base tiene ~8.400: no se recorta nada; los largos van solos

const GLOSSARY = [
  ['bollard', 'bolardo'],
  ['Google car / Street View car', 'coche de Google'],
  ['follow car', 'coche escolta'],
  ['generation 3 / Gen 3', 'generación 3 / Gen 3'],
  ['trekker', 'trekker'],
  ['coverage', 'cobertura'],
  ['guardrail', 'guardarraíl'],
  ['chevron (sign)', 'chevrón (señal de curva)'],
  ['utility pole', 'poste'],
  ['road lines / centre line', 'líneas viales / línea central'],
  ['licence plate', 'matrícula'],
  ['roof rack', 'baca'],
  ['snorkel', 'snórkel'],
  ['antenna', 'antena'],
  ['blur / smudge', 'desenfoque / mancha'],
  ['pinpoint', 'ubicar con precisión'],
  ['meta', 'meta'],
]

const SYSTEM = `You translate GeoGuessr tips for a study app. For each item return both a Spanish and an English version.
Rules:
- Translate faithfully and completely; do not summarise, add or drop information.
- Keep unchanged: proper nouns, place names, local words quoted from signs (e.g. "utca", "rruga", "ALTO"), road codes (A380, RN3), numbers, units and letters or characters being described.
- Use neutral Spanish (no regional slang) and this glossary consistently:
${GLOSSARY.map(([en, es]) => `  ${en} → ${es}`).join('\n')}
- Keep line breaks and bullet points ("•") as in the original.
- "lang": the ISO 639-1 code of the original text.
- If the original is already English, return "en": null (it is kept as is). If it is already Spanish, return "es": null.
Answer only with JSON: {"items": [{"id": ..., "lang": "..", "es": "...", "en": "..."}]}`

export async function translate(db, { model = 'deepseek-flash', limit = Infinity } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS hint_translations (
    hint_id        INTEGER NOT NULL,
    lang           TEXT NOT NULL,          -- es | en
    text           TEXT NOT NULL,
    source_lang    TEXT,                   -- idioma del original
    is_original    INTEGER NOT NULL,       -- 1 si es el texto original sin traducir
    model          TEXT,
    version        INTEGER NOT NULL,
    translated_at  TEXT NOT NULL,
    PRIMARY KEY (hint_id, lang)
  )`)

  // marcas de GeoHints ("Beer brand: Corona"): plantilla fija, el nombre propio no se traduce
  const brands = db
    .prepare(
      `SELECT id, text FROM hints WHERE source_id = 'geohints' AND source_label LIKE 'companies/%' AND length(text) > 0
         AND id NOT IN (SELECT hint_id FROM hint_translations WHERE lang = 'es' AND version = ?)`,
    )
    .all(TRANSLATE_VERSION)
  const saveRule = db.prepare(`INSERT OR REPLACE INTO hint_translations
      (hint_id, lang, text, source_lang, is_original, model, version, translated_at)
    VALUES (?, ?, ?, 'en', ?, 'rule', ?, ?)`)
  const tsRule = now()
  tx(db, () => {
    for (const b of brands) {
      const es = b.text
        .replace(/^Beer brand:/, 'Marca de cerveza:')
        .replace(/^Gas station:/, 'Gasolinera:')
        .replace(/^Postal service:/, 'Servicio postal:')
      saveRule.run(b.id, 'es', es, 0, TRANSLATE_VERSION, tsRule)
      saveRule.run(b.id, 'en', b.text, 1, TRANSLATE_VERSION, tsRule)
    }
  })
  if (brands.length) console.log(`[translate] ${brands.length} marcas por plantilla`)

  const pending = db
    .prepare(
      `SELECT h.id, h.text FROM clusters c JOIN hints h ON h.id = c.canonical_id
       WHERE COALESCE(c.quality, 'ok') = 'ok' AND length(h.text) > 0
         AND h.id NOT IN (SELECT hint_id FROM hint_translations WHERE lang = 'es' AND version = ?)
       UNION
       -- el pie de foto de una imagen del índice visual, aunque su grupo no sea útil como pista
       -- (global, basura): la foto se ve igual, y su texto no tiene otra traducción que heredar
       SELECT h.id, h.text FROM hints h
       WHERE length(h.text) > 0 AND EXISTS (SELECT 1 FROM hint_images i WHERE i.hint_id = h.id)
         AND NOT EXISTS (SELECT 1 FROM hint_translations t WHERE t.hint_id = h.id AND t.lang = 'es')
         AND NOT EXISTS (SELECT 1 FROM cluster_members m JOIN clusters c ON c.id = m.cluster_id
                           JOIN hint_translations t ON t.hint_id = c.canonical_id AND t.lang = 'es' WHERE m.hint_id = h.id)
       ORDER BY 1`,
    )
    .all(TRANSLATE_VERSION)
  if (Number.isFinite(limit)) pending.sort(() => Math.random() - 0.5)
  const items = pending.slice(0, limit)

  const batches = []
  let cur = []
  let size = 0
  for (const h of items) {
    const len = Math.min(h.text.length, MAX_TEXT)
    if (cur.length && (size + len > BATCH_CHARS || cur.length >= MAX_ITEMS)) {
      batches.push(cur)
      cur = []
      size = 0
    }
    cur.push(h)
    size += len
  }
  if (cur.length) batches.push(cur)
  console.log(`[translate] ${items.length} textos en ${batches.length} lotes (${model})`)

  const save = db.prepare(`INSERT INTO hint_translations
      (hint_id, lang, text, source_lang, is_original, model, version, translated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(hint_id, lang) DO UPDATE SET text=excluded.text, source_lang=excluded.source_lang,
      is_original=excluded.is_original, model=excluded.model, version=excluded.version,
      translated_at=excluded.translated_at`)

  const llm = createLlm({ model, concurrency: 10 })
  const stats = { saved: 0, missing: 0, truncated: 0 }
  let done = 0

  await Promise.all(
    batches.map(async (batch) => {
      const payload = batch.map((h) => {
        if (h.text.length > MAX_TEXT) stats.truncated++
        return { id: h.id, text: h.text.slice(0, MAX_TEXT) }
      })
      const answer = await llm.json(
        [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: JSON.stringify({ items: payload }) },
        ],
        { maxTokens: 8000 },
      )
      const byId = new Map((answer?.items ?? []).map((it) => [Number(it.id), it]))
      const rows = []
      for (const h of batch) {
        const r = byId.get(h.id)
        const es = typeof r?.es === 'string' && r.es.trim() ? r.es.trim() : null
        const en = typeof r?.en === 'string' && r.en.trim() ? r.en.trim() : null
        const lang = typeof r?.lang === 'string' ? r.lang.slice(0, 5).toLowerCase() : null
        // el modelo omite la versión en el idioma del original: se usa el original
        const esText = es ?? (lang === 'es' ? h.text : null)
        const enText = en ?? (lang === 'en' || (!lang && es) ? h.text : null)
        if (!esText || !enText) {
          stats.missing++
          continue
        }
        rows.push([h.id, 'es', esText, lang, esText === h.text ? 1 : 0])
        rows.push([h.id, 'en', enText, lang, enText === h.text ? 1 : 0])
      }
      const ts = now()
      tx(db, () => {
        for (const row of rows) save.run(...row, model, TRANSLATE_VERSION, ts)
      })
      stats.saved += rows.length / 2
      done++
      if (done % 50 === 0) console.log(`[translate] ${done}/${batches.length} lotes · ${llm.cost().toFixed(3)} USD`)
    }),
  )

  const u = llm.usage
  console.log(
    `[translate] ✓ ${stats.saved} textos con es + en · ${stats.missing} sin respuesta completa · ` +
      `${stats.truncated} recortados a ${MAX_TEXT} caracteres · ${u.calls} llamadas, ${u.cached} desde caché, ` +
      `${u.failed} fallidas · tokens ${u.promptMiss + u.promptHit} entrada / ${u.completion} salida · ` +
      `coste ≈ ${llm.cost().toFixed(3)} USD`,
  )
}
