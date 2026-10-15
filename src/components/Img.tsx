import { useState, type ImgHTMLAttributes } from 'react'
import { commonsFallback, commonsWidth, imageSrc, isOwnImage, type ImageSize } from '../lib/images'

/**
 * Imagen ligera: elige formato y tamaño según la pantalla.
 *   · fotos propias en galería (size "thumb"): <picture> AVIF/WebP de 240 o 480 px
 *   · fotos propias en el visor (size "img"): 1600 px
 *   · Wikimedia: miniatura directa de 330 o 500 px (si falla, por Special:FilePath)
 * Aparece con un fundido al cargar y recurre al original si una variante no existe.
 */
export function Img({ src, size = 'thumb', sizes = '(max-width: 600px) 46vw, 260px', className, alt = '', ...rest }: {
  src: string
  size?: ImageSize
  sizes?: string
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'sizes'>) {
  const [fallback, setFallback] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const { onError, ...other } = rest
  const cls = `img-fade ${loaded ? 'is-loaded' : ''} ${className ?? ''}`
  // el onError de quien la usa, solo cuando ya no queda respaldo
  const common = { alt, decoding: 'async' as const, loading: other.loading ?? ('lazy' as const), onLoad: () => setLoaded(true), ...other, className: cls, onError }

  if (isOwnImage(src) && size !== 'img' && !fallback) {
    return (
      <picture>
        <source type="image/avif" srcSet={`${imageSrc(src, 'sm', 'avif')} 240w, ${imageSrc(src, 'thumb', 'avif')} 480w`} sizes={sizes} />
        <img {...common} src={imageSrc(src, 'thumb')} srcSet={`${imageSrc(src, 'sm')} 240w, ${imageSrc(src, 'thumb')} 480w`} sizes={sizes} onError={() => setFallback(true)} />
      </picture>
    )
  }
  if (isOwnImage(src)) return <img {...common} src={imageSrc(src, size)} />

  // miniatura de Commons: la misma más pequeña para pantallas estrechas
  const width = Number(src.match(/\/(\d+)px-[^/]+$/)?.[1] ?? 0)
  const small = width > 330 ? commonsWidth(src, 330) : null
  if (small && !fallback) {
    return <img {...common} src={src} srcSet={`${small} 330w, ${src} ${width}w`} sizes={sizes} onError={() => setFallback(true)} />
  }
  return <img {...common} src={(fallback && commonsFallback(src, width || 500)) || src} />
}
