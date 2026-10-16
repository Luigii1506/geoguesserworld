import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'

// Menú del móvil: un panel lateral en lugar de la barra inferior (que quitaba pantalla).
//   · se abre con el botón de la cabecera o deslizando desde el borde izquierdo (en la app
//     instalada y en Android: en Safari ese gesto es «atrás»)
//   · se cierra tocando fuera, deslizándolo hacia la izquierda, con Esc o al elegir sección

export type MenuItem = { to: string; label: string; icon: ReactNode; count?: number; match?: (path: string) => boolean }
export type MenuGroup = { title: string; items: MenuItem[] }

const EDGE = 18
const OPEN_DX = 50

export function MobileMenu({ groups, footer, due }: { groups: MenuGroup[]; footer: ReactNode; due: number }) {
  const [open, setOpen] = useState(false)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const location = useLocation()
  const start = useRef<{ x: number; y: number; t: number; active: boolean } | null>(null)

  // al cambiar de sección, se cierra
  useEffect(() => setOpen(false), [location.pathname, location.search])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  // deslizar desde el borde izquierdo para abrir
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    const iosBrowser = /iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone
    if (iosBrowser) return
    let edge: { x: number; y: number } | null = null
    const down = (e: TouchEvent) => {
      const t = e.touches[0]
      edge = !open && e.touches.length === 1 && t.clientX < EDGE ? { x: t.clientX, y: t.clientY } : null
    }
    const move = (e: TouchEvent) => {
      if (!edge) return
      const t = e.touches[0]
      if (Math.abs(t.clientY - edge.y) > 40) edge = null
      else if (t.clientX - edge.x > OPEN_DX) {
        edge = null
        setOpen(true)
      }
    }
    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    return () => {
      window.removeEventListener('touchstart', down)
      window.removeEventListener('touchmove', move)
    }
  }, [open])

  // deslizar el panel hacia la izquierda para cerrarlo
  const onDown = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') return
    start.current = { x: e.clientX, y: e.clientY, t: Date.now(), active: false }
  }
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const s = start.current
    if (!s) return
    const ddx = e.clientX - s.x
    if (!s.active) {
      // solo un gesto horizontal hacia la izquierda; vertical = scroll del menú
      if (Math.abs(e.clientY - s.y) > 12) return void (start.current = null)
      if (ddx > -8) return
      s.active = true
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragging(true)
    }
    setDx(Math.min(0, ddx))
  }
  const onUp = (e: PointerEvent<HTMLElement>) => {
    const s = start.current
    start.current = null
    if (!s?.active) return
    setDragging(false)
    const ddx = e.clientX - s.x
    const v = -ddx / Math.max(1, Date.now() - s.t)
    if (ddx < -80 || v > 0.5) setOpen(false)
    setDx(0)
  }

  return (
    <>
      <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Abrir el menú" aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        {due > 0 && <span className="menu-dot" aria-label={`${due} por repasar`} />}
      </button>
      {createPortal(
        <div className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
          <div className="drawer-backdrop" onClick={() => setOpen(false)} style={dx ? { opacity: Math.max(0, 1 + dx / 300) } : undefined} />
          <nav
            className="drawer-panel"
            aria-label="Secciones"
            style={dx ? { transform: `translateX(${dx}px)`, transition: dragging ? 'none' : undefined } : undefined}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <div className="drawer-head">
              <NavLink to="/" className="brand">GeoMastery</NavLink>
              <button className="btn btn-quiet" onClick={() => setOpen(false)} aria-label="Cerrar el menú">✕</button>
            </div>
            <div className="drawer-body">
              {groups.map((g) => (
                <div key={g.title} className="drawer-group">
                  <span className="eyebrow">{g.title}</span>
                  {g.items.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      className={({ isActive }) => `drawer-item ${isActive || it.match?.(location.pathname) ? 'on' : ''}`}
                      tabIndex={open ? 0 : -1}
                    >
                      <span className="drawer-icon" aria-hidden="true">{it.icon}</span>
                      <span>{it.label}</span>
                      {it.count ? <span className="count">{it.count}</span> : null}
                    </NavLink>
                  ))}
                </div>
              ))}
            </div>
            <div className="drawer-foot">{footer}</div>
          </nav>
        </div>,
        document.body,
      )}
    </>
  )
}

/** Iconos de línea sencillos (24 × 24), del mismo trazo. */
const svg = (d: string) => (
  <svg viewBox="0 0 24 24" width="20" height="20"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
export const ICONS = {
  home: svg('M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z'),
  countries: svg('M5 21V4m0 1h11l-2 4 2 4H5'),
  catalog: svg('M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v6H4zM13 14h7v6h-7z'),
  duel: svg('M7 7l-3 3 3 3M4 10h11M17 11l3 3-3 3M20 14H9'),
  train: svg('M12 3v4M12 17v4M3 12h4M17 12h4M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0'),
  geography: svg('M3 19l6-11 4 6 3-4 5 9z'),
  maps: svg('M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14'),
  search: svg('M11 11m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M20 20l-4.5-4.5'),
  photos: svg('M4 6h16v12H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01'),
  sources: svg('M6 4h9l3 3v13H6zM9 10h6M9 14h6M9 18h4'),
}
