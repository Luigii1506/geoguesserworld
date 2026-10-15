// Repetición espaciada con FSRS (Free Spaced Repetition Scheduler, el de Anki desde la 23.10),
// vía ts-fsrs. Frente a SM-2 modela tres cosas de cada tarjeta: estabilidad (cuántos días
// aguanta el recuerdo), dificultad y recuperabilidad (probabilidad de acordarte hoy). Programa
// el repaso cuando esa probabilidad baja al 90 %: menos repasos para lo mismo, y una tarjeta
// que fallas mucho no se queda atascada en intervalos de un día.

import { createEmptyCard, fsrs, generatorParameters, State, type Card, type Grade as FsrsGrade } from 'ts-fsrs'
import type { CardState, Grade } from './types'

const scheduler = fsrs(generatorParameters({ request_retention: 0.9, maximum_interval: 3650, enable_fuzz: true }))

export const toCard = (s: CardState): Card => ({
  ...s,
  due: new Date(s.due),
  last_review: s.last_review ? new Date(s.last_review) : undefined,
})

export const fromCard = (c: Card): CardState => ({
  due: c.due.toISOString(),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  learning_steps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state,
  last_review: c.last_review?.toISOString(),
})

export const newCard = (now = new Date()): CardState => fromCard(createEmptyCard(now))

/** Aplica una respuesta. */
export function rate(state: CardState | undefined, grade: Grade, now = new Date()): CardState {
  const card = state ? toCard(state) : createEmptyCard(now)
  return fromCard(scheduler.next(card, now, grade as FsrsGrade).card)
}

/** Cuándo volvería según cada respuesta (para los botones: "Bien · 4 d"). */
export function preview(state: CardState | undefined, now = new Date()): Record<Grade, Date> {
  const card = state ? toCard(state) : createEmptyCard(now)
  const r = scheduler.repeat(card, now)
  return { 1: r[1].card.due, 2: r[2].card.due, 3: r[3].card.due, 4: r[4].card.due }
}

export const isDue = (s: CardState, now = new Date()) => new Date(s.due) <= now
export const isNew = (s: CardState | undefined) => !s || s.state === State.New

/** Probabilidad de acordarse ahora (0..1); 0 si nunca se ha estudiado. */
export function retrievability(s: CardState | undefined, now = new Date()): number {
  if (!s || s.state === State.New) return 0
  return scheduler.get_retrievability(toCard(s), now, false) as number
}

/** "en 10 min", "en 4 d", "en 3 m" */
export function untilText(when: Date, now = new Date()): string {
  const min = Math.max(1, Math.round((when.getTime() - now.getTime()) / 60000))
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(h / 24)
  if (d < 31) return `${d} d`
  const m = Math.round(d / 30.4)
  return m < 12 ? `${m} m` : `${(d / 365).toFixed(1).replace('.0', '')} a`
}

// ── migración del progreso SM-2 (versión 1 de la app) ──
interface Sm2 { ef: number; reps: number; interval: number; due: string; lapses: number; lastReview: string | null }

/**
 * Estado SM-2 → FSRS conservando lo aprendido: el intervalo pasa a ser la estabilidad (días
 * que aguanta el recuerdo) y el factor de facilidad, la dificultad (EF 2,5 ≈ 5; 1,3 ≈ 9).
 */
export function fromSm2(s: Sm2): CardState {
  const difficulty = Math.min(10, Math.max(1, 5 + (2.5 - s.ef) * (4 / 1.2)))
  const learned = s.reps > 0
  return {
    due: new Date(`${s.due}T00:00:00`).toISOString(),
    stability: learned ? Math.max(1, s.interval) : 0.5,
    difficulty,
    elapsed_days: 0,
    scheduled_days: Math.max(0, s.interval),
    learning_steps: 0,
    reps: Math.max(1, s.reps),
    lapses: s.lapses,
    state: learned ? State.Review : State.Relearning,
    last_review: s.lastReview ? new Date(`${s.lastReview}T12:00:00`).toISOString() : undefined,
  }
}
