import { describe, expect, it } from 'vitest'
import { State } from 'ts-fsrs'
import { fromSm2, isDue, isNew, newCard, rate, retrievability, untilText } from '../fsrs'

describe('FSRS', () => {
  it('una tarjeta nueva es nueva y vence ya', () => {
    const c = newCard()
    expect(isNew(c)).toBe(true)
    expect(isDue(c)).toBe(true)
    expect(retrievability(c)).toBe(0)
  })

  it('acertar aleja el repaso más que fallar', () => {
    const now = new Date('2026-01-01T10:00:00Z')
    const good = rate(undefined, 3, now)
    const again = rate(undefined, 1, now)
    expect(new Date(good.due).getTime()).toBeGreaterThan(new Date(again.due).getTime())
    // tras varias respuestas buenas, el intervalo crece
    let s = good
    let t = now
    for (let i = 0; i < 3; i++) {
      t = new Date(s.due)
      s = rate(s, 3, t)
    }
    expect(s.state).toBe(State.Review)
    expect(new Date(s.due).getTime() - t.getTime()).toBeGreaterThan(3 * 86_400_000)
  })

  it('la recuperabilidad baja con el tiempo', () => {
    const now = new Date('2026-01-01T10:00:00Z')
    const s = rate(rate(undefined, 3, now), 3, new Date('2026-01-02T10:00:00Z'))
    const soon = retrievability(s, new Date('2026-01-03T10:00:00Z'))
    const late = retrievability(s, new Date('2026-03-01T10:00:00Z'))
    expect(soon).toBeGreaterThan(late)
    expect(late).toBeGreaterThan(0)
  })

  it('migra SM-2 conservando lo aprendido', () => {
    const learned = fromSm2({ ef: 2.5, reps: 3, interval: 15, due: '2026-02-01', lapses: 1, lastReview: '2026-01-17' })
    expect(learned.state).toBe(State.Review)
    expect(learned.stability).toBe(15)
    expect(learned.difficulty).toBeCloseTo(5)
    expect(learned.lapses).toBe(1)
    expect(learned.due.startsWith('2026-02-0')).toBe(true)
    const failed = fromSm2({ ef: 1.3, reps: 0, interval: 1, due: '2026-01-02', lapses: 3, lastReview: '2026-01-01' })
    expect(failed.state).toBe(State.Relearning)
    expect(failed.difficulty).toBeCloseTo(9)
  })

  it('textos de tiempo', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(untilText(new Date('2026-01-01T00:10:00Z'), now)).toBe('10 min')
    expect(untilText(new Date('2026-01-05T00:00:00Z'), now)).toBe('4 d')
  })
})
