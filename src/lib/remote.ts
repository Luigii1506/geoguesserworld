// Dónde están los datos (API, fotos, capas del atlas y guías):
//   · app publicada: el mismo Worker que la sirve (mismo origen; la sesión va en una cookie)
//   · `npm run dev`: Vite sobre data/ y public/community, sin sesión
//   · `npm run dev` con VITE_API_BASE=https://…workers.dev: los datos de producción, con la
//     clave de herramientas VITE_IMAGE_KEY (solo en desarrollo: nunca entra en la build)

const env = import.meta.env
const DEV_REMOTE = env.DEV ? ((env.VITE_API_BASE as string | undefined) ?? '').replace(/\/+$/, '') : ''
const DEV_KEY = env.DEV && DEV_REMOTE ? (env.VITE_IMAGE_KEY as string | undefined) : undefined

/** Datos servidos por Vite (rutas sin huella, fotos en /images/…). */
export const LOCAL = Boolean(env.DEV && !DEV_REMOTE)

/** ¿Hace falta iniciar sesión? (la app publicada; en desarrollo, nunca) */
export const NEEDS_LOGIN = !env.DEV

/** URL de un recurso de datos (`/api/…`, `/atlas/…`, `/thumb/…`, `/community/…`). */
export function remoteUrl(path: string): string {
  const url = `${DEV_REMOTE}${path}`
  return DEV_KEY ? `${url}${url.includes('?') ? '&' : '?'}k=${encodeURIComponent(DEV_KEY)}` : url
}

/** Avisa a la app de que la sesión caducó (una respuesta 401). */
export function checkAuth(r: Response): Response {
  if (r.status === 401 && NEEDS_LOGIN) window.dispatchEvent(new Event('auth:expired'))
  return r
}
