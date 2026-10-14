import { useSyncExternalStore } from 'react'
import type { Sm2State } from './sm2'

// Progreso personal: vive en localStorage, exportable/importable como JSON.

export type MasteryLevel = 0 | 1 | 2 | 3 // nuevo · visto · aprendiendo · dominado

export interface LogEntry {
  date: string
  questionId: string
  correct: boolean
  ms: number
  mode: 'practica' | 'repaso' | 'lab'
}

export interface Progress {
  version: 1
  srs: Record<string, Sm2State>
  clueMastery: Record<string, MasteryLevel>
  log: LogEntry[]
}

const KEY = 'geomastery.v1'

function emptyProgress(): Progress {
  return { version: 1, srs: {}, clueMastery: {}, log: [] }
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProgress()
    const parsed = JSON.parse(raw) as Progress
    if (parsed.version !== 1) return emptyProgress()
    return { ...emptyProgress(), ...parsed }
  } catch {
    return emptyProgress()
  }
}

let state: Progress = load()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // sin almacenamiento disponible: la sesión sigue funcionando en memoria
  }
}

export function getProgress(): Progress {
  return state
}

export function updateProgress(fn: (p: Progress) => Progress) {
  state = fn(state)
  persist()
  listeners.forEach((l) => l())
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress)
}

export function exportProgress(): string {
  return JSON.stringify(state, null, 2)
}

export function importProgress(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as Progress
    if (parsed.version !== 1 || typeof parsed.srs !== 'object') return false
    state = { ...emptyProgress(), ...parsed }
    persist()
    listeners.forEach((l) => l())
    return true
  } catch {
    return false
  }
}

export function resetProgress() {
  state = emptyProgress()
  persist()
  listeners.forEach((l) => l())
}
