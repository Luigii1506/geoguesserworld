// Modelo del estudio de cada usuario. Se guarda en el dispositivo (store.ts) y se sincroniza
// con su cuenta (sync.ts → /api/me/sync → Neon, worker/src/db/study.sql).
//
//   StudyItem   algo guardado con ☆: una pista, una foto o un lugar, con una copia de lo
//               necesario para preguntarlo (así se estudia sin volver a pedir la guía)
//   Deck        mazo propio ("Hungría", "Bolardos de Europa"); un guardado puede estar en varios
//   CardRec     estado FSRS de una tarjeta; cada guardado da varias (cards.ts)
//   Review      cada respuesta: racha, previsión, confusiones y dominio por país (stats.ts)
//
// Claves (las de pistas y fotos de Entrenar son las de siempre: el progreso continúa):
//   t:<grupo>      pista              f:<imagen>   foto              g:<entidad>   lugar
//   p:<grupo>:<i>  foto de Entrenar   l:<id>       lugar de Entrenar

export type ItemKind = 'hint' | 'photo' | 'place'

export interface HintData {
  /** texto en el idioma en que se guardó */
  text: string
  lang: 'es' | 'en'
  cat: string
  catName?: string
  sub?: string
  region?: string
  u?: number
  img?: string
}

export interface PhotoData {
  img: string
  cat: string
  catName?: string
  sub?: string
  text?: string
}

export interface PlaceData {
  id: string
  name: string
  kind: string
  kindLabel?: string
  lat: number
  lng: number
  /** [oeste, sur, este, norte]: la tolerancia al ubicarlo depende de su tamaño */
  bbox?: [number, number, number, number]
  thumb?: string
  descr?: string
}

export type ItemData = HintData | PhotoData | PlaceData

export interface StudyItem {
  key: string
  kind: ItemKind
  cc: string | null
  decks: string[]
  note: string
  data: ItemData
  created_at: number
  updated_at: number
  deleted?: boolean
}

export interface Deck {
  id: string
  name: string
  updated_at: number
  deleted?: boolean
}

/** Estado FSRS serializado (fechas como ISO). */
export interface CardState {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: string
}

export interface CardRec {
  key: string
  state: CardState
  updated_at: number
}

/** 1 otra vez · 2 difícil · 3 bien · 4 fácil (las de FSRS) */
export type Grade = 1 | 2 | 3 | 4

export interface Review {
  id: string
  card: string
  /** país correcto y, si se respondió otro, cuál (para las confusiones) */
  cc?: string | null
  answer?: string | null
  rating: Grade
  ms?: number
  at: number
}

export interface Settings {
  /** repasos al día */
  goal: number
  /** tarjetas nuevas al día */
  newPerDay: number
  /** mazo al que van los guardados sueltos */
  lastDeck?: string
}

export const DEFAULT_SETTINGS: Settings = { goal: 20, newPerDay: 15 }
