import type { Question } from './types'
import { QUESTIONS } from './questions'
import { LANDMARK_QUESTIONS } from './landmarks'

// Banco completo: preguntas de autor + preguntas estables del módulo Mundo.
// Todas son estables (ids fijos) y por tanto aptas para el calendario SM-2.

export const ALL_QUESTIONS: Question[] = [...QUESTIONS, ...LANDMARK_QUESTIONS]

export const ALL_QUESTION_MAP = new Map(ALL_QUESTIONS.map((q) => [q.id, q]))
