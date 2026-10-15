import { describe, expect, it } from 'vitest'
import { buildSession, cardsOf, dueCount, inScope, scopeCounts } from '../cards'
import { card, hint, state } from './helpers'

const items = (list: ReturnType<typeof hint>[]) => Object.fromEntries(list.map((i) => [i.key, i]))

describe('tarjetas', () => {
  it('cada pista da reconocer y recordar; con Street View, también Street View', () => {
    expect(cardsOf(hint(1, 'hu')).map((c) => c.type)).toEqual(['choice', 'recall'])
    const sv = hint(2, 'hu', { data: { text: 'x', lang: 'es', cat: 'c', sv: { p: 'P', lat: 1, lng: 2, h: 0, t: 0, f: 90 } } })
    expect(cardsOf(sv).map((c) => c.type)).toEqual(['choice', 'recall', 'streetview'])
  })

  it('la sesión pone primero lo que toca y respeta el límite de nuevas', () => {
    const list = Array.from({ length: 30 }, (_, i) => hint(i, i % 2 ? 'hu' : 'sk'))
    const s = state({
      items: items(list),
      cards: { 't:0': { key: 't:0', state: card('2020-01-01T00:00:00.000Z'), updated_at: 1 } },
      settings: { data: { goal: 20, newPerDay: 5 }, updated_at: 0 },
    })
    const session = buildSession(s, {}, 20)
    expect(session[0].key).toBe('t:0')
    // 1 repaso + 5 nuevas, y nunca dos tarjetas del mismo guardado
    expect(session.length).toBe(6)
    expect(new Set(session.map((c) => c.item.key)).size).toBe(session.length)
  })

  it('filtra por mazo, país y mazos automáticos', () => {
    const a = hint(1, 'hu', { decks: ['d1'] })
    const b = hint(2, 'sk', { data: { text: 'x', lang: 'es', cat: 'c', u: 3 } })
    const s = state({ items: items([a, b]) })
    expect(inScope(a, { deck: 'd1' })).toBe(true)
    expect(inScope(b, { deck: 'd1' })).toBe(false)
    expect(inScope(b, { cc: 'sk' })).toBe(true)
    expect(inScope(b, { smart: 'essential' }, s)).toBe(true)
    expect(inScope(a, { smart: 'essential' }, s)).toBe(false)
  })

  it('"lo que más fallas" recoge lo fallado aunque no toque', () => {
    const a = hint(1, 'hu')
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString()
    const s = state({ items: items([a]), cards: { 't:1': { key: 't:1', state: card(future, { lapses: 3 }), updated_at: 1 } } })
    expect(scopeCounts(s, { smart: 'weak' }).due).toBe(1)
    expect(buildSession(s, { smart: 'weak' }, 10).map((c) => c.key)).toEqual(['t:1'])
  })

  it('los pendientes no cuentan lo que ya no está guardado', () => {
    const past = '2020-01-01T00:00:00.000Z'
    const s = state({
      items: { 'f:x': { ...hint(9, 'hu'), key: 'f:x', kind: 'photo', deleted: true } },
      cards: {
        'f:x': { key: 'f:x', state: card(past), updated_at: 1 },
        't:5': { key: 't:5', state: card(past), updated_at: 1 },
      },
    })
    // la pista de Entrenar libre cuenta; la foto quitada no
    expect(dueCount(s)).toBe(1)
  })
})
