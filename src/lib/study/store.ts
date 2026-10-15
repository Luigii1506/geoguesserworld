import { useSyncExternalStore } from 'react'
import { fromSm2, rate } from './fsrs'
import { DEFAULT_SETTINGS, type CardRec, type Deck, type Grade, type ItemData, type ItemKind, type Review, type Settings, type StudyItem } from './types'

// Estudio de cada usuario en el dispositivo (IndexedDB: sin el límite de ~5 MB de
// localStorage). Cada cambio queda marcado como pendiente y sync.ts lo sube a su cuenta;
// lo que llega de otros dispositivos se mezcla aquí (gana el cambio más reciente).
// En `npm run dev` no hay cuentas: el estudio es del dispositivo ("local").

export interface StudyState {
  owner: string | null
  ready: boolean
  items: Record<string, StudyItem>
  decks: Record<string, Deck>
  cards: Record<string, CardRec>
  reviews: Review[]
  settings: { data: Settings; updated_at: number }
  /** cursor de la última sincronización (hora del servidor) */
  cursor: string | null
  dirty: { items: string[]; decks: string[]; cards: string[]; reviews: string[]; settings: boolean }
}

const MAX_REVIEWS = 30_000
const DB = 'geomastery'
const STORE = 'study'

const empty = (owner: string | null): StudyState => ({
  owner, ready: false, items: {}, decks: {}, cards: {}, reviews: [],
  settings: { data: DEFAULT_SETTINGS, updated_at: 0 }, cursor: null,
  dirty: { items: [], decks: [], cards: [], reviews: [], settings: false },
})

let state: StudyState = empty(null)
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

// ── IndexedDB (una fila por usuario) ──
function idb(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => ok(req.result)
    req.onerror = () => fail(req.error)
  })
}
async function readState(owner: string): Promise<StudyState | null> {
  try {
    const db = await idb()
    return await new Promise((ok) => {
      const req = db.transaction(STORE).objectStore(STORE).get(owner)
      req.onsuccess = () => ok((req.result as StudyState | undefined) ?? null)
      req.onerror = () => ok(null)
    })
  } catch {
    return null
  }
}
let saveTimer = 0
function persist() {
  window.clearTimeout(saveTimer)
  const snapshot = state
  saveTimer = window.setTimeout(async () => {
    if (!snapshot.owner) return
    try {
      const db = await idb()
      db.transaction(STORE, 'readwrite').objectStore(STORE).put({ ...snapshot, ready: false }, snapshot.owner)
    } catch {
      /* sin almacenamiento: sigue en memoria */
    }
  }, 300)
}

function commit(next: StudyState) {
  state = next
  persist()
  emit()
  changed()
}
// sync.ts se suscribe para subir los cambios
let onChange: () => void = () => {}
const changed = () => onChange()
export const onLocalChange = (fn: () => void) => void (onChange = fn)

const uniq = (a: string[]) => [...new Set(a)]
const mark = (s: StudyState, kind: 'items' | 'decks' | 'cards' | 'reviews', keys: string[]) => ({ ...s.dirty, [kind]: uniq([...s.dirty[kind], ...keys]) })

// ── progreso de la versión 1 (localStorage, SM-2) ──
const V1 = 'geomastery.v1'
function migrateV1(s: StudyState): StudyState {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(V1)
  } catch {
    return s
  }
  if (!raw) return s
  try {
    const v1 = JSON.parse(raw) as { srs?: Record<string, Parameters<typeof fromSm2>[0]>; log?: { date: string; questionId: string; correct: boolean; ms: number }[] }
    const now = Date.now()
    const cards = { ...s.cards }
    for (const [key, sm2] of Object.entries(v1.srs ?? {})) if (key.includes(':') && !cards[key]) cards[key] = { key, state: fromSm2(sm2), updated_at: now }
    const reviews: Review[] = (v1.log ?? []).map((l, i) => ({
      id: `v1-${Date.parse(l.date)}-${i}`, card: l.questionId, rating: l.correct ? 3 : 1, ms: l.ms, at: Date.parse(l.date),
    }))
    localStorage.setItem(`${V1}.migrado`, raw)
    localStorage.removeItem(V1)
    return {
      ...s,
      cards,
      reviews: [...s.reviews, ...reviews].slice(-MAX_REVIEWS),
      dirty: { ...s.dirty, cards: uniq([...s.dirty.cards, ...Object.keys(cards)]), reviews: uniq([...s.dirty.reviews, ...reviews.map((r) => r.id)]) },
    }
  } catch {
    return s
  }
}

/** Carga el estudio de un usuario (o "local" sin cuentas). */
export async function openStudy(owner: string) {
  if (state.owner === owner && state.ready) return
  state = { ...empty(owner), ready: false }
  emit()
  const saved = await readState(owner)
  const base = saved ? { ...empty(owner), ...saved, owner } : empty(owner)
  state = { ...migrateV1(base), ready: true }
  persist()
  emit()
  changed()
}

/** Al salir: el estudio de esa cuenta deja de estar en pantalla (sigue guardado para cuando vuelva). */
export function closeStudy() {
  state = empty(null)
  emit()
}

export const getStudy = () => state
export function useStudy(): StudyState {
  return useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), () => state)
}

// ── guardados ──
export const itemKey = {
  hint: (clusterId: number) => `t:${clusterId}`,
  photo: (img: string) => `f:${img}`,
  place: (entityId: string) => `g:${entityId}`,
}

export const isSaved = (s: StudyState, key: string) => Boolean(s.items[key] && !s.items[key].deleted)
export const savedItems = (s: StudyState) => Object.values(s.items).filter((i) => !i.deleted)
export const liveDecks = (s: StudyState) => Object.values(s.decks).filter((d) => !d.deleted).sort((a, b) => a.name.localeCompare(b.name, 'es'))

export interface NewItem {
  key: string
  kind: ItemKind
  cc: string | null
  data: ItemData
}

/** Guarda (o vuelve a guardar) cosas para estudiar, en los mazos indicados. */
export function saveItems(list: NewItem[], decks: string[] = []) {
  if (!list.length) return
  const now = Date.now()
  const items = { ...state.items }
  for (const it of list) {
    const prev = items[it.key]
    const keep = prev && !prev.deleted ? prev.decks : []
    items[it.key] = {
      key: it.key, kind: it.kind, cc: it.cc, data: it.data,
      decks: uniq([...keep, ...decks]), note: prev?.note ?? '',
      created_at: prev && !prev.deleted ? prev.created_at : now, updated_at: now,
    }
  }
  commit({ ...state, items, dirty: mark(state, 'items', list.map((i) => i.key)) })
}

function patchItem(key: string, patch: Partial<StudyItem>) {
  const prev = state.items[key]
  if (!prev) return
  commit({ ...state, items: { ...state.items, [key]: { ...prev, ...patch, updated_at: Date.now() } }, dirty: mark(state, 'items', [key]) })
}
export const unsaveItem = (key: string) => patchItem(key, { deleted: true, decks: [] })
export const setNote = (key: string, note: string) => patchItem(key, { note })
export const setItemDecks = (key: string, decks: string[]) => patchItem(key, { decks: uniq(decks) })

// ── mazos ──
const newId = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)

export function createDeck(name: string): string {
  const clean = name.trim().slice(0, 120)
  const existing = liveDecks(state).find((d) => d.name.toLowerCase() === clean.toLowerCase())
  if (existing) return existing.id
  const id = newId()
  commit({ ...state, decks: { ...state.decks, [id]: { id, name: clean, updated_at: Date.now() } }, dirty: mark(state, 'decks', [id]) })
  return id
}
export function renameDeck(id: string, name: string) {
  const d = state.decks[id]
  if (!d || !name.trim()) return
  commit({ ...state, decks: { ...state.decks, [id]: { ...d, name: name.trim().slice(0, 120), updated_at: Date.now() } }, dirty: mark(state, 'decks', [id]) })
}
/** Borra el mazo; lo guardado se queda (sin ese mazo). */
export function deleteDeck(id: string) {
  const d = state.decks[id]
  if (!d) return
  const now = Date.now()
  const touched = savedItems(state).filter((i) => i.decks.includes(id))
  const items = { ...state.items }
  for (const i of touched) items[i.key] = { ...i, decks: i.decks.filter((x) => x !== id), updated_at: now }
  const next = { ...state, decks: { ...state.decks, [id]: { ...d, deleted: true, updated_at: now } }, items }
  commit({ ...next, dirty: { ...mark(next, 'decks', [id]), items: uniq([...state.dirty.items, ...touched.map((i) => i.key)]) } })
}

// ── repasos ──
export function reviewCard(card: string, grade: Grade, extra: { cc?: string | null; answer?: string | null; ms?: number } = {}) {
  const now = new Date()
  const prev = state.cards[card]
  const rec: CardRec = { key: card, state: rate(prev?.state, grade, now), updated_at: now.getTime() }
  const review: Review = { id: newId(), card, rating: grade, at: now.getTime(), cc: extra.cc ?? null, answer: extra.answer ?? null, ms: extra.ms }
  const next = { ...state, cards: { ...state.cards, [card]: rec }, reviews: [...state.reviews, review].slice(-MAX_REVIEWS) }
  commit({ ...next, dirty: { ...mark(next, 'cards', [card]), reviews: [...state.dirty.reviews, review.id] } })
}

// ── ajustes ──
export function setSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { data: { ...state.settings.data, ...patch }, updated_at: Date.now() }, dirty: { ...state.dirty, settings: true } })
}

// ── sincronización (la usa sync.ts) ──
const BATCH = 2000
export function pendingChanges() {
  const s = state
  const reviewIds = new Set(s.dirty.reviews.slice(0, BATCH))
  return {
    decks: s.dirty.decks.slice(0, BATCH).map((k) => s.decks[k]).filter(Boolean),
    items: s.dirty.items.slice(0, BATCH).map((k) => s.items[k]).filter(Boolean),
    cards: s.dirty.cards.slice(0, BATCH).map((k) => s.cards[k]).filter(Boolean),
    reviews: s.reviews.filter((r) => reviewIds.has(r.id)),
    settings: s.dirty.settings ? s.settings : undefined,
    more: s.dirty.decks.length > BATCH || s.dirty.items.length > BATCH || s.dirty.cards.length > BATCH || s.dirty.reviews.length > BATCH,
  }
}
export const hasPending = () => {
  const d = state.dirty
  return d.decks.length + d.items.length + d.cards.length + d.reviews.length > 0 || d.settings
}

type Remote = {
  cursor: string
  decks: Deck[]
  items: StudyItem[]
  cards: CardRec[]
  reviews: Review[]
  settings: { data: Settings; updated_at: number } | null
}

/**
 * Tras una sincronización: lo subido deja de estar pendiente (si no cambió mientras tanto) y
 * lo que llega de otros dispositivos se mezcla (gana el más reciente; los repasos se suman).
 */
export function applySync(owner: string, sent: ReturnType<typeof pendingChanges>, remote: Remote) {
  if (state.owner !== owner) return
  const s = state
  const sentAt = (list: { updated_at: number }[], key: (x: never) => string) => new Map(list.map((x) => [key(x as never), x.updated_at]))
  const sentDecks = sentAt(sent.decks, (d: Deck) => d.id)
  const sentItems = sentAt(sent.items, (i: StudyItem) => i.key)
  const sentCards = sentAt(sent.cards, (c: CardRec) => c.key)
  const sentReviews = new Set(sent.reviews.map((r) => r.id))

  const merge = <T extends { updated_at: number }>(local: Record<string, T>, incoming: T[], key: (x: T) => string) => {
    const out = { ...local }
    for (const x of incoming) {
      const k = key(x)
      if (!out[k] || out[k].updated_at < x.updated_at) out[k] = x
    }
    return out
  }
  const decks = merge(s.decks, remote.decks, (d) => d.id)
  const items = merge(s.items, remote.items.map((i) => ({ ...i, note: i.note ?? '', decks: i.decks ?? [] })), (i) => i.key)
  const cards = merge(s.cards, remote.cards, (c) => c.key)
  const known = new Set(s.reviews.map((r) => r.id))
  const reviews = [...s.reviews, ...remote.reviews.filter((r) => !known.has(r.id))].sort((a, b) => a.at - b.at).slice(-MAX_REVIEWS)
  const settings = remote.settings && remote.settings.updated_at > s.settings.updated_at
    ? { data: { ...DEFAULT_SETTINGS, ...remote.settings.data }, updated_at: remote.settings.updated_at }
    : s.settings

  // sigue pendiente lo que cambió después de enviarlo
  const still = (keys: string[], sentMap: Map<string, number>, now: Record<string, { updated_at: number }>) =>
    keys.filter((k) => !sentMap.has(k) || (now[k]?.updated_at ?? 0) > (sentMap.get(k) ?? 0))
  state = {
    ...s, decks, items, cards, reviews, settings, cursor: remote.cursor,
    dirty: {
      decks: still(s.dirty.decks, sentDecks, s.decks),
      items: still(s.dirty.items, sentItems, s.items),
      cards: still(s.dirty.cards, sentCards, s.cards),
      reviews: s.dirty.reviews.filter((id) => !sentReviews.has(id)),
      settings: s.dirty.settings && (!sent.settings || s.settings.updated_at > sent.settings.updated_at),
    },
  }
  persist()
  emit()
}

// ── copia de seguridad ──
export function exportStudy(): string {
  const { items, decks, cards, reviews, settings } = state
  return JSON.stringify({ version: 2, items, decks, cards, reviews, settings }, null, 1)
}
export function importStudy(json: string): boolean {
  try {
    const x = JSON.parse(json)
    if (x.version !== 2 || typeof x.items !== 'object') return false
    const now = Date.now()
    const bump = <T extends object>(o: Record<string, T>) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, { ...v, updated_at: now }]))
    const known = new Set(state.reviews.map((r) => r.id))
    const next: StudyState = {
      ...state,
      items: { ...state.items, ...bump(x.items) },
      decks: { ...state.decks, ...bump(x.decks) },
      cards: { ...state.cards, ...bump(x.cards) },
      reviews: [...state.reviews, ...((x.reviews ?? []) as Review[]).filter((r) => !known.has(r.id))].sort((a, b) => a.at - b.at).slice(-MAX_REVIEWS),
    }
    commit({
      ...next,
      dirty: {
        items: uniq([...state.dirty.items, ...Object.keys(x.items ?? {})]),
        decks: uniq([...state.dirty.decks, ...Object.keys(x.decks ?? {})]),
        cards: uniq([...state.dirty.cards, ...Object.keys(x.cards ?? {})]),
        reviews: uniq([...state.dirty.reviews, ...((x.reviews ?? []) as Review[]).map((r) => r.id)]),
        settings: state.dirty.settings,
      },
    })
    return true
  } catch {
    return false
  }
}
