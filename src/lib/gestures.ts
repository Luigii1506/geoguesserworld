import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'

/**
 * Arrastrar hacia abajo para cerrar una hoja o ficha (en pantallas táctiles). Se engancha a la
 * cabecera o al asa, no al contenido, para no pelear con su scroll:
 *
 *   const drag = useDragToClose(onClose)
 *   <div className="sheet" style={drag.style}>
 *     <header {...drag.handle}>…</header>
 *
 * La hoja sigue al dedo; al soltar se cierra si bajó lo bastante (o rápido) y si no, vuelve.
 * Los botones de la cabecera siguen funcionando: el gesto solo empieza al moverse unos píxeles.
 */
export function useDragToClose(onClose: () => void, { threshold = 110 } = {}) {
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  const start = useRef<{ y: number; t: number; id: number; active: boolean } | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') return
    start.current = { y: e.clientY, t: Date.now(), id: e.pointerId, active: false }
  }
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const d = e.clientY - s.y
    if (!s.active) {
      if (d < 6) return
      // a partir de aquí el gesto es nuestro (los botones ya no reciben el toque)
      s.active = true
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
    }
    setDy(Math.max(0, d))
  }
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const s = start.current
    start.current = null
    if (!s || !s.active) return
    setDragging(false)
    const d = Math.max(0, e.clientY - s.y)
    const v = d / Math.max(1, Date.now() - s.t)
    if (d > threshold || v > 0.6) {
      setClosing(true)
      setDy(window.innerHeight)
      window.setTimeout(onClose, 200)
    } else setDy(0)
  }

  const style: CSSProperties | undefined =
    dy || closing
      ? { transform: `translateY(${dy}px)`, transition: dragging ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)' }
      : undefined
  return {
    style,
    /** opacidad del fondo (se aclara al bajar) */
    backdrop: closing ? 0 : Math.max(0.2, 1 - dy / 500),
    handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, style: { touchAction: 'none' } as CSSProperties },
  }
}
