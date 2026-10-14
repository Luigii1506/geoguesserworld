import type { Clue } from '../types'
import { CLUES_LINEAS } from './lineas-viales'
import { CLUES_BOLARDOS } from './bolardos'
import { CLUES_SENALES } from './senales'
import { CLUES_MATRICULAS } from './matriculas'
import { CLUES_CIRCULACION } from './circulacion'
import { CLUES_POSTES } from './postes'
import { CLUES_IDIOMA } from './idioma'
import { CLUES_TOPONIMIA } from './toponimia'
import { CLUES_ARQUITECTURA } from './arquitectura'
import { CLUES_PAISAJE } from './paisaje'
import { CLUES_CLIMA } from './clima-sol'
import { CLUES_CULTURA } from './cultura'
import { CLUES_META } from './meta'
import { CLUES_EXTRA } from './estepa-girasol'
import { CLUES_MOBILIARIO } from './mobiliario'

export const CLUES: Clue[] = [
  ...CLUES_LINEAS,
  ...CLUES_BOLARDOS,
  ...CLUES_SENALES,
  ...CLUES_MATRICULAS,
  ...CLUES_CIRCULACION,
  ...CLUES_POSTES,
  ...CLUES_IDIOMA,
  ...CLUES_TOPONIMIA,
  ...CLUES_ARQUITECTURA,
  ...CLUES_PAISAJE,
  ...CLUES_CLIMA,
  ...CLUES_CULTURA,
  ...CLUES_META,
  ...CLUES_EXTRA,
  ...CLUES_MOBILIARIO,
]

export const CLUE_MAP = new Map(CLUES.map((c) => [c.id, c]))

// Validación en desarrollo: avisa de enlaces `related` rotos para mantener
// el grafo de fichas consistente al añadir contenido.
if (import.meta.env.DEV) {
  for (const clue of CLUES) {
    for (const rel of clue.related ?? []) {
      if (!CLUE_MAP.has(rel)) {
        console.warn(`[GeoMastery] Ficha "${clue.id}" enlaza a id inexistente "${rel}"`)
      }
    }
  }
  const ids = new Set<string>()
  for (const clue of CLUES) {
    if (ids.has(clue.id)) console.warn(`[GeoMastery] Id de ficha duplicado: "${clue.id}"`)
    ids.add(clue.id)
  }
}

export function cluesByCategory(categoryId: string): Clue[] {
  return CLUES.filter((c) => c.category === categoryId)
}

export function cluesByCountry(code: string): Clue[] {
  return CLUES.filter((c) => c.countries.includes(code))
}
