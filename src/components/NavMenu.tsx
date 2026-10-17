import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

// Menú desplegable de la barra superior (escritorio): un grupo de secciones con una línea
// que dice para qué sirve cada una. Se abre con clic, con el ratón encima o con el teclado
// (Intro/espacio, ↓); se cierra con Esc, al salir, al tocar fuera o al elegir.

export type NavEntry = { to: string; label: string; desc?: string; icon?: ReactNode; count?: number; match?: (path: string) => boolean }

type Props = { label: string; items?: NavEntry[]; align?: 'left' | 'right'; trigger?: ReactNode; className?: string; children?: ReactNode }

export function NavMenu({ label, items, align = 'left', trigger, className = '', children }: Props) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const leave = useRef<number>()
  const id = useId()
  const location = useLocation()
  const active = items?.some((it) => location.pathname === it.to || location.pathname.startsWith(`${it.to}/`) || it.match?.(location.pathname))

  useEffect(() => setOpen(false), [location.pathname, location.search])
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (setOpen(false), button.current?.focus())
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  // con ratón: se abre al pasar por encima y se cierra con un pequeño margen al salir
  const enter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    window.clearTimeout(leave.current)
    setOpen(true)
  }
  const exit = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    leave.current = window.setTimeout(() => setOpen(false), 180)
  }

  return (
    <div className={`navmenu ${className} ${open ? 'open' : ''}`} ref={box} onPointerEnter={enter} onPointerLeave={exit}>
      <button
        ref={button}
        className={`navmenu-btn ${active ? 'active' : ''}`}
        aria-label={trigger ? label : undefined}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setOpen(true), requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('.navmenu-panel a, .navmenu-panel button')?.focus()))
        }}
      >
        {trigger ?? label}
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div id={id} className={`navmenu-panel navmenu-${align}`} hidden={!open} aria-label={label}>
        {items?.map((it) => (
          <NavLink key={it.to} to={it.to} className={({ isActive }) => `navmenu-item ${isActive || it.match?.(location.pathname) ? 'on' : ''}`}>
            {it.icon && <span className="navmenu-icon" aria-hidden="true">{it.icon}</span>}
            <span className="navmenu-text">
              <strong>{it.label}{it.count ? <span className="count">{it.count}</span> : null}</strong>
              {it.desc && <small>{it.desc}</small>}
            </span>
          </NavLink>
        ))}
        {children}
      </div>
    </div>
  )
}
