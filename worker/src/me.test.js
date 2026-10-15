import { describe, expect, it } from 'vitest'
import { clean } from './me.js'

describe('validación de /api/me/sync', () => {
  it('descarta lo mal formado y recorta lo excesivo', () => {
    const c = clean({
      since: 'no es fecha',
      decks: [{ id: 'd1', name: 'Hungría', updated_at: 5 }, { id: '', name: 'x', updated_at: 5 }, { id: 'd2', updated_at: 5 }],
      items: [
        { key: 't:1', kind: 'hint', data: { text: 'x' }, created_at: 1, updated_at: 2, note: 'n'.repeat(5000) },
        { key: 't:2', kind: 'hint', created_at: 1, updated_at: 2 },
        { key: 't:3', kind: 'hint', data: { text: 'x'.repeat(20000) }, created_at: 1, updated_at: 2 },
      ],
      reviews: [{ id: 'r', card: 't:1', rating: 9, at: 1 }, { id: 'r2', card: 't:1', rating: 2, at: 1 }],
    })
    expect(c.since).toBeNull()
    expect(c.decks.map((d) => d.id)).toEqual(['d1'])
    expect(c.items.map((i) => i.key)).toEqual(['t:1'])
    expect(c.items[0].note.length).toBe(4000)
    expect(c.reviews.map((r) => r.id)).toEqual(['r2'])
  })
})
