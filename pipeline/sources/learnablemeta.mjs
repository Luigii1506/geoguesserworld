// Learnable Meta — mapas comunitarios con una meta explicada por ubicación.
// La lista de mapas sale de /api/maps y cada página de mapa expone su lista
// completa de metas en /maps/<id>/__data.json (formato devalue de SvelteKit).
// Una misma meta aparece en varios mapas: se deduplica por su id.

import { fetchJson } from '../lib/fetch.mjs'
import { htmlToText } from '../lib/html.mjs'
import { pageData } from '../lib/devalue.mjs'

export const meta = {
  id: 'learnablemeta',
  name: 'Learnable Meta',
  homepage: 'https://learnablemeta.com/maps',
  license: 'Código AGPL-3.0; contenido de metas sin licencia propia (parte de Plonk It). Uso personal.',
  method: '/api/maps + /maps/<id>/__data.json',
}

/** "Australia - Bollard" → { country: "Australia", label: "Bollard" } */
function splitName(name, resolver) {
  const parts = name.split(/\s+[-–|:]\s+/)
  if (parts.length >= 2) {
    if (resolver.lookup(parts[0]).code) return { country: parts[0], label: parts.slice(1).join(' - ') }
    const last = parts.at(-1)
    if (resolver.lookup(last).code) return { country: last, label: parts.slice(0, -1).join(' - ') }
  }
  return { country: null, label: name }
}

/**
 * Busca un país dentro del nombre del mapa ("A Learnable Meta Argentina",
 * "ALM - Kenya Counties", "USA Bollards / Reflectors"). Prueba trozos de
 * 1-4 palabras, los más largos primero; ignora los de menos de 4 letras salvo
 * siglas conocidas, para no confundir palabras como "is" o "in" con códigos ISO.
 */
function countryFromMapName(mapName, resolver) {
  const words = mapName.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  for (let size = 4; size >= 1; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const gram = words.slice(i, i + size).join(' ')
      const short = gram.length < 4 && !/^(USA|UK|UAE)$/.test(gram)
      if (short) continue
      if (resolver.lookup(gram).code) return gram
    }
  }
  return null
}

/** plonkit.net/<slug> en el pie de atribución → nombre de país. */
function countryFromUpstream(url) {
  const slug = url?.match(/plonkit\.net\/([a-z-]+)/)?.[1]
  return slug && slug !== 'guide' ? slug.replace(/-/g, ' ') : null
}

const REGIONAL_MAP = /\b(states|counties|provinces|regions|oblasts|prefectures|departments|districts|municipalities|voivodeships|cantons)\b/i

export async function run(ctx, sink) {
  const maps = await fetchJson(ctx, 'https://learnablemeta.com/api/maps', { minIntervalMs: 0 })
  ctx.log(`${maps.length} mapas`)

  // Una meta aparece en varios mapas: se acumulan todos antes de guardar,
  // porque el conjunto de mapas indica su nivel (básico → experto).
  const byId = new Map()
  let ok = 0
  let metas = 0
  for (const m of maps) {
    let data
    try {
      const json = await fetchJson(ctx, `https://learnablemeta.com/maps/${m.geoguessrId}/__data.json`, {
        minIntervalMs: 1100,
        accept404: true,
      })
      data = json ? pageData(json) : null
    } catch (e) {
      ctx.warn(`${m.name}: ${e.message}`)
      continue
    }
    const list = data?.metaList ?? []
    for (const item of list) {
      if (!item?.id) continue
      metas++
      const entry = byId.get(item.id)
      if (entry) {
        entry.maps.push(m)
        continue
      }
      byId.set(item.id, { item, maps: [m] })
    }
    ok++
    if (ok % 50 === 0) ctx.log(`${ok}/${maps.length} mapas`)
  }

  for (const { item, maps: inMaps } of byId.values()) {
    const first = inMaps[0]
    const split = splitName(item.name ?? '', ctx.resolver)
    const upstream = (item.footer ?? '').match(/href="(https?:\/\/[^"]+)"/)?.[1] ?? null
    let country = split.country ?? countryFromUpstream(upstream)
    for (const m of inMaps) country ??= countryFromMapName(m.name ?? '', ctx.resolver)
    // en mapas de subdivisiones ("ALM - Nigeria States") el nombre de la
    // meta ES la región: "Jigawa State"
    const regionalMap = inMaps.find((m) => REGIONAL_MAP.test(m.name ?? ''))
    sink.add({
      key: String(item.id),
      url: `https://learnablemeta.com/maps/${first.geoguessrId}`,
      country: country ?? undefined,
      region: regionalMap ? split.label : undefined,
      category: regionalMap ? { category: 'regions' } : undefined,
      label: split.label,
      title: item.name,
      text: htmlToText(item.note ?? ''),
      images: (item.images ?? []).filter((x) => typeof x === 'string'),
      extra: {
        map: first.name,
        maps: inMaps.map((m) => ({ id: m.geoguessrId, name: m.name })),
        level: Math.min(...inMaps.map((m) => mapLevel(m.name ?? ''))),
        regions: [...new Set(inMaps.flatMap((m) => m.regions ?? []))],
        locations: Number(item.locationsCount) || null,
        upstream,
      },
    })
  }
  return { maps: ok, metasRead: metas, unique: byId.size }
}

/**
 * Nivel de una meta según el mapa donde aparece (se usa el menor):
 *   1 imprescindible: mapas mundiales Basics/Beginner
 *   2 común:          mapas mundiales o continentales generales
 *   3 país:           mapas de un país
 *   4 experto:        subdivisiones, ciudades, flora y otros temas de nicho
 */
export function mapLevel(name) {
  const continental = /\b(world|europe|asia|africa|america|americas|oceania|identify every country)\b/i.test(name)
  const niche = REGIONAL_MAP.test(name) || /\b(cities|kabupaten|plants?|satellite|region ?guess|rmrg|landscapes?)\b/i.test(name)
  if (continental && /\b(basics?|beginners?)\b/i.test(name)) return 1
  if (niche) return 4
  if (continental) return 2
  return 3
}
