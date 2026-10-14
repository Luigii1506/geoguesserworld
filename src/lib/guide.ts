// Lógica común de la guía de un país (portada, página de tema y explorador):
// carga los datos, ordena por importancia y agrupa las pistas por tema.

import { useMemo } from 'react'
import { type Cluster, type Hint, type MetaObject, useCountryFile, useCountryMap, useMeta, useMetaObjects } from './data'
import { OBJECT_CATEGORY, SUBCATEGORY_LABEL } from './labels'

// Orden de los temas: primero la meta que más decide (coche, bolardos, líneas…).
export const TOPIC_ORDER = [
  'google_car', 'camera', 'coverage', 'bollards', 'road_lines', 'plates', 'poles', 'signs', 'guardrails',
  'road_numbering', 'milestones', 'road_surface', 'language', 'naming', 'phone', 'architecture',
  'street_furniture', 'vehicles', 'culture', 'landscape', 'landmarks', 'sun', 'general', 'regions',
  'driving_side', 'domain', 'flag', 'currency', 'other',
]
const ATTR_TOPIC: Record<string, { cat: string; title: string }> = {
  cameraGens: { cat: 'camera', title: 'Generaciones de cámara' },
  years: { cat: 'coverage', title: 'Años de cobertura' },
  snow: { cat: 'coverage', title: 'Nieve en la cobertura' },
}

/** Capa del mapa mundial que corresponde a cada tema (para "verlo en el mapa"). */
export const TOPIC_MAP_LAYER: Record<string, string> = {
  bollards: 'bollard_body', road_lines: 'lines', plates: 'plate_rear', signs: 'chevron', poles: 'pole_material',
  google_car: 'car_color', camera: 'camera', coverage: 'first', language: 'script', driving_side: 'driving',
}

/** Valor del filtro de región que significa "pistas de todo el país". */
export const NATIONAL = '_pais'

// a igual utilidad, lo que vale para todo el país va antes que lo regional
export const byImportance = (a: Cluster, b: Cluster) =>
  (b.usefulness ?? 0) - (a.usefulness ?? 0) || (a.region ? 1 : 0) - (b.region ? 1 : 0) ||
  b.source_count - a.source_count || b.size - a.size

export type Tile = { image: string; caption?: string | null }
export type Part = { sub: string | null; hints: Cluster[]; minor: Cluster[]; tiles: Tile[] }
export type Topic = {
  cat: string
  parts: Part[]
  objects: MetaObject[]
  facts: [string, string[]][]
  /** pistas y fotos del tema */
  n: number
  essential: number
  cover: string | null
}

const rank = (cat: string) => TOPIC_ORDER.indexOf(cat) + 1 || 99

export function useGuide(code: string | undefined) {
  const file = useCountryFile(code)
  const map = useCountryMap()
  const meta = useMeta()
  const objectsFile = useMetaObjects()

  const country = code ? map.get(code) : undefined
  const catName = (id: string) => meta?.categories.find((c) => c.id === id)?.name ?? id

  const hints = useMemo(() => new Map((file?.hints ?? []).map((h) => [h.id, h])), [file])
  const traitCount = useMemo(() => {
    const m = new Map((objectsFile?.traits ?? []).map((t) => [`${t.type}|${t.key}|${t.value}`, t.n]))
    return (type: string, key: string, value: string) => m.get(`${type}|${key}|${value}`)
  }, [objectsFile])
  const objects = useMemo(() => (objectsFile?.objects ?? []).filter((o) => o.country === code), [objectsFile, code])

  const textOf = (c: Cluster) => (hints.get(c.canonical_id)?.text ?? '').trim()
  const imagesOf = (c: Cluster) => (c.images ?? hints.get(c.canonical_id)?.images ?? []).filter((u) => u !== file?.summaryImage)
  // foto con nombre de GeoHints (marca, variante): se muestra como foto con pie, no como texto
  const isTile = (c: Cluster) => {
    const h = hints.get(c.canonical_id)
    if (!h || !imagesOf(c).length) return false
    return !textOf(c) || (c.size === 1 && h.source_id === 'geohints' && textOf(c).length < 60)
  }

  /** Agrupa clusters en temas y subtemas (con objetos y datos si se piden). */
  const buildTopics = (clusters: Cluster[], withExtras = true): Topic[] => {
    const topics = new Map<string, Topic>()
    const topic = (cat: string) => {
      if (!topics.has(cat)) topics.set(cat, { cat, parts: [], objects: [], facts: [], n: 0, essential: 0, cover: null })
      return topics.get(cat)!
    }
    const part = (cat: string, sub: string | null) => {
      const t = topic(cat)
      let p = t.parts.find((x) => x.sub === sub)
      if (!p) t.parts.push((p = { sub, hints: [], minor: [], tiles: [] }))
      return p
    }
    for (const c of clusters) {
      const sub = c.subcategory && SUBCATEGORY_LABEL[c.subcategory] ? c.subcategory : null
      const t = topic(c.category)
      if (isTile(c)) {
        const h = hints.get(c.canonical_id)!
        const caption = textOf(c) ? h.title ?? textOf(c) : null
        const imgs = imagesOf(c)
        part(c.category, sub).tiles.push(...imgs.map((image) => ({ image, caption })))
        t.n++
        t.cover ??= imgs[0] ?? null
        continue
      }
      if (!textOf(c)) continue
      const p = part(c.category, sub)
      ;(c.usefulness === 1 ? p.minor : p.hints).push(c)
      t.n++
      if (c.usefulness === 3) t.essential++
    }
    if (withExtras) {
      for (const o of objects) topic(OBJECT_CATEGORY[o.type] ?? 'other').objects.push(o)
      const facts = new Map<string, Set<string>>()
      for (const a of file?.attributes ?? []) {
        if (!ATTR_TOPIC[a.attribute]) continue
        if (!facts.has(a.attribute)) facts.set(a.attribute, new Set())
        facts.get(a.attribute)!.add(a.value)
      }
      for (const [k, vals] of facts) topic(ATTR_TOPIC[k].cat).facts.push([ATTR_TOPIC[k].title, [...vals].sort()])
    }
    for (const t of topics.values()) {
      t.objects.sort((a, b) => (a.variant === 'main' ? 0 : 1) - (b.variant === 'main' ? 0 : 1) || a.type.localeCompare(b.type))
      for (const p of t.parts) {
        p.hints.sort(byImportance)
        p.minor.sort(byImportance)
      }
      // portada del tema: la foto de su pista más importante
      t.cover = t.parts.flatMap((p) => p.hints).map(imagesOf).find((i) => i.length)?.[0] ?? t.cover
      const size = (p: Part) => p.hints.length + p.minor.length + p.tiles.length / 4
      t.parts.sort((a, b) => (a.sub ? 1 : 0) - (b.sub ? 1 : 0) || size(b) - size(a))
    }
    return [...topics.values()].filter((t) => t.n || t.objects.length || t.facts.length).sort((a, b) => rank(a.cat) - rank(b.cat))
  }

  const derived = useMemo(() => {
    const all = (file?.clusters ?? []).filter((c) => textOf(c) || imagesOf(c).length)
    const text = all.filter((c) => textOf(c)).sort(byImportance)
    const regions = new Map<string, Cluster[]>()
    for (const c of text) {
      if (!c.region) continue
      if (!regions.has(c.region)) regions.set(c.region, [])
      regions.get(c.region)!.push(c)
    }
    return {
      all,
      text,
      topics: buildTopics(all),
      regions: [...regions.entries()].sort((a, b) => b[1].length - a[1].length),
    }
    // buildTopics/textOf dependen de hints, objects y file
  }, [file, hints, objects]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    loading: file === undefined || !map.size,
    missing: file === null || (map.size > 0 && !country),
    file,
    map,
    meta,
    country,
    hints,
    objects,
    catName,
    traitCount,
    textOf,
    imagesOf,
    isTile,
    buildTopics,
    ...derived,
  }
}

export type Guide = ReturnType<typeof useGuide>

/** Pistas que reconocen el país: determinantes de todo el país, una por tema primero, con foto si la hay. */
export function recognise(g: Guide, max = 8): Cluster[] {
  const national = g.text.filter((c) => !c.region && !g.isTile(c))
  const pick = (pool: Cluster[], out: Cluster[]) => {
    const byTopic = new Map<string, Cluster[]>()
    for (const c of pool) {
      if (out.includes(c)) continue
      if (!byTopic.has(c.category)) byTopic.set(c.category, [])
      byTopic.get(c.category)!.push(c)
    }
    // ronda: lo mejor de cada tema (con foto antes), en el orden de importancia de los temas
    const cats = [...byTopic.keys()].sort((a, b) => rank(a) - rank(b))
    for (let round = 0; out.length < max && cats.some((k) => byTopic.get(k)!.length); round++) {
      for (const k of cats) {
        const list = byTopic.get(k)!
        if (!list.length || out.length >= max) continue
        const withImg = list.findIndex((c) => g.imagesOf(c).length)
        out.push(list.splice(withImg >= 0 ? withImg : 0, 1)[0])
      }
      if (round > 3) break
    }
  }
  // primero la meta (coche, carretera, señales, matrículas, postes, idioma…); paisaje,
  // cultura o arquitectura suelen ser regionales aunque la fuente no lo diga
  const isMeta = (c: Cluster) => rank(c.category) <= TOPIC_ORDER.indexOf('phone') + 1
  const out: Cluster[] = []
  pick(national.filter((c) => c.usefulness === 3 && isMeta(c)), out)
  if (out.length < max) pick(national.filter((c) => c.usefulness === 2 && isMeta(c) && g.imagesOf(c).length), out)
  if (out.length < Math.min(6, max)) pick(national.filter((c) => c.usefulness === 3), out)
  return out
}

/** Una línea de texto para tarjetas: la primera frase, sin viñetas ni notas. */
export function firstSentence(text: string, max = 170): string {
  const clean = text.split(/\s*-{2,}\s*(?:NOTE|NOTA)\s*:?|\n\s*(?:NOTE|NOTA)\s*:/i)[0].replace(/^[\s•▪●◦·*–-]+/gm, '').replace(/\s+/g, ' ').trim()
  // fin de frase: punto seguido de espacio, salvo abreviaturas (EE. UU., St., etc., p. ej.)
  let s = clean
  const re = /[.!?](?=\s+\S|$)/g
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    const word = clean.slice(0, m.index).split(/\s/).pop() ?? ''
    if (m.index < 20 || /^(EE|UU|St|Sr|Dr|Av|etc|p|ej|aprox|km|No|vs|Mt|Ft|Hwy|Rd|Blvd|[A-Z])$/.test(word)) continue
    s = clean.slice(0, m.index + 1)
    break
  }
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}

export type { Hint }
