// Lugares que nombran las pistas de GeoGuessr (tablas hint_places, places y
// place_info del staging: `places`, `geocode`, `place-info`). Cada consulta
// ("Cofre de Perote|mx") se une a la entidad que corresponde: por QID, por
// artículo de Wikipedia o, sin artículo, por nombre y tipo dentro del país.
// La exportación de pistas usa el xref `hp` para enlazar cada mención con su
// entidad.

import { createHash } from 'node:crypto'
import { fold } from '../store.mjs'
import { wikiUrl } from './wikidata.mjs'

export const meta = {
  id: 'hints',
  name: 'Pistas de la comunidad de GeoGuessr',
  url: null,
  license: 'Uso personal',
  attribution: 'Lugares citados en las pistas de Plonk It, GeoHints, Geometas, GeoTips y otras',
}

/** Clave estable de una mención (la misma que usan las pistas exportadas). */
export const placeKey = (cc, query) => `${(cc ?? '').toLowerCase()}|${query.trim().toLowerCase()}`
export const placeKeyId = (key) => createHash('sha1').update(key).digest('hex').slice(0, 10)

const KIND = { road: 'other', '': 'other', village: 'town', neighbourhood: 'town', beach: 'coast' }

export async function ingest(store, ctx) {
  const db = ctx.staging
  const rows = db
    .prepare(
      `SELECT lower(COALESCE(hp.cc, '')) || '|' || lower(trim(hp.query)) AS pkey, hp.cc,
          MIN(hp.name) name, MIN(hp.name_es) name_es, MIN(hp.kind) kind,
          json_group_array(DISTINCT hp.hint_id) hint_ids,
          i.title, i.description, i.extract, i.image, i.thumb, i.lang, i.type, i.qid, i.sitelinks,
          COALESCE(p.lat, i.lat) lat, COALESCE(p.lng, i.lng) lng
       FROM hint_places hp
       LEFT JOIN place_info i ON i.key = lower(COALESCE(hp.cc, '')) || '|' || lower(trim(hp.query)) AND i.status = 'ok'
       LEFT JOIN places p ON p.key = lower(COALESCE(hp.cc, '')) || '|' || lower(trim(hp.query)) AND p.status = 'ok'
       WHERE hp.cc IS NOT NULL
       GROUP BY pkey`,
    )
    .all()
    .filter((r) => r.lat != null)
  // primero las que tienen artículo: las que no lo tienen se unen a ellas por nombre
  rows.sort((a, b) => (b.qid ? 2 : b.title ? 1 : 0) - (a.qid ? 2 : a.title ? 1 : 0))

  let n = 0
  for (const r of rows) {
    const cc = r.cc.toLowerCase()
    const kind = KIND[r.type ?? r.kind ?? ''] ?? r.type ?? r.kind ?? 'other'
    const name = r.name_es ?? r.name
    const lang = r.lang === 'en' ? 'en' : 'es'
    const nameKey = `${cc}|${fold(name)}`
    const id = store.entity({
      // sin QID ni artículo: el mismo nombre y tipo en el país es el mismo lugar
      id: r.qid ?? store.resolve(`wp_${lang}`, r.title) ?? store.resolve('cname', `${nameKey}|${kind}`) ?? store.resolve('cname', nameKey) ?? `hp:${placeKeyId(r.pkey)}`,
      kind, name, name_en: r.name, cc, lat: r.lat, lng: r.lng, fame: r.sitelinks ?? 0,
      image: r.image, thumb: r.thumb, descr: r.description, summary: r.extract,
      wiki: r.title ? wikiUrl(lang, r.title) : null, wiki_lang: r.title ? lang : null,
      xref: { wd: r.qid, [`wp_${lang}`]: r.title },
      names: [['es', r.name_es], ['en', r.name]],
    })
    store.xref(id, 'hp', placeKeyId(r.pkey))
    if (r.title || r.qid) {
      store.xref(id, 'cname', nameKey)
      store.xref(id, 'cname', `${nameKey}|${kind}`)
    }
    for (const h of JSON.parse(r.hint_ids)) store.hint(id, h, cc)
    store.relate(id, 'in_country', store.resolve('iso', cc), meta.id)
    n++
  }
  store.db.exec('UPDATE entity SET hints = (SELECT COUNT(*) FROM entity_hint h WHERE h.entity_id = entity.id) WHERE id IN (SELECT entity_id FROM entity_hint)')
  const linked = store.db.prepare('SELECT COUNT(DISTINCT entity_id) n FROM entity_hint').get().n
  ctx.log(`✓ ${n} menciones en las pistas → ${linked} lugares`)
}
