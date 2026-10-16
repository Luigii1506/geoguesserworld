import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { imageSrc } from '../lib/images'

/**
 * Visor de fotos a pantalla completa, con gestos:
 *   · deslizar a los lados: foto anterior o siguiente (con rebote en los extremos)
 *   · deslizar hacia abajo: cerrar (la foto sigue al dedo y el fondo se aclara)
 *   · tocar fuera de la foto: cerrar · tocar la foto: ocultar o mostrar los controles
 *   · doble toque: ampliar donde tocaste (otra vez, volver) · pellizcar: zoom libre
 *   · con zoom: arrastrar para mover la foto
 *   · teclado: ← → para cambiar, Esc para cerrar; rueda del ratón: zoom; clic en la foto: zoom
 * Se monta en <body>: cualquier ancestro con transform haría que position: fixed no cubra
 * la ventana.
 */

const MAX_SCALE = 4
const DOUBLE_TAP_MS = 280
const SWIPE_RATIO = 0.18
const DISMISS_PX = 110

type Pt = { x: number; y: number }
type Gesture =
  | { mode: 'idle' }
  | { mode: 'pending'; start: Pt; t: number; onImage: boolean }
  | { mode: 'swipe'; start: Pt; t: number }
  | { mode: 'dismiss'; start: Pt; t: number }
  | { mode: 'pan'; start: Pt; from: Pt }
  | { mode: 'pinch'; dist: number; mid: Pt; scale: number; from: Pt }

export function Lightbox({ images, index, onClose, caption, captionOf }: {
  images: string[]
  index: number
  onClose: () => void
  /** pie común a todas las fotos (si no se da captionOf) */
  caption?: ReactNode
  /** pie de cada foto (al deslizar cambia con ella) */
  captionOf?: (i: number) => ReactNode
}) {
  const [i, setI] = useState(index)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState<Pt>({ x: 0, y: 0 })
  const [drag, setDrag] = useState<Pt>({ x: 0, y: 0 })
  const [animating, setAnimating] = useState(false)
  const [chrome, setChrome] = useState(true)
  const [closing, setClosing] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const pointers = useRef(new Map<number, Pt>())
  const gesture = useRef<Gesture>({ mode: 'idle' })
  const lastTap = useRef<{ t: number; p: Pt } | null>(null)
  const tapTimer = useRef(0)
  const n = images.length

  const resetZoom = () => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }
  const go = useCallback((to: number) => {
    setAnimating(true)
    setI(Math.max(0, Math.min(n - 1, to)))
    setDrag({ x: 0, y: 0 })
    resetZoom()
  }, [n])
  const close = useCallback(() => {
    setAnimating(true)
    setClosing(true)
    window.setTimeout(onClose, 180)
  }, [onClose])

  // el foco entra en el visor (para el teclado y los lectores de pantalla) y vuelve al salir
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    root.current?.querySelector<HTMLElement>('.lbx-btn')?.focus({ preventScroll: true })
    return () => before?.focus?.({ preventScroll: true })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') go(i + 1)
      if (e.key === 'ArrowLeft') go(i - 1)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [i, go, close])

  // las vecinas se descargan antes de llegar a ellas
  useEffect(() => {
    for (const j of [i - 1, i + 1]) if (images[j]) new Image().src = imageSrc(images[j])
  }, [i, images])

  /** Centro de la pantalla y límites de desplazamiento con un zoom dado. */
  const center = () => {
    const r = root.current?.getBoundingClientRect()
    return { x: (r?.width ?? window.innerWidth) / 2, y: (r?.height ?? window.innerHeight) / 2 }
  }
  const clampPan = (p: Pt, s: number): Pt => {
    const img = imgRef.current
    if (!img || s <= 1) return { x: 0, y: 0 }
    const w = img.offsetWidth * s
    const h = img.offsetHeight * s
    const mx = Math.max(0, (w - window.innerWidth) / 2)
    const my = Math.max(0, (h - window.innerHeight) / 2)
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) }
  }
  /** Zoom a `s` manteniendo bajo el dedo el punto `at` (coordenadas de pantalla). */
  const zoomAt = (s: number, at: Pt, from = { scale, pan }) => {
    const c = center()
    const p = { x: at.x - c.x, y: at.y - c.y }
    // el punto de la foto bajo `at` no se mueve: pan' = p - (p - pan) * s / s0
    const next = { x: p.x - ((p.x - from.pan.x) * s) / from.scale, y: p.y - ((p.y - from.pan.y) * s) / from.scale }
    setScale(s)
    setPan(clampPan(next, s))
  }

  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
  const midpoint = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

  const onPointerDown = (e: React.PointerEvent) => {
    // los botones, enlaces y el pie de foto no son gestos del visor
    if ((e.target as HTMLElement).closest('button, a, .lbx-bottom, .lbx-top')) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setAnimating(false)
    const pts = [...pointers.current.values()]
    if (pts.length === 2) {
      gesture.current = { mode: 'pinch', dist: dist(pts[0], pts[1]), mid: midpoint(pts[0], pts[1]), scale, from: pan }
    } else if (pts.length === 1) {
      const onImage = Boolean(imgRef.current?.contains(e.target as Node))
      gesture.current = { mode: 'pending', start: { x: e.clientX, y: e.clientY }, t: Date.now(), onImage }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const p = { x: e.clientX, y: e.clientY }
    if (g.mode === 'pinch') {
      const pts = [...pointers.current.values()]
      if (pts.length < 2) return
      const s = Math.max(1, Math.min(MAX_SCALE, (g.scale * dist(pts[0], pts[1])) / g.dist))
      zoomAt(s, midpoint(pts[0], pts[1]), { scale: g.scale, pan: g.from })
      return
    }
    if (g.mode === 'pending') {
      const dx = p.x - g.start.x
      const dy = p.y - g.start.y
      if (Math.hypot(dx, dy) < 8) return
      if (scale > 1) gesture.current = { mode: 'pan', start: g.start, from: pan }
      else if (Math.abs(dx) > Math.abs(dy)) gesture.current = { mode: 'swipe', start: g.start, t: g.t }
      else if (dy > 0) gesture.current = { mode: 'dismiss', start: g.start, t: g.t }
      else return
    }
    const cur = gesture.current
    if (cur.mode === 'pan') setPan(clampPan({ x: cur.from.x + p.x - cur.start.x, y: cur.from.y + p.y - cur.start.y }, scale))
    else if (cur.mode === 'swipe') {
      let dx = p.x - cur.start.x
      // rebote en la primera y la última
      if ((i === 0 && dx > 0) || (i === n - 1 && dx < 0)) dx /= 3
      setDrag({ x: dx, y: 0 })
    } else if (cur.mode === 'dismiss') setDrag({ x: 0, y: Math.max(0, p.y - cur.start.y) })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const had = pointers.current.delete(e.pointerId)
    if (!had) return
    const g = gesture.current
    const p = { x: e.clientX, y: e.clientY }
    if (g.mode === 'pinch') {
      // queda un dedo: sigue moviendo la foto ampliada
      const left = [...pointers.current.values()][0]
      if (left) gesture.current = { mode: 'pan', start: left, from: pan }
      else gesture.current = { mode: 'idle' }
      if (scale < 1.05) resetZoom()
      return
    }
    gesture.current = { mode: 'idle' }
    setAnimating(true)
    if (g.mode === 'swipe') {
      const dx = p.x - g.start.x
      const v = Math.abs(dx) / Math.max(1, Date.now() - g.t)
      const w = window.innerWidth
      if ((dx < -w * SWIPE_RATIO || (v > 0.5 && dx < -30)) && i < n - 1) go(i + 1)
      else if ((dx > w * SWIPE_RATIO || (v > 0.5 && dx > 30)) && i > 0) go(i - 1)
      else setDrag({ x: 0, y: 0 })
      return
    }
    if (g.mode === 'dismiss') {
      const dy = p.y - g.start.y
      const v = dy / Math.max(1, Date.now() - g.t)
      if (dy > DISMISS_PX || v > 0.6) close()
      else setDrag({ x: 0, y: 0 })
      return
    }
    if (g.mode === 'pending') onTap(p, g.onImage, e.pointerType)
  }

  /** Toque sin arrastre: doble toque = zoom; uno solo, fuera = cerrar, en la foto = controles. */
  const onTap = (p: Pt, onImage: boolean, type: string) => {
    // con ratón, un clic en la foto amplía o vuelve (no hace falta doble clic)
    if (type === 'mouse') {
      if (!onImage && scale === 1) return close()
      return scale > 1 ? resetZoom() : zoomAt(2.5, p)
    }
    const now = Date.now()
    const prev = lastTap.current
    if (prev && now - prev.t < DOUBLE_TAP_MS && dist(prev.p, p) < 40) {
      window.clearTimeout(tapTimer.current)
      lastTap.current = null
      return scale > 1 ? resetZoom() : zoomAt(2.5, p)
    }
    lastTap.current = { t: now, p }
    // se espera por si llega el segundo toque
    tapTimer.current = window.setTimeout(() => {
      lastTap.current = null
      if (!onImage && scale === 1) close()
      else setChrome((c) => !c)
    }, DOUBLE_TAP_MS)
  }

  const onWheel = (e: React.WheelEvent) => {
    const s = Math.max(1, Math.min(MAX_SCALE, scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
    if (s === 1) resetZoom()
    else zoomAt(s, { x: e.clientX, y: e.clientY })
  }

  const fade = closing ? 0 : Math.max(0.15, 1 - drag.y / 400)
  const slides = [i - 1, i, i + 1].filter((j) => j >= 0 && j < n)
  const cap = captionOf ? captionOf(i) : caption

  return createPortal(
    <div
      ref={root}
      className={`lbx ${chrome ? '' : 'lbx-bare'}`}
      style={{ background: `rgb(10 12 11 / ${0.94 * fade})` }}
      role="dialog"
      aria-modal="true"
      aria-label="Visor de fotos"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div
        className="lbx-track"
        style={{
          transform: `translate3d(calc(${-i * 100}% + ${drag.x}px), ${closing ? 60 : drag.y}px, 0)`,
          transition: animating ? 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
          opacity: closing ? 0 : 1,
        }}
      >
        {slides.map((j) => (
          <div key={images[j] + j} className="lbx-slide" style={{ left: `${j * 100}%` }}>
            <img
              ref={j === i ? imgRef : undefined}
              className="lbx-img"
              src={imageSrc(images[j])}
              alt=""
              draggable={false}
              style={j === i ? {
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
                transition: animating ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
                cursor: scale > 1 ? 'grab' : 'zoom-in',
              } : undefined}
            />
          </div>
        ))}
      </div>

      <div className="lbx-top">
        {n > 1 && <span className="lbx-count num">{i + 1} / {n}</span>}
        <button className="lbx-btn" onClick={close} aria-label="Cerrar">✕</button>
      </div>
      {n > 1 && i > 0 && <button className="lbx-btn lbx-prev" onClick={() => go(i - 1)} aria-label="Anterior">‹</button>}
      {n > 1 && i < n - 1 && <button className="lbx-btn lbx-next" onClick={() => go(i + 1)} aria-label="Siguiente">›</button>}
      <div className="lbx-bottom">
        {cap && <div className="lbx-caption">{cap}</div>}
        {n > 1 && n <= 20 && (
          <div className="lbx-dots" aria-hidden="true">
            {images.map((_, j) => <span key={j} className={j === i ? 'on' : ''} />)}
          </div>
        )}
        <a className="lbx-orig" href={images[i]} target="_blank" rel="noreferrer">Abrir original</a>
      </div>
    </div>,
    document.body,
  )
}
