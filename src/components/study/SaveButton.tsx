import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDragToClose } from '../../lib/gestures'
import { Link } from 'react-router-dom'
import { createDeck, isSaved, liveDecks, saveItems, setItemDecks, setNote, setSettings, unsaveItem, useStudy, type NewItem } from '../../lib/study/store'

/**
 * ☆ Guardar para estudiar. Al guardar se abre un panel para elegir mazos y añadir una nota
 * ("se confunde con el de Eslovaquia"); lo guardado sale en Guardados y se repasa en Entrenar.
 */
export function SaveButton({ item, compact = false }: { item: NewItem; compact?: boolean }) {
  const s = useStudy()
  const [open, setOpen] = useState<DOMRect | null>(null)
  const saved = isSaved(s, item.key)

  const click = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!saved) {
      const last = s.settings.data.lastDeck
      saveItems([item], last && s.decks[last] && !s.decks[last].deleted ? [last] : [])
    }
    setOpen(e.currentTarget.getBoundingClientRect())
  }

  return (
    <span className="save-wrap">
      <button
        type="button"
        className={`save-btn ${saved ? 'on' : ''} ${compact ? 'compact' : ''}`}
        onClick={click}
        aria-pressed={saved}
        title={saved ? 'En Guardados' : 'Guardar para repasarlo'}
      >
        <span aria-hidden="true">{saved ? '★' : '☆'}</span>
        {!compact && <span>{saved ? 'Guardado' : 'Guardar'}</span>}
      </button>
      {open && <SavePanel itemKey={item.key} anchor={open} onClose={() => setOpen(null)} />}
    </span>
  )
}

// el panel va en <body> (los carruseles con scroll lo recortarían), junto al botón; en el móvil, abajo
const PANEL_W = 300
function place(anchor: DOMRect): React.CSSProperties | undefined {
  if (window.innerWidth < 640) return undefined
  const left = Math.min(Math.max(8, anchor.right - PANEL_W), window.innerWidth - PANEL_W - 8)
  const below = anchor.bottom + 6
  return below + 340 < window.innerHeight ? { left, top: below } : { left, bottom: window.innerHeight - anchor.top + 6 }
}

function SavePanel({ itemKey, anchor, onClose }: { itemKey: string; anchor: DOMRect; onClose: () => void }) {
  const s = useStudy()
  const item = s.items[itemKey]
  const ref = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(item?.note ?? '')
  const [newDeck, setNewDeck] = useState('')
  const decks = liveDecks(s)
  const drag = useDragToClose(onClose)

  useEffect(() => {
    const away = (e: MouseEvent | TouchEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', away)
    document.addEventListener('touchstart', away)
    document.addEventListener('keydown', esc)
    // si la página se desplaza bastante, el panel se quedaría lejos del botón (los pequeños
    // saltos de la página al cargar contenido no cuentan)
    const y0 = window.scrollY
    const scroll = () => Math.abs(window.scrollY - y0) > 140 && onClose()
    window.addEventListener('scroll', scroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', scroll)
      document.removeEventListener('mousedown', away)
      document.removeEventListener('touchstart', away)
      document.removeEventListener('keydown', esc)
    }
  }, [onClose])

  if (!item || item.deleted) return null
  const toggle = (id: string) => {
    const on = item.decks.includes(id)
    setItemDecks(itemKey, on ? item.decks.filter((d) => d !== id) : [...item.decks, id])
    if (!on) setSettings({ lastDeck: id })
  }
  const addDeck = () => {
    if (!newDeck.trim()) return
    const id = createDeck(newDeck)
    setItemDecks(itemKey, [...item.decks, id])
    setSettings({ lastDeck: id })
    setNewDeck('')
  }
  const saveNote = () => draft !== item.note && setNote(itemKey, draft)

  return createPortal(
    <div className="save-panel" ref={ref} role="dialog" aria-label="En Guardados" style={{ ...place(anchor), ...drag.style }} onClick={(e) => e.stopPropagation()}>
      <div className="save-panel-head" {...drag.handle}>
        <strong>★ En Guardados</strong>
        <Link to="/guardados" className="small">Ver mis guardados →</Link>
      </div>
      <span className="eyebrow">Mazos</span>
      <div className="save-decks">
        {decks.length === 0 && <p className="muted small">Sin mazos todavía: crea uno abajo, o déjalo suelto.</p>}
        {decks.map((d) => (
          <label key={d.id} className="check">
            <input type="checkbox" checked={item.decks.includes(d.id)} onChange={() => toggle(d.id)} /> {d.name}
          </label>
        ))}
        <form className="save-newdeck" onSubmit={(e) => (e.preventDefault(), addDeck())}>
          <input className="input" value={newDeck} onChange={(e) => setNewDeck(e.target.value)} placeholder="Nuevo mazo (p. ej. Hungría)" />
          <button className="btn" disabled={!newDeck.trim()}>Crear</button>
        </form>
      </div>
      <label className="save-note">
        <span className="eyebrow">Nota</span>
        <textarea className="input" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={saveNote} placeholder="Lo que quieres recordar de esto" />
      </label>
      <div className="save-panel-foot">
        <button className="link danger" onClick={() => (unsaveItem(itemKey), onClose())}>Quitar de Guardados</button>
        <button className="btn btn-primary" onClick={() => (saveNote(), onClose())}>Listo</button>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Guarda de golpe un conjunto (lo esencial de un país, un tema entero) en un mazo con su
 * nombre. Muestra cuántas se añadieron y un enlace para estudiarlas.
 */
export function StudyAllButton({ label, deckName, items, className = 'btn' }: { label: string; deckName: string; items: () => NewItem[] | Promise<NewItem[]>; className?: string }) {
  const s = useStudy()
  const [done, setDone] = useState<{ n: number; total: number; deck: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      const list = await items()
      if (!list.length) return
      const deck = createDeck(deckName)
      const fresh = list.filter((i) => !isSaved(s, i.key)).length
      saveItems(list, [deck])
      setSettings({ lastDeck: deck })
      setDone({ n: fresh, total: list.length, deck })
    } finally {
      setBusy(false)
    }
  }
  if (done) {
    return (
      <span className="study-all-done">
        {done.n > 0 ? `✓ ${done.n} añadidas a «${deckName}»` : `✓ Ya estaban en «${deckName}»`}{' '}
        <Link to={`/entrenar?mazo=${done.deck}`}>Estudiar →</Link>
      </span>
    )
  }
  return <button type="button" className={className} onClick={go} disabled={busy}>{busy ? 'Guardando…' : `☆ ${label}`}</button>
}
