// ─────────────────────────────────────────────────────────────────────────────
// GeoMastery · Modelo de datos del conocimiento
//
// Principio: cada pista es una afirmación con nivel de evidencia, procedencia
// y fecha de verificación. Nunca se presenta una tendencia como verdad absoluta.
// ─────────────────────────────────────────────────────────────────────────────

/** Código ISO 3166-1 alpha-2 en minúsculas ('fr', 'se', ...). */
export type CountryCode = string

export type Continent =
  | 'europa'
  | 'asia'
  | 'africa'
  | 'norteamerica'
  | 'sudamerica'
  | 'oceania'

/**
 * Nivel de evidencia de una pista. No es decoración: cambia cómo debes usarla
 * en partida (apostar, acotar o solo sumar contexto).
 */
export type Confidence =
  | 'fuerte' //      casi determinante por sí sola
  | 'moderada' //    acota mucho, necesita confirmación
  | 'debil' //       solo suma probabilidad
  | 'contextual' //  indicio de entorno, no de país concreto
  | 'meta' //        depende de cobertura/generación de Street View, puede caducar
  | 'verificar' //   anotada pero pendiente de verificación propia

export interface Category {
  id: string
  name: string
  /** Letra de dominio del temario (A–G) a la que pertenece. */
  domain: string
  description: string
  icon: string // emoji
}

export interface Country {
  code: CountryCode
  name: string
  continent: Continent
  flag: string
  /** Lado de circulación. */
  driving: 'derecha' | 'izquierda'
  tld: string
  languages: string[]
  scripts: string[]
  /** Datos rápidos por categoría: carreteras, matrículas, postes, etc. */
  quickFacts: { category: string; fact: string }[]
  /** Notas de cobertura de Street View (meta, puede caducar). */
  coverage?: string
}

/** Ficha de conocimiento: la unidad básica de la Academia. */
export interface Clue {
  id: string
  name: string
  category: string // Category.id
  subcategory?: string
  countries: CountryCode[]
  regions?: string[]
  /** Qué se ve: descripción visual concreta. */
  visual: string
  /** Qué observar exactamente para no confundirla. */
  lookFor: string
  /** Por qué existe esa característica (histórico, normativo, climático...). */
  why?: string
  /** Cómo usarla en partida: qué decisión habilita. */
  howToUse: string
  confidence: Confidence
  /** Países que se confunden con el objetivo y cómo distinguirlos. */
  confusions?: { countries: CountryCode[]; distinction: string }[]
  exceptions?: string[]
  /** Pistas relacionadas (ids de Clue). */
  related?: string[]
  sources: { name: string; url: string }[]
  /** Fecha de última verificación del contenido (YYYY-MM-DD). */
  verifiedAt: string
  /** Ids de preguntas de repaso asociadas. */
  questionIds?: string[]
}

/** Fila de una comparación del Atlas. */
export interface ComparisonRow {
  category: string
  /** Una celda por país, en el mismo orden que Comparison.countries. */
  cells: string[]
  /** true si las diferencias se solapan y no conviene apostar solo por esta fila. */
  overlap?: boolean
  note?: string
}

export interface Comparison {
  id: string
  title: string
  countries: CountryCode[]
  intro: string
  rows: ComparisonRow[]
  /** Resumen operativo: qué mirar primero para separar estos países. */
  verdict: string
  relatedClues?: string[]
}

/** Ejemplo de estudio dentro de un laboratorio. */
export interface LabItem {
  country: CountryCode | null
  label: string
  description: string
  distinguishing: string
}

export interface Lab {
  id: string
  title: string
  icon: string
  intro: string
  items: LabItem[]
  /** Preguntas del drill final (ids de Question). */
  drillQuestionIds: string[]
  relatedClues?: string[]
}

export type QuestionType =
  | 'pais' //        identificar el país
  | 'duelo' //       elegir entre países similares
  | 'pista' //       identificar/interpretar una pista
  | 'descarte' //    descartar hipótesis incorrectas
  | 'combinada' //   combinar varias pistas
  | 'general' //     geografía general

export interface Question {
  id: string
  type: QuestionType
  category: string // Category.id
  prompt: string
  options: string[]
  answer: number // índice de la opción correcta
  /** Por qué la correcta es válida Y por qué las alternativas lo son menos. */
  explanation: string
  relatedClues?: string[]
  difficulty: 1 | 2 | 3
  /** Título de artículo de Wikipedia cuya imagen ilustra la pregunta. */
  image?: string
  /** Pista textual visible junto a la imagen antes de responder. */
  hint?: string
}

/** Lugar reconocible: monumento, ciudad o paraje natural. */
export interface Landmark {
  id: string
  name: string
  /** Título del artículo en es.wikipedia.org (los redirects se resuelven solos). */
  wikiTitle: string
  country: CountryCode
  type: 'monumento' | 'ciudad' | 'natural'
  /** Qué lo hace reconocible desde Street View o en foto. */
  clue: string
  /** Tres países plausibles como distractores del quiz. */
  distractors: [CountryCode, CountryCode, CountryCode]
}

/** Unidad de la Ruta de aprendizaje guiada. */
export interface PathUnit {
  id: string
  title: string
  icon: string
  /** Qué sabrás hacer al terminarla. */
  goal: string
  clueIds: string[]
  drillQuestionIds: string[]
}

export interface Source {
  id: string
  name: string
  url: string
  type: string
  summary: string
  coverage: string
  license: string
  useInApp: string
  limitations: string
  checkedAt: string
}
