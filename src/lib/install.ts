import { useEffect, useState, useSyncExternalStore } from 'react'

// Instalar la app (PWA): Chrome y Android avisan con «beforeinstallprompt» y la app puede
// ofrecer el botón; en iPhone no hay aviso: se explica cómo hacerlo (Compartir → Añadir a
// pantalla de inicio). Si ya está instalada, no se ofrece nada.

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: PromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as PromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
export const isIos = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)

/** Cómo se puede instalar aquí: con el aviso del navegador, a mano (iPhone) o nada. */
export function useInstall(): { mode: 'prompt' | 'ios' | null; install: () => Promise<void> } {
  const ready = useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), () => Boolean(deferred))
  const mode = isStandalone() ? null : ready ? 'prompt' : isIos() ? 'ios' : null
  return {
    mode,
    install: async () => {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice.catch(() => null)
      deferred = null
      listeners.forEach((l) => l())
    },
  }
}

/** ¿Hay conexión? (para avisar de que se ve lo guardado en el dispositivo) */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
