import { isNew, retrievability } from './fsrs'
import { cardsOf } from './cards'
import { savedItems, type StudyState } from './store'

// Estadísticas del estudio, calculadas en el dispositivo a partir de las tarjetas y los repasos.

const pad = (n: number) => String(n).padStart(2, '0')
/** Día local (YYYY-MM-DD). */
export const dayOf = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Días seguidos con al menos un repaso (hasta hoy, o hasta ayer si hoy aún no has repasado). */
export function streak(s: StudyState, now = new Date()): number {
  const days = new Set(s.reviews.map((r) => dayOf(r.at)))
  const d = new Date(now)
  if (!days.has(dayOf(d.getTime()))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(dayOf(d.getTime()))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export const reviewsToday = (s: StudyState, now = new Date()) => {
  const today = dayOf(now.getTime())
  return s.reviews.filter((r) => dayOf(r.at) === today).length
}

/** Repasos de los próximos días (el de hoy incluye lo atrasado). */
export function forecast(s: StudyState, days = 7, now = new Date()): { day: string; n: number }[] {
  const out = Array.from({ length: days }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    return { day: dayOf(d.getTime()), n: 0 }
  })
  const index = new Map(out.map((x, i) => [x.day, i]))
  for (const item of savedItems(s))
    for (const c of cardsOf(item)) {
      const st = s.cards[c.key]?.state
      if (isNew(st)) continue
      const day = dayOf(Math.max(new Date(st!.due).getTime(), now.getTime()))
      const i = index.get(day)
      if (i !== undefined) out[i].n++
    }
  return out
}

/** País de cada tarjeta: el de su guardado o, en Entrenar libre, el de sus repasos. */
function countryOfCards(s: StudyState): Map<string, string> {
  const out = new Map<string, string>()
  for (const r of s.reviews) if (r.cc) out.set(r.card, r.cc)
  for (const item of savedItems(s)) if (item.cc) for (const c of cardsOf(item)) out.set(c.key, item.cc)
  return out
}

export interface CountryMastery {
  cc: string
  /** probabilidad media de acordarte hoy (0..1) */
  score: number
  cards: number
}

/** Dominio por país: media de la recuperabilidad FSRS de sus tarjetas estudiadas. */
export function masteryByCountry(s: StudyState, now = new Date()): Map<string, CountryMastery> {
  const acc = new Map<string, { sum: number; n: number }>()
  for (const [key, cc] of countryOfCards(s)) {
    const st = s.cards[key]?.state
    if (isNew(st)) continue
    const a = acc.get(cc) ?? { sum: 0, n: 0 }
    a.sum += retrievability(st, now)
    a.n++
    acc.set(cc, a)
  }
  return new Map([...acc].map(([cc, a]) => [cc, { cc, score: a.sum / a.n, cards: a.n }]))
}

export interface Confusion {
  /** el país correcto y el que respondiste */
  a: string
  b: string
  n: number
  last: number
}

/** Parejas de países que confundes (lo que era → lo que respondiste), las más repetidas antes. */
export function confusions(s: StudyState, since = Date.now() - 120 * 86_400_000): Confusion[] {
  const m = new Map<string, Confusion>()
  for (const r of s.reviews) {
    if (!r.cc || !r.answer || r.answer === r.cc || r.at < since) continue
    const k = `${r.cc}>${r.answer}`
    const c = m.get(k) ?? { a: r.cc, b: r.answer, n: 0, last: 0 }
    c.n++
    c.last = Math.max(c.last, r.at)
    m.set(k, c)
  }
  return [...m.values()].sort((x, y) => y.n - x.n || y.last - x.last)
}

/** Países con los que confundes `cc` (para elegir distractores que te cuestan). */
export function confusedWith(s: StudyState, cc: string): string[] {
  return confusions(s).filter((c) => c.a === cc).map((c) => c.b)
}

/** Aciertos de los últimos días (respuestas con nota 2 o más). */
export function accuracy(s: StudyState, days = 30, now = Date.now()): { ok: number; n: number } {
  const from = now - days * 86_400_000
  let ok = 0
  let n = 0
  for (const r of s.reviews) {
    if (r.at < from) continue
    n++
    if (r.rating >= 2) ok++
  }
  return { ok, n }
}
