import { useRef, type ReactNode } from 'react'

/**
 * Sección con carrusel horizontal: en el móvil se desliza con el dedo y llega al
 * borde de la pantalla; en el escritorio, además, flechas.
 */
export function Strip({ title, sub, action, onAction, children, loading }: {
  title: ReactNode
  sub?: ReactNode
  action?: string
  onAction?: () => void
  children: ReactNode
  loading?: boolean
}) {
  const row = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.85, behavior: 'smooth' })
  return (
    <section className="gstrip">
      <header className="gstrip-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        <div className="gstrip-tools">
          {action && onAction && <button className="link" onClick={onAction}>{action} →</button>}
          <button className="gstrip-arrow" onClick={() => scroll(-1)} aria-label="Anteriores">‹</button>
          <button className="gstrip-arrow" onClick={() => scroll(1)} aria-label="Siguientes">›</button>
        </div>
      </header>
      <div className="gstrip-row" ref={row}>
        {loading ? Array.from({ length: 5 }, (_, i) => <div key={i} className="gstrip-skel" />) : children}
      </div>
    </section>
  )
}
