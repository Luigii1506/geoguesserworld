// Dónde se cargan las imágenes propias (/images/<tamaño>/ab/<sha1>.<formato>).
//   · en local: las sirve Vite desde data/images
//   · fuera de tu Mac: el Worker del bucket R2 privado, con
//       VITE_IMAGE_BASE=https://<worker>.workers.dev  y  VITE_IMAGE_KEY=<clave>
// Tamaños: img (1600 px, visor) · thumb (480 px) · sm (240 px, cuadrículas del móvil).
// Formatos: webp (todas) y avif (thumb y sm; ver pipeline/variants.mjs).
// Las URLs que no son copia propia (aún sin descargar) se usan tal cual.

const BASE = (import.meta.env.VITE_IMAGE_BASE as string | undefined)?.replace(/\/+$/, '')
const KEY = import.meta.env.VITE_IMAGE_KEY as string | undefined
const OWN = /^\/images\/(?:img|thumb|sm)\/([0-9a-f]{2}\/[0-9a-f]{40})\.(?:webp|avif)$/

export type ImageSize = 'img' | 'thumb' | 'sm'
export const isOwnImage = (url: string) => OWN.test(url)

/** URL para pintar una imagen: `thumb` (480 px) en galerías, `img` (1600 px) en el visor. */
export function imageSrc(url: string, size: ImageSize = 'img', format: 'webp' | 'avif' = 'webp'): string {
  const m = url.match(OWN)
  if (!m) return url
  const path = `${size}/${m[1]}.${format}`
  return BASE ? `${BASE}/${path}${KEY ? `?k=${encodeURIComponent(KEY)}` : ''}` : `/images/${path}`
}

// ── Wikimedia Commons: miniaturas directas (las calcula el pipeline, pipeline/geo/lib/wikimedia.mjs) ──
const COMMONS_THUMB = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)\/)(\d+)px-(.+)$/

/** La misma miniatura de Commons con otro ancho (o null si no es una miniatura directa). */
export function commonsWidth(url: string, width: number): string | null {
  const m = url.match(COMMONS_THUMB)
  return m ? `${m[1]}${width}px-${m[4]}` : null
}
/** Respaldo de una miniatura directa: Special:FilePath (redirige, pero nunca falla por tamaño). */
export function commonsFallback(url: string, width: number): string | null {
  const m = url.match(COMMONS_THUMB)
  return m ? `https://commons.wikimedia.org/wiki/Special:FilePath/${m[2]}?width=${width}` : null
}
