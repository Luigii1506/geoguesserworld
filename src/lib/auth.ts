import { createContext, useContext } from 'react'
import { NEEDS_LOGIN } from './remote'

// Cuentas (Better Auth en el Worker, /api/auth/…). Llamadas directas a sus rutas en lugar
// del cliente de Better Auth: son cuatro y así la app no carga otra librería.

export interface User {
  id: string
  email: string
  name: string
}

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Correo o contraseña incorrectos.',
  USER_ALREADY_EXISTS: 'Ya hay una cuenta con ese correo. Entra con tu contraseña.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Ya hay una cuenta con ese correo. Entra con tu contraseña.',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 10 caracteres.',
  INVALID_EMAIL: 'Ese correo no es válido.',
  FORBIDDEN: 'Este correo no está invitado. Pide acceso a quien administra GeoMastery.',
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/auth/${path}`, body === undefined
    ? { credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await r.json().catch(() => null)
  if (r.status === 503) throw new Error('Las cuentas no están disponibles ahora mismo. Prueba en unos minutos.')
  if (r.status === 429) throw new Error('Demasiados intentos. Espera un minuto y vuelve a probar.')
  if (!r.ok) throw new Error(MESSAGES[data?.code] ?? data?.message ?? `No se pudo completar (${r.status}).`)
  return data as T
}

export const auth = {
  /** Usuario con sesión iniciada, o null. */
  async current(): Promise<User | null> {
    if (!NEEDS_LOGIN) return null
    const s = await call<{ user: User } | null>('get-session').catch(() => null)
    return s?.user ?? null
  },
  signIn: (email: string, password: string) => call<{ user: User }>('sign-in/email', { email, password, rememberMe: true }).then((r) => r.user),
  signUp: (name: string, email: string, password: string) => call<{ user: User }>('sign-up/email', { name, email, password }).then((r) => r.user),
  signOut: () => call('sign-out', {}),
}

/** Usuario de la sesión (null en desarrollo, donde no hay cuentas). */
export const UserContext = createContext<{ user: User | null; signOut: () => void }>({ user: null, signOut: () => {} })
export const useUser = () => useContext(UserContext)
