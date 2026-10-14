// Smithsonian Global Volcanism Program, "Volcanoes of the World": todos los
// volcanes del Holoceno y del Pleistoceno con tipo, última erupción, entorno
// tectónico y roca. Tabla `gvp` del staging (`npm run pipeline -- volcanes`).

export const meta = {
  id: 'gvp',
  name: 'Smithsonian Global Volcanism Program',
  url: 'https://volcano.si.edu',
  license: 'Uso libre citando la fuente',
  attribution: 'Global Volcanism Program, Smithsonian Institution: Volcanoes of the World (v. 5)',
}

/** activo (erupción desde 1900) · reciente (1500–1899) · dormido (Holoceno) · extinto (Pleistoceno) */
export function volcanoStatus(g) {
  const le = g.last_eruption
  if (le != null && le >= 1900) return 'activo'
  if (le != null && le >= 1500) return 'reciente'
  return /pleisto/i.test(g.epoch ?? '') ? 'extinto' : 'dormido'
}

/** Tipo del Smithsonian agrupado (clave estable para filtrar). */
export function volcanoShape(t) {
  const x = (t ?? '').toLowerCase()
  if (!x) return null
  if (x.startsWith('strato')) return 'estratovolcan'
  if (x.startsWith('shield')) return 'escudo'
  if (x.startsWith('caldera')) return 'caldera'
  if (x.includes('lava dome')) return 'domo'
  if (x.includes('volcanic field')) return 'campo'
  if (x.includes('cone') || x.includes('maar') || x.includes('crater') || x.includes('tuya')) return 'cono'
  if (x.includes('fissure')) return 'fisura'
  if (x.startsWith('complex') || x.startsWith('compound')) return 'complejo'
  if (x.includes('submarine')) return 'submarino'
  return null
}

export async function ingest(store, ctx) {
  const ne = ctx.shapes
  const rows = ctx.staging.prepare('SELECT * FROM gvp').all()
  let linked = 0
  let created = 0
  for (const g of rows) {
    const known = store.resolve('gvp', g.number) ?? (g.qid ? store.resolve('wd', g.qid) : null)
    // los del Pleistoceno sin artículo en Wikidata son miles de conos menores: solo si ya están
    if (!known && !g.qid && /pleisto/i.test(g.epoch ?? '')) continue
    const cc = known ? null : ne.countryAt(g.lng, g.lat, 60)?.cc
    if (!known && !cc) continue // submarinos lejos de la costa
    const status = volcanoStatus(g)
    const shape = volcanoShape(g.type)
    const id = store.entity({
      id: known ?? g.qid ?? `gvp:${g.number}`, kind: 'volcano', name: g.name, name_en: g.name, cc, lat: g.lat, lng: g.lng,
      tags: [status, shape].filter(Boolean), xref: { gvp: g.number, wd: g.qid },
    })
    // en Wikidata hay montañas que son volcanes (Ojos del Salado, Pissis…)
    const e = store.get(id)
    if (e.kind === 'mountain') store.db.prepare("UPDATE entity SET kind = 'volcano' WHERE id = ?").run(id)
    const f = (key, v, unit) => store.fact(id, key, v, { unit, source: meta.id })
    store.fact(id, 'elevation', g.elevation, { unit: 'm', source: meta.id, keep: true })
    f('last_eruption', g.last_eruption, 'año')
    f('volcano_status', status)
    f('volcano_type', g.type)
    f('tectonic', g.tectonic)
    f('rock', g.rock)
    // resumen geológico (en inglés) solo si no hay resumen de Wikipedia
    if (!e.summary && g.summary) store.db.prepare('UPDATE entity SET summary = ? WHERE id = ?').run(g.summary.slice(0, 900), id)
    if (cc) store.relate(id, 'in_country', store.resolve('iso', cc), meta.id)
    if (known) linked++
    else created++
  }
  ctx.log(`✓ ${linked} volcanes completados · ${created} nuevos`)
}
