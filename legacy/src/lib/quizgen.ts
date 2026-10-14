import type { Question } from '../data/types'
import { COUNTRIES } from '../data/countries'

// Ráfagas generadas: preguntas infinitas derivadas de la base de países.
// No entran en el sistema SM-2 (no son estables); sirven para calentar.

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}

let seq = 0

export function genDrivingSideQuestion(): Question {
  const c = pick(COUNTRIES, 1)[0]
  const correct = c.driving === 'izquierda' ? 'Izquierda' : 'Derecha'
  return {
    id: `gen-driving-${seq++}`,
    type: 'general',
    category: 'circulacion',
    prompt: `${c.flag} ¿Por qué lado se conduce en ${c.name}?`,
    options: ['Izquierda', 'Derecha'],
    answer: correct === 'Izquierda' ? 0 : 1,
    explanation:
      c.driving === 'izquierda'
        ? `${c.name} conduce por la izquierda. Repasa los bloques: Islas Británicas, Japón, Sur/Sudeste de Asia, África oriental y austral, Oceanía.`
        : `${c.name} conduce por la derecha, como la mayoría del mundo.`,
    difficulty: 1,
  }
}

export function genFlagQuestion(): Question {
  const candidates = pick(COUNTRIES, 4)
  const target = candidates[0]
  const options = shuffle(candidates.map((c) => c.name))
  return {
    id: `gen-flag-${seq++}`,
    type: 'general',
    category: 'cultura',
    prompt: `¿De qué país es esta bandera? ${target.flag}`,
    options,
    answer: options.indexOf(target.name),
    explanation: `${target.flag} es la bandera de ${target.name} (${target.tld}). Las banderas aparecen en edificios públicos, comercios y matrículas: dominarlas da puntos gratis.`,
    difficulty: 1,
  }
}

export function genTldQuestion(): Question {
  const candidates = pick(COUNTRIES, 4)
  const target = candidates[0]
  const options = shuffle(candidates.map((c) => c.name))
  return {
    id: `gen-tld-${seq++}`,
    type: 'general',
    category: 'idioma',
    prompt: `Un cartel comercial termina en "${target.tld}". ¿Qué país es?`,
    options,
    answer: options.indexOf(target.name),
    explanation: `${target.tld} es el dominio de ${target.name}. Los dominios en anuncios y furgonetas son de las pistas más directas que existen.`,
    difficulty: 2,
  }
}

export type GeneratorId = 'driving' | 'flag' | 'tld'

export const GENERATORS: { id: GeneratorId; name: string; description: string; make: () => Question }[] = [
  { id: 'driving', name: 'Sentido de circulación', description: '¿Izquierda o derecha? País a país.', make: genDrivingSideQuestion },
  { id: 'flag', name: 'Banderas', description: 'Reconoce la bandera entre cuatro países.', make: genFlagQuestion },
  { id: 'tld', name: 'Dominios de internet', description: 'Del .uy al .kz: el país por su dominio.', make: genTldQuestion },
]
