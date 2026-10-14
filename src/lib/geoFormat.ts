import type { CardFacts, GeoCard, GeoEntity } from './geo'
import { KIND_LABEL, KIND_PLURAL } from './geo'

// Cómo se muestran los datos geográficos: unidades, etiquetas, órdenes y
// filtros por etiqueta. Un solo sitio para la galería, el ranking y la ficha.

export const nf = (n: number) => n.toLocaleString('es')
export const popText = (p: number) =>
  p >= 1e6 ? `${(p / 1e6).toLocaleString('es', { maximumFractionDigits: 1 })} M hab.` : `${nf(Math.round(p / 1000) * 1000)} hab.`
const year = (v: number) => (v < 0 ? `${nf(-v)} a. C.` : `${v}`)

export const kindLabel = (k: string) => KIND_LABEL[k] ?? 'Lugar'
/** "3 volcanes", "1 volcán" */
export const kindCount = (k: string, n: number) => `${n.toLocaleString('es')} ${n === 1 ? kindLabel(k).toLowerCase() : KIND_PLURAL[k] ?? kindLabel(k).toLowerCase()}`

/** Datos numéricos: etiqueta, unidad y orden ("Más altos"…). */
export interface Metric {
  key: string
  label: string
  sortLabel: string
  format: (v: number) => string
}
export const METRICS: Metric[] = [
  { key: 'elevation', label: 'Altitud', sortLabel: 'Más altos', format: (v) => `${nf(Math.round(v))} m` },
  { key: 'prominence', label: 'Prominencia', sortLabel: 'Más prominentes', format: (v) => `${nf(Math.round(v))} m` },
  { key: 'length', label: 'Longitud', sortLabel: 'Más largos', format: (v) => `${nf(Math.round(v))} km` },
  { key: 'discharge', label: 'Caudal', sortLabel: 'Más caudal', format: (v) => `${nf(Math.round(v))} m³/s` },
  { key: 'basin', label: 'Cuenca', sortLabel: 'Mayor cuenca', format: (v) => `${nf(Math.round(v))} km²` },
  { key: 'countries', label: 'Países', sortLabel: 'Cruzan más países', format: (v) => `${v} países` },
  { key: 'area', label: 'Superficie', sortLabel: 'Más extensos', format: (v) => `${nf(Math.round(v))} km²` },
  { key: 'depth', label: 'Profundidad', sortLabel: 'Más profundos', format: (v) => `${nf(Math.round(v))} m` },
  { key: 'population', label: 'Población', sortLabel: 'Más poblados', format: popText },
  { key: 'visitors', label: 'Visitantes al año', sortLabel: 'Más visitados', format: (v) => nf(v) },
  { key: 'last_eruption', label: 'Última erupción', sortLabel: 'Erupción más reciente', format: year },
]
export const METRIC = new Map(METRICS.map((m) => [m.key, m]))

/** Órdenes: los de entidad (rank, hints, name) y uno por dato. */
export interface SortOption {
  id: string
  label: string
  format?: (v: number) => string
}
export const SORTS: SortOption[] = [
  { id: 'rank', label: 'Más conocidos' },
  ...METRICS.map((m) => ({ id: m.key, label: m.sortLabel, format: m.format })),
  { id: 'hints', label: 'Más en las pistas', format: (v) => `${v} ${v === 1 ? 'pista' : 'pistas'}` },
  { id: 'name', label: 'A–Z' },
]
export const SORT = new Map(SORTS.map((s) => [s.id, s]))
// órdenes con sentido en cada familia (geo/kinds.json)
export const SORTS_FOR: Record<string, string[]> = {
  ciudades: ['rank', 'population', 'area', 'elevation', 'hints', 'name'],
  montanas: ['rank', 'elevation', 'prominence', 'last_eruption', 'hints', 'name'],
  agua: ['rank', 'length', 'discharge', 'basin', 'countries', 'area', 'depth', 'hints', 'name'],
  relieve: ['rank', 'area', 'elevation', 'name'],
  islas: ['rank', 'area', 'population', 'elevation', 'hints', 'name'],
  naturaleza: ['rank', 'area', 'visitors', 'hints', 'name'],
  monumentos: ['rank', 'visitors', 'hints', 'name'],
  templos: ['rank', 'visitors', 'hints', 'name'],
  arqueologia: ['rank', 'visitors', 'area', 'hints', 'name'],
  regiones: ['rank', 'population', 'area', 'name'],
}

/** El dato que mejor resume un lugar en una tarjeta. */
export function factLine(kind: string, f?: CardFacts): string | null {
  if (!f) return null
  if (f.elevation && ['volcano', 'mountain', 'range'].includes(kind)) return METRIC.get('elevation')!.format(f.elevation)
  if (f.length && kind === 'river') return METRIC.get('length')!.format(f.length)
  if (f.population && ['city', 'town', 'urban', 'admin1', 'country', 'region'].includes(kind)) return popText(f.population)
  if (f.area && ['lake', 'island', 'desert', 'plain', 'plateau', 'basin'].includes(kind)) return METRIC.get('area')!.format(f.area)
  return null
}

// ── filtros por etiqueta (entity_tag): un grupo = una elección ──
export interface TagGroup {
  id: string
  label: string
  kinds: string[]
  tags: { tag: string; label: string; help?: string }[]
}
export const TAG_GROUPS: TagGroup[] = [
  {
    id: 'estado', label: 'Estado', kinds: ['volcano'],
    tags: [
      { tag: 'activo', label: 'Activo', help: 'Ha entrado en erupción desde 1900' },
      { tag: 'reciente', label: 'Erupción reciente', help: 'Última erupción entre 1500 y 1899' },
      { tag: 'dormido', label: 'Dormido', help: 'Actividad en los últimos ~12.000 años, sin erupción registrada reciente' },
      { tag: 'extinto', label: 'Extinto', help: 'Sin actividad en los últimos ~12.000 años' },
    ],
  },
  {
    id: 'vtipo', label: 'Tipo', kinds: ['volcano'],
    tags: [
      { tag: 'estratovolcan', label: 'Estratovolcán' }, { tag: 'escudo', label: 'Volcán en escudo' },
      { tag: 'caldera', label: 'Caldera' }, { tag: 'domo', label: 'Domo de lava' }, { tag: 'campo', label: 'Campo volcánico' },
      { tag: 'cono', label: 'Cono, maar o cráter' }, { tag: 'fisura', label: 'Fisura' }, { tag: 'complejo', label: 'Complejo volcánico' },
      { tag: 'submarino', label: 'Submarino' },
    ],
  },
]
export const TAG_LABEL = new Map(TAG_GROUPS.flatMap((g) => g.tags.map((t) => [t.tag, t.label] as const)))
export const VOLCANO_STATUS = new Set(['activo', 'reciente', 'dormido', 'extinto'])

/** Etiqueta de estado de un volcán (si la tiene). */
export const volcanoStatus = (c: Pick<GeoCard, 'tags'>) => c.tags?.find((t) => VOLCANO_STATUS.has(t))

/** Datos de una ficha como pares [etiqueta, valor] para mostrar. */
export function entityMetrics(e: GeoEntity): [string, string][] {
  const out: [string, string][] = []
  const status = volcanoStatus(e)
  if (status) out.push(['Estado', TAG_LABEL.get(status)!])
  const shape = e.tags?.find((t) => TAG_GROUPS[1].tags.some((x) => x.tag === t))
  if (shape) out.push(['Tipo', TAG_LABEL.get(shape)!])
  for (const m of METRICS) {
    const facts = e.facts.filter((f) => f.key === m.key && typeof f.value === 'number')
    if (!facts.length) continue
    if (m.key === 'population') {
      // cada ámbito por separado: municipio, área urbana, zona metropolitana
      for (const f of facts) out.push([POP_SCOPE_LABEL[f.scope ?? ''] ?? 'Población', `${nf(f.value as number)}${f.year ? ` (${f.year})` : ''}`])
    } else out.push([m.label, m.format(Math.max(...facts.map((f) => f.value as number)))])
  }
  return out
}
export const POP_SCOPE_LABEL: Record<string, string> = {
  city: 'Población (ciudad)',
  urban: 'Población (área urbana)',
  metro: 'Población (zona metropolitana)',
  admin: 'Población',
}
