import { useEffect, useState } from 'react'

// Acceso a la base de conocimiento exportada por el pipeline
// (public/community/, fuera de git). Cada archivo se pide una sola vez.

export interface CountryRow {
  code: string
  name: string
  name_es: string | null
  flag: string | null
  region: string | null
  subregion: string | null
  mask: string[]
  capital: string | null
  population: number | null
  driving_side: 'left' | 'right' | null
  languages: string[]
  currencies: { code: string; name: string; symbol?: string }[]
  calling_codes: string[]
  tlds: string[]
  lat: number | null
  lng: number | null
  /** código numérico ISO 3166 (identifica el país en el mapa mundial) */
  ccn3?: string | null
  area?: number | null
  groups: number
  essential: number
  regional: number
  confirmed: number
  objects: number
  confusable: string[]
  summary_image: string | null
}

export interface Category {
  id: string
  name: string
  grp: string
}

export interface MetaFile {
  generatedAt: string
  categories: Category[]
  sources: { id: string; name: string; homepage: string; license: string; method: string }[]
  totals: { hints: number; images: number; groups: number; essential: number; countries: number }
}

export interface Cluster {
  id: number
  region: string | null
  category: string
  subcategory: string | null
  canonical_id: number
  size: number
  sources: string[]
  source_count: number
  level: number | null
  maps: number | null
  usefulness: number | null
  reviewed: number
  members: number[]
  /** imágenes del grupo sin copias entre fuentes (calculadas en la exportación) */
  images?: string[]
}

export interface Hint {
  id: number
  source_id: string
  region: string | null
  category: string
  subcategory: string | null
  source_label: string | null
  title: string | null
  text: string | null
  text_es?: string | null
  text_en?: string | null
  location_url: string | null
  url: string | null
  images: string[]
  /** enlaces a ejemplos que la fuente incluye dentro del texto */
  links?: { text: string; url: string }[]
  /** vista de Street View del ejemplo (panorámica, ángulo, inclinación y campo de visión) */
  sv?: { p: string | null; lat: number; lng: number; h: number; t: number; f: number }
  /** lugares que menciona, con coordenadas y su entidad de la base geográfica (id) */
  places?: { id?: string; n: string; es?: string; lat: number; lng: number; k?: string; cc?: string }[]
}

export interface Resource {
  source_id: string
  url: string
  title: string | null
  author: string | null
  note: string | null
  kind: 'practice_map' | 'community_doc' | 'other'
}

export interface CountryFile {
  country: Record<string, unknown>
  /** infografía resumen de Plonk It: bandera, dominio, cámaras, lado de circulación… */
  summaryImage: string | null
  clusters: Cluster[]
  hints: Hint[]
  attributes: { source_id: string; attribute: string; value: string; detail?: Record<string, unknown> }[]
  resources: Resource[]
}

export interface MetaObject {
  id: number
  country: string
  type: string
  variant: 'main' | 'regional' | 'special' | 'old'
  region: string | null
  attrs: Record<string, string>
  features: string[]
  hints: number[]
  /** foto de ejemplo (primera imagen de sus pistas) */
  img?: string | null
  alsoIn: string[]
  confusedWith: { country: string; difference: string | null }[]
  sameDesign: { country: string; shared: number; total: number }[]
}

export interface Trait {
  type: string
  key: string
  value: string
  n: number
  countries: string[]
}

export interface MetaObjectsFile {
  generatedAt: string
  objects: MetaObject[]
  traits: Trait[]
}

export interface QuizText {
  id: number
  c: string
  k: string
  sk?: string
  r?: string
  u: number
  n: number
  es: string
  en: string
  i?: string
}

export interface QuizPhoto {
  id: number
  c: string
  k: string
  sk?: string
  i: string
}

export interface QuizFile {
  texts: QuizText[]
  photos: QuizPhoto[]
}

const cache = new Map<string, Promise<unknown>>()

export function loadJson<T>(url: string): Promise<T | null> {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url)
        .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
        .catch(() => null),
    )
  }
  return cache.get(url) as Promise<T | null>
}

/** undefined = cargando · null = no existe (falta ejecutar el pipeline) */
export function useJson<T>(url: string | null): T | null | undefined {
  const [data, setData] = useState<T | null | undefined>(undefined)
  useEffect(() => {
    if (!url) return
    let alive = true
    setData(undefined)
    loadJson<T>(url).then((d) => {
      if (alive) setData(d)
    })
    return () => {
      alive = false
    }
  }, [url])
  return data
}

export const useCountries = () => useJson<CountryRow[]>('/community/countries.json')
export const useMeta = () => useJson<MetaFile>('/community/meta.json')
export const useCountryFile = (cc: string | undefined) => useJson<CountryFile>(cc ? `/community/country/${cc}.json` : null)
export const useMetaObjects = () => useJson<MetaObjectsFile>('/community/meta-objects.json')
export const useQuiz = () => useJson<QuizFile>('/community/quiz.json')

/** Mapa código → país, para nombres y banderas. */
export function useCountryMap(): Map<string, CountryRow> {
  const countries = useCountries()
  const [map, setMap] = useState<Map<string, CountryRow>>(new Map())
  useEffect(() => {
    if (countries) setMap(new Map(countries.map((c) => [c.code, c])))
  }, [countries])
  return map
}

export const countryLabel = (map: Map<string, CountryRow>, code: string | null | undefined) =>
  code ? map.get(code)?.name_es ?? map.get(code)?.name ?? code.toUpperCase() : '—'

export const countryFlag = (map: Map<string, CountryRow>, code: string | null | undefined) =>
  code ? map.get(code)?.flag ?? '🏳️' : '🌐'

/** Capa de mapa temático: un rasgo de la meta y su valor en cada país. */
export interface MapLayer {
  id: string
  group: string
  title: string
  question: string
  kind: 'color' | 'cat'
  multi?: boolean
  source?: string
  values: { v: string; n: number; label?: string; color?: string }[]
  data: Record<string, string[]>
  total: number
}
export const useMaps = () => useJson<{ generatedAt: string; layers: MapLayer[] }>('/community/maps.json')
