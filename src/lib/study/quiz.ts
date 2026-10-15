import type { CountryRow } from '../data'

// Piezas comunes de las preguntas "¿de qué país es?" (Entrenar y Mi estudio).

export const shuffle = <T,>(a: T[]): T[] => {
  const x = [...a]
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

/**
 * Oculta nombre, capital y gentilicios del país para no regalar la respuesta.
 * Los términos de 4+ letras también tapan las palabras que empiezan por ellos:
 * así "Slovenia" cubre "Slovenian" e "Iceland" cubre "Icelandic", variantes
 * que los datasets de gentilicios no traen.
 */
export function maskText(text: string, terms: string[]) {
  let out = text
  for (const t of [...terms].sort((a, b) => b.length - a.length)) {
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const tail = t.length >= 4 ? '\\p{L}*' : ''
    out = out.replace(new RegExp(`(?<![\\p{L}])${esc}${tail}(?![\\p{L}])`, 'giu'), '▢▢▢')
  }
  return out
}

// Para que una opción sea plausible el país debe tener datos suficientes:
// así no aparecen territorios diminutos como distractor.
const MIN_GROUPS = 25

/**
 * Distractores en orden de parecido: primero los países con los que tú lo has confundido
 * (si los hay), luego los 2 más confundibles según las guías (de los 3 más fuertes), la
 * misma subregión, la misma región y, en último caso, cualquiera.
 */
export function pickDistractors(correct: string, pool: Set<string>, map: Map<string, CountryRow>, mine: string[] = []): string[] {
  const c = map.get(correct)
  const ok = (x: string) => pool.has(x) && (map.get(x)?.groups ?? 0) >= MIN_GROUPS
  const chosen: string[] = []
  const add = (code: string) => {
    if (code !== correct && ok(code) && !chosen.includes(code) && chosen.length < 3) chosen.push(code)
  }
  mine.slice(0, 2).forEach(add)
  const strong = (c?.confusable ?? []).filter(ok)
  shuffle(strong.slice(0, 3)).slice(0, 2).forEach(add)
  shuffle([...pool].filter((x) => map.get(x)?.subregion === c?.subregion)).forEach(add)
  strong.slice(3).forEach(add)
  shuffle([...pool].filter((x) => map.get(x)?.region === c?.region)).forEach(add)
  shuffle([...pool]).forEach(add)
  return chosen
}

/** Distancia en km entre dos puntos (haversine). */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const h = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
