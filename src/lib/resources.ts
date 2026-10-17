import { useJson } from './data'

// Guías externas: enlaces a documentos, mapas e infografías de la comunidad, por país
// (pipeline/resources.mjs, de la Regionguessing Meta Library). Solo enlaces: se abren en su sitio.

export type ResourceKind = 'doc' | 'slides' | 'map' | 'mapjson' | 'infographic' | 'video' | 'sheet' | 'post' | 'list' | 'other'
export type ExternalGuide = {
  t: string
  u: string
  a?: string
  k: ResourceKind
  m?: number
  d?: string
  lv?: 'basic' | 'all' | 'advanced'
  use?: 'new' | 'some' | 'niche' | 'old' | 'repeat'
  start?: boolean
  dc?: boolean
  parts?: { t: string; u: string }[]
}
export type ResourcesFile = {
  generatedAt: string
  library: { name: string; author: string; url: string }
  general: { t: string; u: string; d: string }[]
  countries: Record<string, { continent: string; items: ExternalGuide[]; areaCodes?: string }>
}

export const useResources = () => useJson<ResourcesFile>('/community/resources.json')

export const KIND_LABEL: Record<ResourceKind, string> = {
  doc: 'Documento', slides: 'Presentación', map: 'Mapa', mapjson: 'Mapa para jugar', infographic: 'Infografía',
  video: 'Vídeo', sheet: 'Hoja de cálculo', post: 'Publicación', list: 'Lista', other: 'Otro',
}
export const LEVEL_LABEL = { basic: 'Para empezar', all: 'Para todos', advanced: 'Avanzado' } as const
export const USE_LABEL = { new: 'Mucho nuevo', some: 'Algo nuevo', niche: 'Muy específico', old: 'Desactualizado', repeat: 'Repite lo anterior' } as const
export const USE_HINT = {
  new: 'Trae muchas pistas que no están en los de arriba',
  some: 'Trae algunas pistas nuevas que vale la pena saber',
  niche: 'Información muy de nicho',
  old: 'Poco útil o anticuado por la cobertura nueva',
  repeat: 'Casi todo está en los de arriba; a veces lo explica mejor',
} as const
