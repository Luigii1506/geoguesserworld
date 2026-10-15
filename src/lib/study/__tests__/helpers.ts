import { DEFAULT_SETTINGS, type CardState, type StudyItem } from '../types'
import type { StudyState } from '../store'

export const hint = (id: number, cc: string, extra: Partial<StudyItem> = {}): StudyItem => ({
  key: `t:${id}`, kind: 'hint', cc, decks: [], note: '', created_at: 1, updated_at: 1,
  data: { text: `pista ${id}`, lang: 'es', cat: 'bollards', u: 2 },
  ...extra,
})

export const state = (patch: Partial<StudyState> = {}): StudyState => ({
  owner: 'test', ready: true, items: {}, decks: {}, cards: {}, reviews: [],
  settings: { data: { ...DEFAULT_SETTINGS }, updated_at: 0 }, cursor: null,
  dirty: { items: [], decks: [], cards: [], reviews: [], settings: false },
  ...patch,
})

export const card = (due: string, extra: Partial<CardState> = {}): CardState => ({
  due, stability: 5, difficulty: 5, elapsed_days: 0, scheduled_days: 5, learning_steps: 0, reps: 3, lapses: 0, state: 2,
  last_review: '2026-01-01T00:00:00.000Z', ...extra,
})
