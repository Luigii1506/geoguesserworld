import { useSyncExternalStore } from 'react'
import { NEEDS_LOGIN, checkAuth } from '../remote'
import { applySync, getStudy, hasPending, onLocalChange, pendingChanges } from './store'

// Sincroniza el estudio del dispositivo con la cuenta (POST /api/me/sync, worker/src/me.js):
//   · al abrir la app y al volver a ella (pestaña visible, conexión recuperada)
//   · 2 s después de cada cambio (varias respuestas seguidas van en un solo envío)
//   · cada 5 min mientras está abierta, por si otro dispositivo cambió algo
// Sin conexión no pasa nada: los cambios esperan en el dispositivo y se envían después.

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error'

let status: SyncStatus = NEEDS_LOGIN ? 'idle' : 'off'
let lastSync = 0
const listeners = new Set<() => void>()
const setStatus = (s: SyncStatus) => {
  status = s
  listeners.forEach((l) => l())
}
export const useSyncStatus = () => useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), () => status)
export const lastSyncAt = () => lastSync

let running: Promise<void> | null = null
let again = false
let timer = 0

/** Una pasada de sincronización (si ya hay una en marcha, se repite al acabar). */
export function syncNow(): Promise<void> {
  if (!NEEDS_LOGIN) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      const s = getStudy()
      if (!s.owner || !s.ready) return
      if (!navigator.onLine) return setStatus('offline')
      setStatus('syncing')
      const sent = pendingChanges()
      try {
        const r = await fetch('/api/me/sync', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ since: s.cursor, decks: sent.decks, items: sent.items, cards: sent.cards, reviews: sent.reviews, settings: sent.settings }),
        }).then(checkAuth)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        applySync(s.owner, sent, await r.json())
        lastSync = Date.now()
        // quedaba más de un lote, o hubo cambios mientras tanto
        if (sent.more) again = true
        setStatus('idle')
      } catch {
        setStatus(navigator.onLine ? 'error' : 'offline')
        return
      }
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

/** Empieza a sincronizar (una vez, al cargar el estudio de la cuenta). */
let started = false
export function startSync() {
  if (!NEEDS_LOGIN || started) return
  started = true
  onLocalChange(() => {
    window.clearTimeout(timer)
    if (hasPending()) timer = window.setTimeout(() => void syncNow(), 2000)
  })
  const wake = () => void syncNow()
  window.addEventListener('online', wake)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') wake()
    // al irse, se intenta enviar lo pendiente
    else if (hasPending()) wake()
  })
  window.setInterval(() => document.visibilityState === 'visible' && wake(), 5 * 60_000)
  wake()
}
