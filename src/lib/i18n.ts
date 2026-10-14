import { useSyncExternalStore } from 'react'
import type { Hint } from './data'

// Idioma del contenido de las pistas (la interfaz está en español).

export type Lang = 'es' | 'en'
const KEY = 'geomastery.lang'

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

let current: Lang = read()
const listeners = new Set<() => void>()

export function setLang(lang: Lang) {
  current = lang
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
  listeners.forEach((l) => l())
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}

/** Texto de una pista en el idioma elegido, con el original como respaldo. */
export function hintText(h: Pick<Hint, 'text' | 'text_es' | 'text_en'>, lang: Lang): string {
  return (lang === 'es' ? h.text_es : h.text_en) ?? h.text ?? ''
}
