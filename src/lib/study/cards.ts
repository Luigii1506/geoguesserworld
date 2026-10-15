import { isDue, isNew } from './fsrs'
import { shuffle } from './quiz'
import { savedItems, type StudyState } from './store'
import type { PlaceData, StudyItem } from './types'

// Qué se pregunta de cada guardado. Cada tipo trabaja la habilidad de una forma:
//   choice   reconocer: ves la pista, la foto o el lugar → ¿de qué país es? (como en una ronda)
//   recall   recordar: "Hungría · bolardos: ¿cómo son?" → lo piensas, lo ves y te puntúas (Anki)
//   locate   ubicar: "¿dónde está el lago Balatón?" → clic en el mapa, puntúa la distancia
// Una misma cosa no sale dos veces en una sesión (sus tarjetas se reparten en días distintos).

export type CardType = 'choice' | 'recall' | 'locate'

export interface CardSpec {
  key: string
  type: CardType
  item: StudyItem
}

export function cardsOf(item: StudyItem): CardSpec[] {
  if (item.kind === 'place') {
    const d = item.data as PlaceData
    return [
      { key: `${item.key}#m`, type: 'locate', item },
      ...(d.thumb && item.cc ? [{ key: item.key, type: 'choice' as const, item }] : []),
    ]
  }
  return [
    ...(item.cc ? [{ key: item.key, type: 'choice' as const, item }] : []),
    { key: `${item.key}#r`, type: 'recall', item },
  ]
}

export interface SessionScope {
  deck?: string
  cc?: string
}

export const inScope = (item: StudyItem, scope: SessionScope) =>
  (!scope.deck || item.decks.includes(scope.deck)) && (!scope.cc || item.cc === scope.cc)

const dayStart = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

/** Tarjetas nuevas ya empezadas hoy (cuentan para el límite diario). */
export function newToday(s: StudyState, now = new Date()): number {
  const today = dayStart(now)
  const before = new Set<string>()
  const todayCards = new Set<string>()
  for (const r of s.reviews) (r.at < today ? before : todayCards).add(r.card)
  let n = 0
  for (const c of todayCards) if (!before.has(c)) n++
  return n
}

/** Recuentos de un ámbito: cuántas tocan repasar y cuántas nuevas quedan hoy. */
export function scopeCounts(s: StudyState, scope: SessionScope = {}, now = new Date()) {
  let due = 0
  let fresh = 0
  for (const item of savedItems(s)) {
    if (!inScope(item, scope)) continue
    for (const c of cardsOf(item)) {
      const st = s.cards[c.key]?.state
      if (isNew(st)) fresh++
      else if (isDue(st!, now)) due++
    }
  }
  const newLeft = Math.max(0, s.settings.data.newPerDay - newToday(s, now))
  return { due, fresh, newAvailable: Math.min(fresh, newLeft), items: savedItems(s).filter((i) => inScope(i, scope)).length }
}

/**
 * Sesión: primero lo que toca repasar (lo más atrasado antes), luego nuevas hasta el límite
 * del día, mezclando países. Con `extra`, si no queda nada, adelanta las más próximas.
 */
export function buildSession(s: StudyState, scope: SessionScope, size: number, opts: { extra?: boolean } = {}): CardSpec[] {
  const now = new Date()
  const due: { spec: CardSpec; at: number }[] = []
  const fresh: CardSpec[] = []
  const soon: { spec: CardSpec; at: number }[] = []
  for (const item of savedItems(s)) {
    if (!inScope(item, scope)) continue
    for (const spec of cardsOf(item)) {
      const st = s.cards[spec.key]?.state
      if (isNew(st)) fresh.push(spec)
      else if (isDue(st!, now)) due.push({ spec, at: new Date(st!.due).getTime() })
      else soon.push({ spec, at: new Date(st!.due).getTime() })
    }
  }
  const out: CardSpec[] = []
  const usedItems = new Set<string>()
  const take = (spec: CardSpec) => {
    if (out.length >= size || usedItems.has(spec.item.key)) return
    usedItems.add(spec.item.key)
    out.push(spec)
  }
  due.sort((a, b) => a.at - b.at).forEach((d) => take(d.spec))
  // nuevas: primero reconocer (lo más útil en partida), países alternados
  const newLeft = Math.max(0, s.settings.data.newPerDay - newToday(s, now))
  const order = { choice: 0, locate: 1, recall: 2 }
  const byCountry = new Map<string, CardSpec[]>()
  for (const spec of shuffle(fresh).sort((a, b) => order[a.type] - order[b.type])) {
    const cc = spec.item.cc ?? '?'
    byCountry.set(cc, [...(byCountry.get(cc) ?? []), spec])
  }
  const lanes = shuffle([...byCountry.values()])
  let added = 0
  while (added < newLeft && out.length < size && lanes.some((l) => l.length)) {
    for (const lane of lanes) {
      const spec = lane.shift()
      if (!spec || added >= newLeft) continue
      const before = out.length
      take(spec)
      if (out.length > before) added++
    }
  }
  if (!out.length && opts.extra) soon.sort((a, b) => a.at - b.at).forEach((d) => take(d.spec))
  // repasos y nuevas mezclados, para no acabar con un bloque de lo más difícil
  return out.length > 3 ? [...out.slice(0, 1), ...shuffle(out.slice(1))] : out
}

/**
 * Tarjetas pendientes en todo el estudio: las de lo guardado y las de Entrenar libre (pistas,
 * fotos y lugares que pregunta la API). Las de algo que ya no está guardado no cuentan.
 */
export function dueCount(s: StudyState, now = new Date()): number {
  let n = 0
  for (const c of Object.values(s.cards)) {
    if (isNew(c.state) || !isDue(c.state, now)) continue
    const base = c.key.split('#')[0]
    const practice = !c.key.includes('#') && /^(t|p|l):/.test(c.key)
    if (practice || (s.items[base] && !s.items[base].deleted)) n++
  }
  return n
}
