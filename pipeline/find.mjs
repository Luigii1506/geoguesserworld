// Búsqueda inversa: "veo esto, ¿qué países son compatibles?"
//
//   npm run pipeline -- find bollard front_reflector_color=red back_reflector_color=white
//   npm run pipeline -- find road_lines center_line_color=yellow
//   npm run pipeline -- find licence_plate rear_color=yellow
//
// Un país es compatible si tiene algún objeto de ese tipo que no contradice
// ningún rasgo pedido. Se ordena por cuántos rasgos confirma (no solo "no
// contradice") y se avisa de los que solo coinciden por omisión.

import { OBJECT_TYPES } from './lib/meta-schema.mjs'

export function find(db, args) {
  const [type, ...conds] = args
  if (!OBJECT_TYPES[type]) {
    console.log(`Tipo desconocido. Usa uno de: ${Object.keys(OBJECT_TYPES).join(', ')}`)
    return
  }
  const wanted = Object.fromEntries(conds.map((c) => c.split('=')).filter(([k, v]) => k && v))
  for (const [k, v] of Object.entries(wanted)) {
    const allowed = OBJECT_TYPES[type].attrs[k]
    if (!allowed) return console.log(`Rasgo desconocido "${k}". Rasgos de ${type}: ${Object.keys(OBJECT_TYPES[type].attrs).join(', ')}`)
    if (!allowed.includes(v)) return console.log(`Valor "${v}" no válido para ${k}: ${allowed.join(' | ')}`)
  }

  const names = new Map(db.prepare('SELECT code, name_es, name FROM countries').all().map((r) => [r.code, r.name_es ?? r.name]))
  const objects = db.prepare('SELECT id, country_code, variant, region, attrs, features FROM meta_objects WHERE type = ?').all(type)

  const best = new Map() // país → mejor objeto
  for (const o of objects) {
    const attrs = JSON.parse(o.attrs)
    let confirmed = 0
    let conflict = false
    for (const [k, v] of Object.entries(wanted)) {
      if (!(k in attrs)) continue
      if (attrs[k] === v) confirmed++
      else conflict = true
    }
    if (conflict) continue
    const prev = best.get(o.country_code)
    const score = confirmed * 10 + (o.variant === 'main' ? 2 : 0)
    if (!prev || score > prev.score) best.set(o.country_code, { ...o, attrs, confirmed, score })
  }

  const total = Object.keys(wanted).length
  const list = [...best.values()].sort((a, b) => b.score - a.score)
  const full = list.filter((o) => o.confirmed === total)
  const partial = list.filter((o) => o.confirmed > 0 && o.confirmed < total)
  console.log(`\n${type} con ${Object.entries(wanted).map(([k, v]) => `${k}=${v}`).join(', ') || '(sin condiciones)'}`)
  console.log(`\n✔ Confirman todo (${full.length}):`)
  for (const o of full)
    console.log(`   ${names.get(o.country_code)}${o.region ? ` · ${o.region}` : ''} [${o.variant}] — ${JSON.parse(o.features).slice(0, 3).join(' | ')}`)
  if (partial.length) {
    console.log(`\n~ Confirman en parte, sin contradecir (${partial.length}):`)
    console.log(`   ${partial.map((o) => `${names.get(o.country_code)} (${o.confirmed}/${total})`).join(', ')}`)
  }
  const countries = db.prepare('SELECT COUNT(DISTINCT country_code) n FROM meta_objects WHERE type = ?').get(type).n
  console.log(`\n(${countries} países tienen datos de ${type}; los demás no se pueden descartar ni confirmar)`)
}
