import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { auth, UserContext, type User } from '../lib/auth'
import { resetManifest } from '../lib/data'
import { NEEDS_LOGIN } from '../lib/remote'

// La app publicada pide iniciar sesión antes de cargar ningún dato (en `npm run dev`, no).
// Si la sesión caduca a mitad (una respuesta 401), vuelve a esta pantalla y, al entrar,
// recarga para repetir lo que falló.

// el punto: 30° N, 45° E en el mismo globo inclinado
const TILT_SIN = Math.sin((20 * Math.PI) / 180)
const TILT_COS = Math.cos((20 * Math.PI) / 180)
const PIN = {
  x: 92 * Math.cos(Math.PI / 6) * Math.sin(Math.PI / 4),
  y: -92 * Math.sin(Math.PI / 6) * TILT_COS + 92 * Math.cos(Math.PI / 6) * Math.cos(Math.PI / 4) * TILT_SIN,
}

type State = { status: 'loading' } | { status: 'out'; expired: boolean } | { status: 'in'; user: User | null }

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(NEEDS_LOGIN ? { status: 'loading' } : { status: 'in', user: null })

  useEffect(() => {
    if (!NEEDS_LOGIN) return
    auth.current().then((user) => setState(user ? { status: 'in', user } : { status: 'out', expired: false }))
    const expired = () => setState({ status: 'out', expired: true })
    window.addEventListener('auth:expired', expired)
    return () => window.removeEventListener('auth:expired', expired)
  }, [])

  if (state.status === 'loading') return <div className="page-loading" aria-busy="true" />
  if (state.status === 'out') {
    return (
      <Login
        expired={state.expired}
        onDone={(user) => {
          if (state.expired) return window.location.reload()
          resetManifest()
          setState({ status: 'in', user })
        }}
      />
    )
  }
  const signOut = () => auth.signOut().finally(() => setState({ status: 'out', expired: false }))
  return <UserContext.Provider value={{ user: state.user, signOut }}>{children}</UserContext.Provider>
}

function Login({ expired, onDone }: { expired: boolean; onDone: (user: User) => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onDone(mode === 'in' ? await auth.signIn(email.trim(), password) : await auth.signUp(name.trim() || email.split('@')[0], email.trim(), password))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-art" aria-hidden="true">
        <svg viewBox="-100 -100 200 200">
          <circle r="92" />
          {/* paralelos vistos con el globo algo inclinado (20°): elipses aplanadas, más altas al norte */}
          {[-60, -30, 0, 30, 60].map((lat) => (
            <ellipse key={`p${lat}`} cy={-92 * Math.sin((lat * Math.PI) / 180) * TILT_COS} rx={92 * Math.cos((lat * Math.PI) / 180)} ry={92 * Math.cos((lat * Math.PI) / 180) * TILT_SIN} />
          ))}
          {[15, 45, 75].map((lon) => <ellipse key={`m${lon}`} rx={92 * Math.sin((lon * Math.PI) / 180)} ry="92" />)}
          <line x1="0" y1="-92" x2="0" y2="92" />
          <circle className="login-pin" cx={PIN.x} cy={PIN.y} r="3.2" />
        </svg>
      </div>

      <div className="login-panel">
        <p className="login-brand">GeoMastery</p>
        <h1>{mode === 'in' ? 'Mira. Reconoce. Ubica.' : 'Crea tu cuenta'}</h1>
        <p className="login-lead">
          {expired
            ? 'Tu sesión ha caducado. Entra de nuevo para seguir donde estabas.'
            : mode === 'in'
              ? 'Tu academia de geografía para GeoGuessr. Entra para ver las guías, los mapas y tu repaso.'
              : 'Solo para correos invitados. Usa el correo con el que te invitaron.'}
        </p>

        <form className="login-form" onSubmit={submit}>
          {mode === 'up' && (
            <label>
              <span>Nombre</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Cómo quieres que te llamemos" />
            </label>
          )}
          <label>
            <span>Correo</span>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
          </label>
          <label>
            <span>Contraseña</span>
            <input
              className="input"
              type="password"
              required
              minLength={mode === 'up' ? 10 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              placeholder={mode === 'up' ? 'Al menos 10 caracteres' : undefined}
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}</button>
        </form>

        <p className="login-switch">
          {mode === 'in' ? '¿Primera vez? ' : '¿Ya tienes cuenta? '}
          <button className="link" type="button" onClick={() => (setMode(mode === 'in' ? 'up' : 'in'), setError(''))}>
            {mode === 'in' ? 'Crea tu cuenta' : 'Entra'}
          </button>
        </p>
      </div>
    </div>
  )
}
