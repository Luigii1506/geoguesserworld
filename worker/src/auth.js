// Cuentas de GeoMastery: Better Auth con correo y contraseña sobre Neon (Postgres).
//
//   /api/auth/…     rutas de Better Auth (sign-up/email, sign-in/email, sign-out, get-session…)
//
// Solo pueden registrarse los correos de ALLOWED_EMAILS (separados por comas). La sesión va
// en una cookie del mismo dominio que la app (el Worker sirve las dos). Para no consultar
// Neon en cada foto, Better Auth guarda una copia firmada de la sesión en otra cookie
// (cookieCache, 10 min): comprobarla es solo verificar una firma.
//
// Variables del Worker:
//   BETTER_AUTH_URL      (wrangler.toml) URL pública de la app
//   BETTER_AUTH_SECRET   (secreto) firma de las cookies
//   DATABASE_URL         (secreto) Neon
//   ALLOWED_EMAILS       (secreto) correos invitados
//
// Las tablas se crean con: node worker/scripts/auth-migrate.mjs
import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { NeonHttpDialect } from './db/neon.js'

const DAY = 60 * 60 * 24

const allowedEmails = (env) => new Set(String(env.ALLOWED_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))

/** Opciones de Better Auth (las usan el Worker y el script de migración). */
export function authOptions(env) {
  const allowed = allowedEmails(env)
  return {
    appName: 'GeoMastery',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: { dialect: new NeonHttpDialect(env.DATABASE_URL), type: 'postgres', transaction: false },
    emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 10 },
    session: {
      expiresIn: 60 * DAY,
      updateAge: DAY,
      cookieCache: { enabled: true, maxAge: 10 * 60 },
    },
    // límite de intentos guardado en Neon: los isolates del Worker no comparten memoria
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!allowed.has(String(user.email).toLowerCase())) throw new APIError('FORBIDDEN', { message: 'Este correo no está invitado' })
          },
        },
      },
    },
    telemetry: { enabled: false },
  }
}

let cached = null
/** Instancia de Better Auth (una por isolate: la conexión a Neon es por HTTP). */
export function getAuth(env) {
  if (!env.DATABASE_URL || !env.BETTER_AUTH_SECRET) return null
  cached ??= betterAuth(authOptions(env))
  return cached
}

/** Sesión de la petición, o null. */
export async function sessionOf(env, request) {
  const auth = getAuth(env)
  if (!auth) return null
  return auth.api.getSession({ headers: request.headers }).catch(() => null)
}
