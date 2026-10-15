import { describe, expect, it } from 'vitest'
import { calendar, confusions, speed, streak } from '../stats'
import { state } from './helpers'
import type { Review } from '../types'

const at = (iso: string) => new Date(iso).getTime()
const r = (id: string, when: string, extra: Partial<Review> = {}): Review => ({ id, card: 't:1', rating: 3, at: at(when), ...extra })

describe('estadísticas', () => {
  it('racha: días seguidos hasta hoy (o ayer)', () => {
    const now = new Date('2026-03-10T15:00:00')
    const s = state({ reviews: [r('a', '2026-03-08T10:00:00'), r('b', '2026-03-09T10:00:00'), r('c', '2026-03-10T09:00:00')] })
    expect(streak(s, now)).toBe(3)
    const s2 = state({ reviews: [r('a', '2026-03-08T10:00:00'), r('b', '2026-03-09T10:00:00')] })
    expect(streak(s2, now)).toBe(2)
    expect(streak(state(), now)).toBe(0)
  })

  it('confusiones: lo que era → lo que respondiste', () => {
    const now = Date.now()
    const s = state({
      reviews: [
        { id: '1', card: 't:1', cc: 'hu', answer: 'sk', rating: 1, at: now },
        { id: '2', card: 't:2', cc: 'hu', answer: 'sk', rating: 1, at: now },
        { id: '3', card: 't:3', cc: 'hu', answer: 'hu', rating: 3, at: now },
        { id: '4', card: 't:4', cc: 'ar', answer: 'uy', rating: 1, at: now },
      ],
    })
    const c = confusions(s)
    expect(c[0]).toMatchObject({ a: 'hu', b: 'sk', n: 2 })
    expect(c).toHaveLength(2)
  })

  it('calendario de 20 semanas y velocidad', () => {
    const weeks = calendar(state(), 20, new Date('2026-03-10T12:00:00'))
    expect(weeks).toHaveLength(20)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    const now = Date.now()
    const s = state({ reviews: [1000, 2000, 3000].map((ms, i) => ({ id: String(i), card: 't:1', cc: 'hu', answer: 'hu', rating: 3 as const, ms, at: now })) })
    expect(speed(s).median).toBe(2000)
  })
})
