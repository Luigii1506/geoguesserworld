import { CLUES } from '../data/clues'
import { ALL_QUESTIONS as QUESTIONS } from '../data/bank'
import { CATEGORIES } from '../data/categories'
import type { Progress } from './storage'
import { isDue, strength } from './sm2'

export interface CategoryStat {
  categoryId: string
  total: number
  seen: number
  accuracy: number | null
  strength: number
}

/** Estadísticas de dominio por categoría, derivadas del log y del estado SM-2. */
export function categoryStats(progress: Progress): CategoryStat[] {
  return CATEGORIES.map((cat) => {
    const qs = QUESTIONS.filter((q) => q.category === cat.id)
    const logs = progress.log.filter((l) => qs.some((q) => q.id === l.questionId))
    const seenIds = new Set(logs.map((l) => l.questionId))
    const correct = logs.filter((l) => l.correct).length
    const strengths = qs.map((q) => strength(progress.srs[q.id]))
    return {
      categoryId: cat.id,
      total: qs.length,
      seen: seenIds.size,
      accuracy: logs.length ? correct / logs.length : null,
      strength: strengths.length ? strengths.reduce((a, b) => a + b, 0) / strengths.length : 0,
    }
  })
}

export function dueQuestionIds(progress: Progress): string[] {
  return QUESTIONS.filter((q) => {
    const s = progress.srs[q.id]
    return s ? isDue(s) : false
  }).map((q) => q.id)
}

/** Preguntas nunca vistas, para introducir material nuevo en el repaso. */
export function newQuestionIds(progress: Progress): string[] {
  return QUESTIONS.filter((q) => !progress.srs[q.id]).map((q) => q.id)
}

/** Fichas con nivel de dominio bajo, priorizando las más conectadas. */
export function weakClues(progress: Progress, limit = 6) {
  return CLUES
    .filter((c) => (progress.clueMastery[c.id] ?? 0) < 2)
    .sort((a, b) => (b.related?.length ?? 0) - (a.related?.length ?? 0))
    .slice(0, limit)
}

export function globalStats(progress: Progress) {
  const totalAnswered = progress.log.length
  const correct = progress.log.filter((l) => l.correct).length
  const mastered = Object.values(progress.clueMastery).filter((m) => m === 3).length
  const avgMs = totalAnswered
    ? Math.round(progress.log.reduce((a, l) => a + l.ms, 0) / totalAnswered)
    : 0
  return {
    totalAnswered,
    accuracy: totalAnswered ? correct / totalAnswered : null,
    masteredClues: mastered,
    totalClues: CLUES.length,
    avgSeconds: Math.round(avgMs / 100) / 10,
    due: dueQuestionIds(progress).length,
    inSrs: Object.keys(progress.srs).length,
    totalQuestions: QUESTIONS.length,
  }
}
