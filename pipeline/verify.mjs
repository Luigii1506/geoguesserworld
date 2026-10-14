// Verificación de rasgos raros (exclusivos o de 2 países): son donde más se
// equivoca la extracción, y a la vez los que más valen en partida. Para cada
// uno se manda al modelo el rasgo y los textos originales de donde salió, y se
// pregunta si el texto lo dice de verdad. Los falsos se corrigen o se borran,
// y se recalcula qué es común y qué es exclusivo. Se repite hasta que no quede
// ningún rasgo raro sin verificar (borrar uno puede volver raro a otro).

import { tx, now } from './lib/db.mjs'
import { createLlm } from './lib/llm.mjs'
import { OBJECT_TYPES } from './lib/meta-schema.mjs'
import { computeTraitStats } from './attributes.mjs'

const VERIFY_VERSION = 1
const MAX_RARE = 2 // rasgos con ≤ 2 países
const BATCH = 12

const SYSTEM = `You verify facts extracted from GeoGuessr tips. For each claim you get an object (in a country), one attribute with its value, the allowed values for that attribute, and the source tips.
Decide whether the source tips explicitly support the claim:
- "yes": the tips clearly state it.
- "fix": the tips describe this attribute but with a different allowed value; give it in "value".
- "no": the tips do not state this attribute for this object (it was guessed, or it describes something else such as a kerb, sign or wall).
Answer only with JSON: {"items": [{"id": ..., "verdict": "yes|fix|no", "value": null, "reason": "max 12 words"}]}`

export async function verifyTraits(db, { model = 'deepseek-flash' } = {}) {
  db.exec(`CREATE TABLE IF NOT EXISTS trait_checks (
    object_id INTEGER NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
    verdict TEXT NOT NULL, corrected TEXT, reason TEXT,
    model TEXT, version INTEGER NOT NULL, checked_at TEXT NOT NULL,
    PRIMARY KEY (object_id, key, value)
  )`)
  const hasTr = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name = 'hint_translations'").get().n > 0
  const textOf = db.prepare(
    hasTr
      ? "SELECT COALESCE(t.text, h.text) text FROM hints h LEFT JOIN hint_translations t ON t.hint_id = h.id AND t.lang = 'en' WHERE h.id = ?"
      : 'SELECT text FROM hints WHERE id = ?',
  )
  const countryName = new Map(db.prepare('SELECT code, name FROM countries').all().map((r) => [r.code, r.name]))
  const llm = createLlm({ model, concurrency: 10 })
  const totals = { checked: 0, yes: 0, fix: 0, no: 0 }

  for (let round = 1; round <= 4; round++) {
    const claims = db
      .prepare(
        `SELECT ot.object_id, ot.type, ot.key, ot.value, mo.country_code, mo.region, mo.variant,
                mo.hint_ids, mo.features, ts.n
         FROM object_traits ot
         JOIN meta_objects mo ON mo.id = ot.object_id
         JOIN trait_stats ts ON ts.type = ot.type AND ts.key = ot.key AND ts.value = ot.value
         WHERE ts.n <= ?
           AND NOT EXISTS (SELECT 1 FROM trait_checks c WHERE c.object_id = ot.object_id
                           AND c.key = ot.key AND c.value = ot.value AND c.version = ?)`,
      )
      .all(MAX_RARE, VERIFY_VERSION)
    if (claims.length === 0) break
    console.log(`[verify] ronda ${round}: ${claims.length} rasgos raros por verificar`)

    const batches = []
    for (let i = 0; i < claims.length; i += BATCH) batches.push(claims.slice(i, i + BATCH))

    const results = []
    await Promise.all(
      batches.map(async (batch) => {
        const items = batch.map((c, i) => {
          const tips = JSON.parse(c.hint_ids)
            .slice(0, 4)
            .map((id) => textOf.get(id)?.text ?? '')
            .filter(Boolean)
            .map((t) => t.replace(/\s+/g, ' ').slice(0, 700))
          return {
            id: i + 1,
            object: `${c.type}${c.variant !== 'main' ? ` (${c.variant})` : ''} in ${countryName.get(c.country_code)}${c.region ? `, ${c.region}` : ''}`,
            claim: `${c.key} = ${c.value}`,
            allowed: OBJECT_TYPES[c.type].attrs[c.key],
            tips: tips.length ? tips : ['(no source tips recorded)'],
          }
        })
        const answer = await llm.json(
          [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: JSON.stringify({ items }) },
          ],
          { maxTokens: 3000 },
        )
        const byId = new Map((answer?.items ?? []).map((it) => [Number(it.id), it]))
        batch.forEach((c, i) => {
          const r = byId.get(i + 1)
          if (!r || !['yes', 'fix', 'no'].includes(r.verdict)) return
          const allowed = OBJECT_TYPES[c.type].attrs[c.key]
          const fixed = r.verdict === 'fix' && allowed.includes(r.value) && r.value !== c.value ? r.value : null
          results.push({ c, verdict: r.verdict === 'fix' && !fixed ? 'no' : r.verdict, fixed, reason: r.reason ?? null })
        })
      }),
    )

    const saveCheck = db.prepare(`INSERT OR REPLACE INTO trait_checks
      (object_id, key, value, verdict, corrected, reason, model, version, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    const getAttrs = db.prepare('SELECT attrs FROM meta_objects WHERE id = ?')
    const setAttrs = db.prepare('UPDATE meta_objects SET attrs = ? WHERE id = ?')
    const delTrait = db.prepare('DELETE FROM object_traits WHERE object_id = ? AND key = ? AND value = ?')
    const insTrait = db.prepare('INSERT INTO object_traits (object_id, country_code, type, key, value) VALUES (?, ?, ?, ?, ?)')
    const ts = now()
    tx(db, () => {
      for (const { c, verdict, fixed, reason } of results) {
        saveCheck.run(c.object_id, c.key, c.value, verdict, fixed, reason, model, VERIFY_VERSION, ts)
        totals.checked++
        totals[verdict === 'fix' ? 'fix' : verdict]++
        if (verdict === 'yes') continue
        const attrs = JSON.parse(getAttrs.get(c.object_id).attrs)
        delTrait.run(c.object_id, c.key, c.value)
        if (fixed) {
          attrs[c.key] = fixed
          insTrait.run(c.object_id, c.country_code, c.type, c.key, fixed)
          // el valor corregido se marca como ya verificado
          saveCheck.run(c.object_id, c.key, fixed, 'yes', null, 'corrected', model, VERIFY_VERSION, ts)
        } else delete attrs[c.key]
        setAttrs.run(JSON.stringify(attrs), c.object_id)
      }
    })
    computeTraitStats(db)
  }

  console.log(
    `[verify] ✓ ${totals.checked} rasgos verificados · ${totals.yes} confirmados · ${totals.fix} corregidos · ` +
      `${totals.no} eliminados · ${llm.usage.calls} llamadas · coste ≈ ${llm.cost().toFixed(3)} USD`,
  )
}
