// Wikidata + Wikipedia: los lugares del atlas (tabla `atlas` del staging, que
// llena `npm run pipeline -- atlas`). Aquí solo se normalizan y corrigen:
// lugares que ya no existen, volcanes registrados como montaña, datos
// inverosímiles.

export const meta = {
  id: 'wikidata',
  name: 'Wikidata y Wikipedia',
  url: 'https://www.wikidata.org',
  license: 'Wikidata: CC0 · textos de Wikipedia: CC BY-SA 4.0',
  attribution: 'Datos de Wikidata (CC0) y resúmenes de Wikipedia (CC BY-SA)',
}

// volcanes que Wikidata solo registra como montaña (sin clase ni número del Smithsonian)
const VOLCANO_OVERRIDE = new Set(['Q586212' /* Monte Pissis */, 'Q584570' /* Nevado Tres Cruces (Sur) */])
const NATURAL = new Set(['lake', 'river', 'island', 'desert', 'mountain', 'volcano', 'range', 'waterfall'])

export const wikiUrl = (lang, title) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`

/** Tipo final de un lugar del atlas (o null si hay que descartarlo). */
export function atlasKind(a) {
  // lo que ya no existe (Tenochtitlan…) fuera; lo natural solo si es paleo/antiguo y poco conocido
  // (el mar de Aral, con 140 Wikipedias, se secó en parte pero existe)
  if ((a.dissolved === 2 && (a.sitelinks ?? 0) < 40) || (a.dissolved && !NATURAL.has(a.type))) return null
  // los sitios UNESCO del atlas llevan la etiqueta `unesco`; su tipo es "monumento o lugar"
  let kind = a.type === 'heritage' ? 'landmark' : a.type
  if (kind === 'mountain') {
    const first = (a.extract ?? '').split(/(?<=\.)\s/)[0]
    if (a.volcanic || a.gvp || VOLCANO_OVERRIDE.has(a.qid) || /\b(estrato)?volc[aá]n\b|\b(strato)?volcano\b/i.test(`${a.description ?? ''} ${first}`)) kind = 'volcano'
  }
  return kind
}

export async function ingest(store, ctx) {
  const rows = ctx.staging.prepare('SELECT * FROM atlas').all()
  let n = 0
  let skipped = 0
  for (const a of rows) {
    const kind = atlasKind(a)
    // sin nombre en español ni en inglés: no se puede mostrar
    if (!kind || !(a.name_es ?? a.name_en)) {
      skipped++
      continue
    }
    const lang = a.extract_lang ?? (a.es_title ? 'es' : 'en')
    const title = lang === 'es' ? a.es_title : a.en_title
    const ccs = a.ccs ? [...new Set([a.cc, ...a.ccs.split(',')])] : [a.cc]
    const id = store.entity({
      id: a.qid, kind, name: a.name_es ?? a.name_en, name_en: a.name_en, cc: a.cc, ccs,
      lat: a.lat, lng: a.lng, fame: a.sitelinks ?? 0, image: a.image, thumb: a.image ? `${a.image}?width=480` : null,
      descr: a.description, summary: a.extract, wiki: title ? wikiUrl(lang, title) : null, wiki_lang: title ? lang : null,
      tags: a.unesco ? ['unesco'] : [], xref: { wd: a.qid, gvp: a.gvp, wp_es: a.es_title, wp_en: a.en_title },
      names: [['es', a.name_es], ['en', a.name_en], ['es', a.es_title], ['en', a.en_title]],
      // ciudades que además son región (Budapest, Debrecen, Berlín…): ante todo, ciudad
    }, { override: kind === 'city' || kind === 'town' ? ['kind', 'name', 'descr', 'lat', 'lng'] : [] })
    const f = (key, v, unit) => store.fact(id, key, v, { unit, source: meta.id })
    f('elevation', a.elevation, 'm')
    // un río de 5.800 km siempre es muy conocido: si no, el dato es erróneo
    if (!(kind === 'river' && (a.length_km ?? 0) > 2500 && (a.sitelinks ?? 0) < 25)) f('length', a.length_km, 'km')
    f('area', a.area_km2, 'km2')
    f('discharge', a.discharge, 'm3/s')
    f('basin', a.basin_km2, 'km2')
    f('prominence', a.prominence, 'm')
    f('depth', a.depth, 'm')
    f('visitors', a.visitors, '/año')
    if (ccs.length > 1) f('countries', ccs.length)
    if (a.population) store.fact(id, 'population', a.population, { scope: kind === 'city' || kind === 'town' ? 'city' : 'admin', source: meta.id })
    for (const cc of ccs) store.relate(id, 'in_country', store.resolve('iso', cc), meta.id)
    n++
  }
  ctx.log(`✓ ${n} lugares del atlas (${skipped} descartados: ya no existen o sin nombre)`)
}
