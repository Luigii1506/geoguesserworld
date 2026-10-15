import { isDue, isNew, retrievability } from './fsrs'
import { shuffle } from './quiz'
import { savedItems, type StudyState } from './store'
import type { HintData, PlaceData, StudyItem } from './types'

// Qué se pregunta de cada guardado. Cada tipo trabaja la habilidad de una forma:
//   choice   reconocer: ves la pista, la foto o el lugar → ¿de qué país es? (como en una ronda)
//   recall   recordar: "Hungría · bolardos: ¿cómo son?" → lo piensas, lo ves y te puntúas (Anki)
//   locate   ubicar: "¿dónde está el lago Balatón?" → clic en el mapa, puntúa la distancia
//   streetview  la vista de Street View del ejemplo de una pista → ¿de qué país es? (como en partida)
//   twins    gemelos: dos fotos del mismo tema, una de cada país → ¿cuál es cuál?
// Una misma cosa no sale dos veces en una sesión (sus tarjetas se reparten en días distintos).

export type CardType = 'choice' | 'recall' | 'locate' | 'streetview' | 'twins'

export interface CardSpec {
  key: string
  type: CardType
  item: StudyItem
}

export function cardsOf(item: StudyItem): CardSpec[] {
  if (item.kind === 'twins') return [{ key: item.key, type: 'twins', item }]
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
    ...(item.kind === 'hint' && item.cc && (item.data as HintData).sv ? [{ key: `${item.key}#sv`, type: 'streetview' as const, item }] : []),
  ]
}

/** Mazos automáticos: se rellenan solos con lo guardado. */
export type SmartDeck = 'weak' | 'essential' | 'twins'
export const SMART_DECKS: { id: SmartDeck; name: string; hint: string }[] = [
  { id: 'weak', name: 'Lo que más fallas', hint: 'tarjetas que has fallado varias veces o que estás a punto de olvidar' },
  { id: 'essential', name: 'Determinantes', hint: 'las pistas que por sí solas dicen el país' },
  { id: 'twins', name: 'Gemelos', hint: 'parejas de países que se confunden, foto contra foto' },
]

export interface SessionScope {
  deck?: string
  cc?: string
  smart?: SmartDeck
}

/** ¿Una tarjeta es de las que más cuestan? (falladas 2+ veces o con menos de un 70 % de recuerdo) */
function weakCard(s: StudyState, key: string): boolean {
  const st = s.cards[key]?.state
  if (isNew(st)) return false
  return st!.lapses >= 2 || retrievability(st) < 0.7
}

export function inScope(item: StudyItem, scope: SessionScope, s?: StudyState): boolean {
  if (scope.deck && !item.decks.includes(scope.deck)) return false
  if (scope.cc && item.cc !== scope.cc && !(item.kind === 'twins' && [(item.data as { a: string }).a, (item.data as { b: string }).b].includes(scope.cc))) return false
  if (scope.smart === 'essential') return item.kind === 'hint' && (item.data as HintData).u === 3
  if (scope.smart === 'twins') return item.kind === 'twins'
  if (scope.smart === 'weak') return Boolean(s) && cardsOf(item).some((c) => weakCard(s!, c.key))
  return true
}

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
  let items = 0
  let weak = 0
  for (const item of savedItems(s)) {
    if (!inScope(item, scope, s)) continue
    items++
    for (const c of cardsOf(item)) {
      const st = s.cards[c.key]?.state
      if (isNew(st)) fresh++
      else if (isDue(st!, now)) due++
      if (weakCard(s, c.key)) weak++
    }
  }
  const newLeft = Math.max(0, s.settings.data.newPerDay - newToday(s, now))
  // en "lo que más fallas" se repasa todo lo flojo, toque o no
  if (scope.smart === 'weak') return { due: weak, fresh: 0, newAvailable: 0, items }
  return { due, fresh, newAvailable: Math.min(fresh, newLeft), items }
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
    if (!inScope(item, scope, s)) continue
    for (const spec of cardsOf(item)) {
      const st = s.cards[spec.key]?.state
      // lo que más fallas: las tarjetas flojas, aunque aún no toque repasarlas
      if (scope.smart === 'weak') {
        if (weakCard(s, spec.key)) due.push({ spec, at: new Date(st!.due).getTime() })
        continue
      }
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
  const order = { choice: 0, twins: 1, locate: 2, streetview: 3, recall: 4 }
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
