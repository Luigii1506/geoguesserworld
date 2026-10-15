import type { Cluster, Hint } from '../data'
import type { GeoCard } from '../geo'
import { KIND_LABEL } from '../geo'
import type { VisualItem } from '../guides'
import { hintText, type Lang } from '../i18n'
import { itemKey, type NewItem } from './store'

// De lo que se ve en la app a algo guardable (con la copia mínima para poder preguntarlo).

/** Una pista de la guía de un país (un grupo de pistas equivalentes de varias fuentes). */
export function hintItem(cluster: Cluster, hints: Map<number, Hint>, lang: Lang, cc: string, catName?: (id: string) => string): NewItem | null {
  const canonical = hints.get(cluster.canonical_id)
  if (!canonical) return null
  const text = hintText(canonical, lang).trim()
  const img = cluster.images?.[0] ?? cluster.members.map((id) => hints.get(id)).find((h) => h?.images.length)?.images[0]
  if (!text && !img) return null
  return {
    key: itemKey.hint(cluster.id),
    kind: 'hint',
    cc,
    data: {
      text: text.slice(0, 1200), lang, cat: cluster.category, catName: catName?.(cluster.category),
      sub: cluster.subcategory ?? undefined, region: cluster.region ?? undefined, u: cluster.usefulness ?? undefined, img,
    },
  }
}

/** Una foto del explorador (bolardo, poste, matrícula…). */
export function photoItem(p: VisualItem, catName?: (id: string) => string): NewItem {
  return {
    key: itemKey.photo(p.i),
    kind: 'photo',
    cc: p.c,
    data: { img: p.i, cat: p.k, catName: catName?.(p.k), sub: p.sk, text: p.t ? p.t.slice(0, 600) : undefined },
  }
}

/** Un lugar de la base geográfica (volcán, ciudad, lago…). */
export function placeItem(c: Pick<GeoCard, 'id' | 'kind' | 'name' | 'cc' | 'lat' | 'lng' | 'thumb' | 'descr'> & { bbox?: [number, number, number, number] | null }): NewItem {
  return {
    key: itemKey.place(c.id),
    kind: 'place',
    cc: c.cc ?? null,
    data: {
      id: c.id, name: c.name, kind: c.kind, kindLabel: KIND_LABEL[c.kind], lat: c.lat, lng: c.lng,
      bbox: c.bbox ?? undefined, thumb: c.thumb, descr: c.descr?.slice(0, 300),
    },
  }
}
