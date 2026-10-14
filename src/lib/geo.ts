import { useEffect, useState } from 'react'
import KINDS from '../../geo/kinds.json'

// Cliente de la API de geografía (/api/geo/…, ver docs/geo.md).
//   · `npm run dev`: la sirve Vite sobre data/geo.db (mismo origen)
//   · build: el Worker sobre D1 (VITE_API_BASE o, si no, VITE_IMAGE_BASE), con la clave VITE_IMAGE_KEY
// Las capas de terreno (/atlas/…) siguen el mismo camino.

const env = import.meta.env
const BASE = ((env.VITE_API_BASE as string | undefined) ?? (env.DEV ? '' : (env.VITE_IMAGE_BASE as string | undefined)) ?? '').replace(/\/+$/, '')
const KEY = env.VITE_IMAGE_KEY as string | undefined

export type Kind = keyof typeof KINDS.kinds
export type Family = (typeof KINDS.families)[number]
export const FAMILIES: Family[] = KINDS.families
export const KIND_LABEL: Record<string, string> = KINDS.kinds
export const KIND_PLURAL: Record<string, string> = KINDS.plural
export const FAMILY_OF = new Map<string, string>(FAMILIES.flatMap((f) => f.kinds.map((k) => [k, f.id] as const)))

/** Datos de tarjeta (los que existan). */
export interface CardFacts {
  population?: number
  population_scope?: string
  elevation?: number
  length?: number
  area?: number
  discharge?: number
  basin?: number
  prominence?: number
  depth?: number
  visitors?: number
  last_eruption?: number
  countries?: number
  volcano_status?: string
  volcano_type?: string
}

export interface GeoCard {
  id: string
  kind: string
  name: string
  name_en?: string
  cc?: string
  ccs?: string[]
  admin1?: string
  lat: number
  lng: number
  thumb?: string
  descr?: string
  fame: number
  rank: number
  hints: number
  tags?: string[]
  facts?: CardFacts
  /** valor del dato por el que se ordenó */
  value?: number
}

export interface GeoFact {
  key: string
  scope?: string
  value: number | string
  unit?: string
  year?: number
  source: string
}

export interface GeoEntity extends Omit<GeoCard, 'facts' | 'value'> {
  bbox?: [number, number, number, number]
  image?: string
  summary?: string
  wiki?: string
  wiki_lang?: string
  facts: GeoFact[]
  names: [string, string][]
  ids: Record<string, string>
  parents: (GeoCard & { predicate: string })[]
  children: Record<string, number>
  hintIds: { id: number; cc?: string }[]
}

export interface GeoList {
  total: number
  offset: number
  limit: number
  items: GeoCard[]
  facets?: { kinds: Record<string, number>; tags: Record<string, number>; hints: number }
}

export interface GeoCountryRow {
  cc: string
  name: string
  name_en?: string
  continent?: string
  flag?: string
  guide: boolean
  places: number
}

export interface GeoLayerAsset {
  id: string
  path: string
  bbox: [number, number, number, number]
  width: number
  height: number
}

export interface GeoCountry {
  cc: string
  name: string
  name_en?: string
  continent?: string
  flag?: string
  guide: boolean
  entity: GeoEntity
  counts: Record<string, number>
  regions: (GeoCard & { terrain?: Record<string, number> })[]
  /** su montaña o volcán más alto */
  highest?: GeoCard
  layers: GeoLayerAsset[]
}

export interface GeoLayer {
  id: string
  family: string
  name: string
  kind: 'raster' | 'vector'
  legend: { key: string; label: string; color: string }[]
  source_id: string
}

export interface GeoMeta {
  builtAt: string | null
  families: Family[]
  kinds: Record<string, string>
  totals: Record<string, number>
  sources: { id: string; name: string; url: string | null; license: string; attribution: string; version: string | null }[]
  layers: GeoLayer[]
}

/** Filtros de /list (todos opcionales). */
export interface ListQuery {
  q?: string
  kind?: string
  family?: string
  cc?: string
  continent?: string
  admin1?: string
  within?: string
  tags?: string[]
  hints?: boolean
  photo?: boolean
  sort?: string
  order?: 'asc' | 'desc'
  offset?: number
  limit?: number
  facets?: boolean
}

function withKey(path: string): string {
  if (!KEY || !BASE) return `${BASE}${path}`
  return `${BASE}${path}${path.includes('?') ? '&' : '?'}k=${encodeURIComponent(KEY)}`
}

/** URL de un archivo de capa (atlas/layers/…, atlas/vector/…). */
export const geoAssetUrl = (path: string) => withKey(`/${path.replace(/^\/+/, '')}`)

const cache = new Map<string, Promise<unknown>>()
export function geoFetch<T>(path: string): Promise<T> {
  const url = withKey(`/api/geo/${path}`)
  if (!cache.has(url)) {
    const p = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`)
      return r.json()
    })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return cache.get(url) as Promise<T>
}

export function listPath(q: ListQuery): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '' || v === false) continue
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(','))
    } else p.set(k, v === true ? '1' : String(v))
  }
  return `list?${p}`
}

export const geo = {
  meta: () => geoFetch<GeoMeta>('meta'),
  countries: () => geoFetch<{ items: GeoCountryRow[] }>('countries'),
  list: (q: ListQuery) => geoFetch<GeoList>(listPath(q)),
  search: (q: string, kind?: string[]) => geoFetch<{ items: GeoCard[] }>(`search?${new URLSearchParams({ q, ...(kind?.length ? { kind: kind.join(',') } : {}) })}`),
  entity: (id: string) => geoFetch<GeoEntity>(`entity/${encodeURIComponent(id)}`),
  country: (cc: string) => geoFetch<GeoCountry>(`country/${cc}`),
  near: (lat: number, lng: number, km = 50, kind?: string[]) =>
    geoFetch<{ items: GeoCard[] }>(`near?${new URLSearchParams({ lat: String(lat), lng: String(lng), km: String(km), ...(kind?.length ? { kind: kind.join(',') } : {}) })}`),
}

export type Loadable<T> = { data: T | undefined; error: string | null; loading: boolean }

/** Hook genérico: vuelve a pedir cuando cambia `key`; conserva el dato anterior mientras carga. */
export function useGeo<T>(key: string | null, load: () => Promise<T>): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ data: undefined, error: null, loading: !!key })
  useEffect(() => {
    if (!key) return
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    load().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (e: Error) => alive && setState((s) => ({ ...s, error: e.message, loading: false })),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}

/** Dato de una ficha por clave (y ámbito, si se pide). */
export const factOf = (e: GeoEntity, key: string, scope?: string) =>
  e.facts.find((f) => f.key === key && (scope === undefined || (f.scope ?? '') === scope))

/**
 * Lista paginada que crece al pedir más (scroll infinito). Se reinicia al
 * cambiar la consulta; la primera página trae las facetas.
 */
export function useGeoPages(query: ListQuery | null, pageSize = 36) {
  const key = query ? listPath({ ...query, offset: undefined, limit: undefined }) : null
  const [state, setState] = useState<{ key: string | null; items: GeoCard[]; total: number; facets?: GeoList['facets']; loading: boolean; error: string | null }>({
    key: null, items: [], total: 0, loading: false, error: null,
  })
  useEffect(() => {
    if (!query || !key) return
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    geo.list({ ...query, offset: 0, limit: pageSize, facets: true }).then(
      (r) => alive && setState({ key, items: r.items, total: r.total, facets: r.facets, loading: false, error: null }),
      (e: Error) => alive && setState((s) => ({ ...s, loading: false, error: e.message })),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pageSize])
  const more = () => {
    if (!query || state.loading || state.items.length >= state.total || state.key !== key) return
    setState((s) => ({ ...s, loading: true }))
    geo.list({ ...query, offset: state.items.length, limit: pageSize }).then(
      (r) => setState((s) => (s.key === key ? { ...s, items: [...s.items, ...r.items], loading: false } : s)),
      (e: Error) => setState((s) => ({ ...s, loading: false, error: e.message })),
    )
  }
  return { ...state, stale: state.key !== key, more, done: state.items.length >= state.total }
}
