import { beforeEach, describe, expect, it } from 'vitest'
import { applySync, closeStudy, getStudy, openStudy, pendingChanges, reviewCard, saveItems, setNote } from '../store'

const item = (key: string) => ({ key, kind: 'hint' as const, cc: 'hu', data: { text: key, lang: 'es' as const, cat: 'c' } })
const remote = (patch = {}) => ({ cursor: '2026-01-01T00:00:00Z', decks: [], items: [], cards: [], reviews: [], settings: null, ...patch })

describe('almacén y sincronización', () => {
  beforeEach(async () => {
    localStorage.clear()
    closeStudy()
    await openStudy(`u-${Math.random()}`)
  })

  it('guardar deja cambios pendientes y la sincronización los limpia', () => {
    saveItems([item('t:1')])
    const sent = pendingChanges()
    expect(sent.items.map((i) => i.key)).toEqual(['t:1'])
    applySync(getStudy().owner!, sent, remote())
    expect(getStudy().dirty.items).toEqual([])
    expect(getStudy().cursor).toBe('2026-01-01T00:00:00Z')
  })

  it('lo que cambia mientras se sincroniza sigue pendiente', async () => {
    saveItems([item('t:1')])
    const sent = pendingChanges()
    await new Promise((r) => setTimeout(r, 2))
    setNote('t:1', 'nota nueva')
    applySync(getStudy().owner!, sent, remote())
    expect(getStudy().dirty.items).toEqual(['t:1'])
  })

  it('gana el cambio más reciente y los repasos se suman sin duplicar', () => {
    saveItems([item('t:1')])
    reviewCard('t:1', 3, { cc: 'hu', answer: 'hu' })
    const local = getStudy().items['t:1']
    const mine = getStudy().reviews[0]
    const older = { ...local, note: 'vieja', updated_at: local.updated_at - 1000 }
    const newer = { ...item('t:2'), decks: [], note: 'de otro dispositivo', created_at: 1, updated_at: Date.now() + 1000 }
    applySync(getStudy().owner!, pendingChanges(), remote({
      items: [older, newer],
      reviews: [mine, { id: 'otro', card: 't:2', rating: 1, at: Date.now() }],
    }))
    const s = getStudy()
    expect(s.items['t:1'].note).toBe('')
    expect(s.items['t:2'].note).toBe('de otro dispositivo')
    expect(s.reviews.map((r) => r.id).sort()).toEqual([mine.id, 'otro'].sort())
  })

  it('migra el progreso SM-2 de la versión anterior', async () => {
    localStorage.setItem('geomastery.v1', JSON.stringify({
      version: 1,
      srs: { 't:7': { ef: 2.5, reps: 2, interval: 6, due: '2026-01-10', lapses: 0, lastReview: '2026-01-04', history: [] } },
      log: [{ date: '2026-01-04T10:00:00Z', questionId: 't:7', correct: true, ms: 2000, mode: 'practica' }],
    }))
    closeStudy()
    await openStudy('migra')
    const s = getStudy()
    expect(s.cards['t:7'].state.stability).toBe(6)
    expect(s.reviews).toHaveLength(1)
    expect(s.dirty.cards).toContain('t:7')
    expect(localStorage.getItem('geomastery.v1')).toBeNull()
  })
})
