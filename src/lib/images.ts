// Dónde se cargan las imágenes propias (/images/img|thumb/ab/<sha1>.webp).
//   · en local: las sirve Vite desde data/images
//   · fuera de tu Mac: el Worker del bucket R2 privado, con
//       VITE_IMAGE_BASE=https://<worker>.workers.dev  y  VITE_IMAGE_KEY=<clave>
// Las URLs que no son copia propia (aún sin descargar) se usan tal cual.

const BASE = (import.meta.env.VITE_IMAGE_BASE as string | undefined)?.replace(/\/+$/, '')
const KEY = import.meta.env.VITE_IMAGE_KEY as string | undefined
const OWN = /^\/images\/(?:img|thumb)\/(.+)$/

export type ImageSize = 'img' | 'thumb'

/** URL para pintar una imagen: `thumb` (480 px) en galerías, `img` (1600 px) en el visor. */
export function imageSrc(url: string, size: ImageSize = 'img'): string {
  const m = url.match(OWN)
  if (!m) return url
  const path = `${size}/${m[1]}`
  return BASE ? `${BASE}/${path}${KEY ? `?k=${encodeURIComponent(KEY)}` : ''}` : `/images/${path}`
}
