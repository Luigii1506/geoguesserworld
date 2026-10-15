import { checkAuth } from './remote'
import { apiGet, apiUrl } from './geo'

// Cliente de la API de las guías (/api/gg/…, worker/src/geo/gg.js): el explorador
// visual y las sesiones de Entrenar se piden a trozos en lugar de descargar
// visual-index.json y quiz.json enteros.

export interface VisualItem {
  id: number
  c: string | null
  n?: string
  s: string
  k: string
  sk?: string
  t: string
  i: string
  l: string
}

export interface VisualPage {
  total: number
  offset: number
  limit: number
  items: VisualItem[]
  facets?: { subs: [string, number][]; countries: Record<string, number> }
}

export interface VisualQuery {
  cat: string
  sub?: string
  cc?: string
  continent?: string
  src?: string
  offset?: number
  limit?: number
}

const qs = (o: object) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => [k, String(v)])).toString()

export const guides = {
  visualMeta: () => apiGet<{ categories: { id: string; name: string; grp: string }[]; counts: Record<string, number> }>('gg/visual/meta'),
  visual: (q: VisualQuery) => apiGet<VisualPage>(`gg/visual?${qs(q)}`),
  quizCategories: () => apiGet<{ categories: Record<string, number> }>('gg/quiz/categories'),
  /** Sesión de Entrenar (o, con size 0, solo los recuentos). Sin caché: depende de tu progreso. */
  quiz: async (body: QuizRequest): Promise<QuizSession> => {
    // text/plain: así el navegador no necesita la consulta previa de CORS
    const r = await fetch(apiUrl('gg/quiz'), { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(body) }).then(checkAuth)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  },
}

export interface QuizRequest {
  mode: 'mix' | 'text' | 'photo'
  scope: string
  essential: boolean
  category: string
  size: number
  due: string[]
  seen: string[]
}

export interface QuizSession {
  pool: number
  due: number
  items: { key: string; kind: 'text' | 'photo'; cc: string; due: boolean; pool: string; data: Record<string, unknown> }[]
  /** países posibles como distractor por grupo ("text" o "<categoría>|<subcategoría>") */
  pools: Record<string, string[]>
}
