import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Panel de filtros: hoja desde abajo en el móvil, panel lateral en el escritorio. */
export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="gsheet" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="gsheet-box" onClick={(e) => e.stopPropagation()}>
        <header className="gsheet-head">
          <strong>{title}</strong>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        <div className="gsheet-body">{children}</div>
        {footer && <footer className="gsheet-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
