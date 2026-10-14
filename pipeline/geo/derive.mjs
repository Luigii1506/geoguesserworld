// Pasos que no dependen de ninguna fuente, tras ingerirlas todas:
//   1. fundir duplicados: lugares de las pistas sin QID (hp:…) que son otra entidad
//   2. región admin1 de cada lugar con coordenadas (y su país si no lo tenía)
//   3. las áreas urbanas toman foto y resumen de su ciudad principal

import { fold } from './store.mjs'
import { km } from './lib/geom.mjs'

// tipos que pueden ser el mismo lugar aunque cada fuente lo llame distinto
const SAME = { region: ['admin1', 'region'], town: ['city', 'town'], city: ['city', 'town'], other: null, natural: null }

/** Lugares de las pistas sin identificador (hp:) que ya existen con QID o GeoNames: se funden. */
function mergeDuplicates(store, ctx) {
  const db = store.db
  const byName = new Map()
  for (const e of db.prepare("SELECT id, kind, cc, name, name_en, lat, lng FROM entity WHERE id NOT LIKE 'hp:%' AND lat IS NOT NULL").all())
    for (const n of new Set([fold(e.name), fold(e.name_en)])) {
      if (!n) continue
      const k = `${e.cc}|${n}`
      if (!byName.has(k)) byName.set(k, [])
      byName.get(k).push(e)
    }
  let merged = 0
  for (const h of db.prepare("SELECT id, kind, cc, name, name_en, lat, lng FROM entity WHERE id LIKE 'hp:%'").all()) {
    const kinds = SAME[h.kind] === undefined ? [h.kind] : SAME[h.kind]
    const maxKm = h.kind === 'region' ? 400 : 30
    const cands = [fold(h.name), fold(h.name_en)].flatMap((n) => byName.get(`${h.cc}|${n}`) ?? [])
      .filter((e) => (!kinds || kinds.includes(e.kind)) && km(e.lat, e.lng, h.lat, h.lng) < maxKm)
      .sort((a, b) => km(a.lat, a.lng, h.lat, h.lng) - km(b.lat, b.lng, h.lat, h.lng))
    if (!cands.length) continue
    store.merge(h.id, cands[0].id)
    merged++
  }
  // los hp: repetidos entre sí (la misma ciudad citada con dos consultas)
  const seen = new Map()
  for (const h of db.prepare("SELECT id, kind, cc, name, lat, lng FROM entity WHERE id LIKE 'hp:%' ORDER BY hints DESC").all()) {
    const k = `${h.cc}|${h.kind}|${fold(h.name)}`
    const prev = seen.get(k)
    if (prev && km(prev.lat, prev.lng, h.lat, h.lng) < 30) {
      store.merge(h.id, prev.id)
      merged++
    } else if (!prev) seen.set(k, h)
  }
  db.exec('UPDATE entity SET hints = (SELECT COUNT(*) FROM entity_hint h WHERE h.entity_id = entity.id)')
  ctx.log(`✓ ${merged} duplicados fundidos`)
}

/** Las áreas urbanas, con la foto, el resumen y el artículo de su ciudad principal. */
function urbanFromCenter(store, ctx) {
  const r = store.db.prepare(`UPDATE entity SET
      image = (SELECT c.image FROM relation r JOIN entity c ON c.id = r.subject WHERE r.object = entity.id AND r.predicate = 'center_of'),
      thumb = (SELECT c.thumb FROM relation r JOIN entity c ON c.id = r.subject WHERE r.object = entity.id AND r.predicate = 'center_of'),
      summary = (SELECT c.summary FROM relation r JOIN entity c ON c.id = r.subject WHERE r.object = entity.id AND r.predicate = 'center_of'),
      wiki = (SELECT c.wiki FROM relation r JOIN entity c ON c.id = r.subject WHERE r.object = entity.id AND r.predicate = 'center_of'),
      wiki_lang = (SELECT c.wiki_lang FROM relation r JOIN entity c ON c.id = r.subject WHERE r.object = entity.id AND r.predicate = 'center_of'),
      fame = COALESCE((SELECT c.fame FROM relation r JOIN entity c ON c.id = r.subject WHERE r.object = entity.id AND r.predicate = 'center_of'), 0)
    WHERE kind = 'urban'`).run()
  ctx.log(`✓ ${r.changes} áreas urbanas con la ficha de su ciudad principal`)
}

export async function derive(store, ctx) {
  store.tx(() => mergeDuplicates(store, ctx))
  store.tx(() => urbanFromCenter(store, ctx))
  const ne = ctx.shapes
  const db = store.db
  const rows = db
    .prepare("SELECT id, cc, lat, lng FROM entity WHERE lat IS NOT NULL AND kind NOT IN ('country', 'admin1') AND admin1 IS NULL")
    .all()
  const setAdmin = db.prepare('UPDATE entity SET admin1 = ?, cc = COALESCE(cc, ?) WHERE id = ?')
  let n = 0
  store.tx(() => {
    for (const r of rows) {
      const a = ne.admin1At(r.lng, r.lat, r.cc ?? undefined, 25) ?? (r.cc ? null : ne.admin1At(r.lng, r.lat, undefined, 25))
      if (!a) continue
      const aid = store.resolve('ne', a.props.adm1_code)
      if (!aid) continue
      setAdmin.run(aid, a.cc, r.id)
      store.relate(r.id, 'in_admin1', aid, 'naturalearth')
      n++
    }
  })
  ctx.log(`✓ región admin1 de ${n} de ${rows.length} lugares`)
}
