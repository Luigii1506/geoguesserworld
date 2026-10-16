// Versión nueva publicada con la app abierta: cada página se descarga al abrirla (React.lazy)
// y sus archivos llevan una huella en el nombre (Maps-Cq7GfQPP.js). Al publicar cambian, así que
// una pestaña de la versión anterior pide archivos que ya no existen. Entonces se recarga una
// vez (como mucho cada 30 s, para no entrar en bucle si el fallo es otro, p. ej. sin red).

const KEY = 'geomastery.reloadedAt'
const MIN_GAP = 30_000

/** ¿El error es de una página que no se pudo descargar? */
export function isStaleChunk(error: unknown): boolean {
  const msg = String((error as Error)?.message ?? error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(msg)
}

/** Recarga para pasar a la versión nueva (si no se acaba de hacer). Devuelve si recargó. */
export function reloadForNewVersion(): boolean {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0)
  } catch {
    /* sin almacenamiento */
  }
  if (Date.now() - last < MIN_GAP) return false
  try {
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* sin almacenamiento */
  }
  window.location.reload()
  return true
}
