// Gentilicios en español con DeepSeek (el dataset abierto solo trae inglés y
// francés). Sirven para ocultar el país en las preguntas de entrenamiento:
// "los bolardos húngaros…" no debe delatar la respuesta.

import { tx } from './lib/db.mjs'
import { createLlm } from './lib/llm.mjs'

const SYSTEM = `For each country give its Spanish demonyms: masculine singular, feminine singular, masculine plural and feminine plural, plus any common alternative (e.g. Reino Unido: británico, británica, británicos, británicas, inglés, inglesa…). Lowercase.
Answer only with JSON: {"items": [{"code": "..", "demonyms": ["...", "..."]}]}`

export async function demonyms(db, { model = 'deepseek-flash' } = {}) {
  const rows = db
    .prepare(
      `SELECT code, name_es, name FROM countries
       WHERE (demonyms_es IS NULL OR demonyms_es = '[]')
         AND code IN (SELECT DISTINCT country_code FROM clusters WHERE country_code IS NOT NULL)`,
    )
    .all()
  if (!rows.length) return console.log('[demonyms] nada pendiente')
  const llm = createLlm({ model })
  const set = db.prepare('UPDATE countries SET demonyms_es = ? WHERE code = ?')
  const batches = []
  for (let i = 0; i < rows.length; i += 40) batches.push(rows.slice(i, i + 40))
  let saved = 0
  for (const batch of batches) {
    const answer = await llm.json(
      [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify({ items: batch.map((r) => ({ code: r.code, country: r.name_es ?? r.name })) }) },
      ],
      { maxTokens: 6000 },
    )
    tx(db, () => {
      for (const it of answer?.items ?? []) {
        const list = (it.demonyms ?? []).filter((d) => typeof d === 'string' && d.trim()).map((d) => d.trim().toLowerCase())
        if (!list.length || !batch.some((r) => r.code === it.code)) continue
        set.run(JSON.stringify([...new Set(list)]), it.code)
        saved++
      }
    })
  }
  console.log(`[demonyms] ✓ ${saved} países · coste ≈ ${llm.cost().toFixed(3)} USD`)
}
