// ─────────────────────────────────────────────────────────────────────────────
// Repetición espaciada: implementación de SM-2 (SuperMemo 2, Wozniak 1990).
//
// Cada pregunta del banco tiene un estado SM-2. Tras cada repaso, el usuario
// (o el resultado) produce una calidad q ∈ [0..5]:
//   5 = perfecta y rápida · 4 = correcta · 3 = correcta con esfuerzo
//   2..0 = fallo (con matices)
//
// Reglas SM-2:
// - q ≥ 3: reps++ ; intervalo = 1 día (reps=1), 6 días (reps=2),
//   intervalo_anterior × EF (reps>2).
// - q < 3: reps = 0, intervalo = 1 día (se reaprende), lapses++.
// - EF' = EF + (0.1 − (5−q)·(0.08 + (5−q)·0.02)), con mínimo 1.3.
// ─────────────────────────────────────────────────────────────────────────────

export interface Sm2State {
  ef: number
  reps: number
  interval: number // días
  due: string // ISO fecha (YYYY-MM-DD)
  lapses: number
  lastReview: string | null
  history: { date: string; q: number; ms: number }[]
}

export function newSm2State(): Sm2State {
  return {
    ef: 2.5,
    reps: 0,
    interval: 0,
    due: todayISO(),
    lapses: 0,
    lastReview: null,
    history: [],
  }
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Aplica una revisión con calidad q (0-5) y tiempo de respuesta en ms. */
export function review(state: Sm2State, q: number, ms: number): Sm2State {
  const today = todayISO()
  const quality = Math.max(0, Math.min(5, Math.round(q)))

  let { ef, reps, interval, lapses } = state

  if (quality >= 3) {
    reps += 1
    if (reps === 1) interval = 1
    else if (reps === 2) interval = 6
    else interval = Math.round(interval * ef)
  } else {
    reps = 0
    interval = 1
    lapses += 1
  }

  ef = Math.max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

  return {
    ef,
    reps,
    interval,
    due: addDays(today, interval),
    lapses,
    lastReview: today,
    history: [...state.history.slice(-49), { date: today, q: quality, ms }],
  }
}

export function isDue(state: Sm2State): boolean {
  return state.due <= todayISO()
}

/** Dominio estimado 0..1 a partir del estado SM-2. */
export function strength(state: Sm2State | undefined): number {
  if (!state || state.reps === 0) return 0
  // reps y EF altos ⇒ más consolidado; los lapses penalizan.
  const base = Math.min(1, state.reps / 5)
  const efFactor = (state.ef - 1.3) / (2.8 - 1.3)
  const lapsePenalty = Math.min(0.4, state.lapses * 0.08)
  return Math.max(0, Math.min(1, base * 0.6 + efFactor * 0.4 - lapsePenalty))
}
