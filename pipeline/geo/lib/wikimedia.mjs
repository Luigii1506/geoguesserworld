// URLs directas de miniaturas de Wikimedia Commons. Special:FilePath redirige
// (un viaje más por foto) y, sin ?width, sirve el original (a veces varios MB).
// La miniatura directa se calcula sin pedir nada: /thumb/<a>/<ab>/<archivo>/<w>px-<archivo>,
// con <ab> = MD5 del nombre. Anchos estándar de Wikimedia (los que tiene en caché).
import { createHash } from 'node:crypto'

export const THUMB_WIDTH = 500
export const IMAGE_WIDTH = 960

/** Nombre del archivo de una URL de Special:FilePath (o null si no lo es). */
export function commonsFile(url) {
  const m = url?.match(/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^?#]+)/)
  if (!m) return null
  const name = decodeURIComponent(m[1]).replace(/ /g, '_')
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** Miniatura directa de `width` px (o la URL original si el formato no la admite). */
export function commonsThumb(url, width) {
  const name = commonsFile(url)
  if (!name) return url
  const ext = name.split('.').pop().toLowerCase()
  // formatos cuya miniatura cambia de nombre (PDF, vídeo, TIFF…): se deja FilePath
  const suffix = ext === 'svg' ? '.png' : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? '' : null
  if (suffix === null) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`
  const h = createHash('md5').update(name).digest('hex')
  const enc = encodeURIComponent(name)
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${enc}/${width}px-${enc}${suffix}`
}
