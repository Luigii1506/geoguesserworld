import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useCountries, type CountryRow } from '../lib/data'
import { geo, type GeoCard } from '../lib/geo'
import { kindLabel } from '../lib/geoFormat'
import { savedItems, useStudy } from '../lib/study/store'
import type { HintData, PhotoData, PlaceData, StudyItem } from '../lib/study/types'
import { Img } from './Img'
import { PlaceMap } from './ui'

// Buscador de toda la app (botón de la cabecera, «/» o ⌘K): secciones, países con guía,
// lugares de la base geográfica (la API, con una pausa al escribir) y lo que tienes guardado.
// Teclado: ↑ ↓ para moverse, Intro para abrir, Esc para cerrar.

const SECTIONS: { to: string; label: string; words: string }[] = [
  { to: '/', label: 'Inicio', words: 'inicio portada home' },
  { to: '/paises', label: 'Países', words: 'paises guias' },
  { to: '/catalogo', label: 'Catálogo', words: 'catalogo bolardos postes matriculas coche lineas señales' },
  { to: '/guias', label: 'Guías externas', words: 'guias externas documentos google docs comunidad recursos enlaces regionguessing reddit discord' },
  { to: '/duelo', label: 'Duelos', words: 'duelos gemelos comparar' },
  { to: '/guardados', label: 'Guardados', words: 'guardados favoritos estrella' },
  { to: '/entrenar', label: 'Entrenar', words: 'entrenar repasar examen practica' },
  { to: '/geografia', label: 'Geografía', words: 'geografia volcanes montañas rios ciudades lugares' },
  { to: '/mapas', label: 'Mapas', words: 'mapas conduccion idiomas' },
  { to: '/buscar', label: '¿Dónde estoy?', words: 'donde estoy buscar identificar' },
  { to: '/explorar', label: 'Fotos', words: 'fotos explorar imagenes' },
]
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

type Result =
  | { kind: 'section'; to: string; label: string }
  | { kind: 'country'; c: CountryRow }
  | { kind: 'place'; p: GeoCard }
  | { kind: 'saved'; i: StudyItem }

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <>
      <button className="search-btn" onClick={() => setOpen(true)} aria-label="Buscar en GeoMastery" title="Buscar (/)">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M11 11m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M20 20l-4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <span className="search-btn-label">Buscar</span>
        <kbd className="search-btn-kbd">/</kbd>
      </button>
      {open && <Palette onClose={() => setOpen(false)} />}
    </>
  )
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const countries = useCountries()
  const study = useStudy()
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const [places, setPlaces] = useState<GeoCard[]>([])
  const [place, setPlace] = useState<GeoCard | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  // lugares: de la API, con una pausa corta
  useEffect(() => {
    const text = q.trim()
    if (text.length < 2) return setPlaces([])
    let alive = true
    const t = window.setTimeout(() => {
      geo.search(text).then((r) => alive && setPlaces(r.items.filter((p) => p.kind !== 'country').slice(0, 6)), () => {})
    }, 250)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [q])

  const results = useMemo<Result[]>(() => {
    const n = fold(q.trim())
    if (!n) return SECTIONS.slice(0, 6).map((s) => ({ kind: 'section', to: s.to, label: s.label }))
    const sections = SECTIONS.filter((s) => fold(`${s.label} ${s.words}`).includes(n)).slice(0, 3).map((s): Result => ({ kind: 'section', to: s.to, label: s.label }))
    const cs = (countries ?? [])
      .filter((c) => c.groups > 0 && (fold(c.name_es ?? '').includes(n) || fold(c.name).includes(n)))
      .sort((a, b) => Number(fold(b.name_es ?? b.name).startsWith(n)) - Number(fold(a.name_es ?? a.name).startsWith(n)) || b.groups - a.groups)
      .slice(0, 5)
      .map((c): Result => ({ kind: 'country', c }))
    const saved = savedItems(study)
      .filter((i) => fold(`${textOf(i)} ${i.note}`).includes(n))
      .slice(0, 4)
      .map((i): Result => ({ kind: 'saved', i }))
    return [...sections, ...cs, ...places.map((p): Result => ({ kind: 'place', p })), ...saved]
  }, [q, countries, places, study])
  useEffect(() => setHi(0), [q])

  const choose = (r: Result | undefined) => {
    if (!r) return
    if (r.kind === 'place') return setPlace(r.p)
    onClose()
    if (r.kind === 'section') navigate(r.to)
    else if (r.kind === 'country') navigate(`/pais/${r.c.code}`)
    else navigate(`/guardados?tipo=${r.i.kind}`)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') (e.preventDefault(), setHi((h) => Math.min(results.length - 1, h + 1)))
    else if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(0, h - 1)))
    else if (e.key === 'Enter') choose(results[hi])
  }

  if (place) {
    return <PlaceMap places={[{ id: place.id, n: place.name_en ?? place.name, es: place.name, lat: place.lat, lng: place.lng, k: place.kind, cc: place.cc }]} index={0} onClose={() => (setPlace(null), onClose())} />
  }
  let lastGroup = ''
  return createPortal(
    <div className="palette" onClick={onClose} role="dialog" aria-modal="true" aria-label="Buscar en GeoMastery">
      <div className="palette-box" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M11 11m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M20 20l-4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Un país, un lugar, una sección o algo que guardaste" aria-label="Buscar" />
          <button className="btn btn-quiet btn-sm" onClick={onClose}>Esc</button>
        </div>
        <div className="palette-list" role="listbox">
          {results.length === 0 && <p className="muted small palette-empty">Nada coincide con «{q}».</p>}
          {results.map((r, i) => {
            const group = r.kind === 'section' ? 'Secciones' : r.kind === 'country' ? 'Países' : r.kind === 'place' ? 'Lugares' : 'Guardados'
            const head = group !== lastGroup ? ((lastGroup = group), <span key={`h-${group}`} className="eyebrow palette-group">{group}</span>) : null
            return (
              <div key={keyOf(r)}>
                {head}
                <button className={`palette-item ${i === hi ? 'on' : ''}`} role="option" aria-selected={i === hi} onMouseEnter={() => setHi(i)} onClick={() => choose(r)}>
                  <ResultRow r={r} />
                </button>
              </div>
            )
          })}
        </div>
        <p className="palette-foot muted small">↑ ↓ para moverte · Intro para abrir · Esc para cerrar</p>
      </div>
    </div>,
    document.body,
  )
}

const keyOf = (r: Result) => (r.kind === 'section' ? `s:${r.to}` : r.kind === 'country' ? `c:${r.c.code}` : r.kind === 'place' ? `p:${r.p.id}` : `g:${r.i.key}`)
function textOf(i: StudyItem): string {
  if (i.kind === 'place') return (i.data as PlaceData).name
  if (i.kind === 'photo') return (i.data as PhotoData).text ?? (i.data as PhotoData).catName ?? ''
  if (i.kind === 'hint') return (i.data as HintData).text
  return ''
}

function ResultRow({ r }: { r: Result }) {
  if (r.kind === 'section') return <><span className="palette-icon" aria-hidden="true">→</span><span className="palette-main">{r.label}</span></>
  if (r.kind === 'country')
    return (
      <>
        <span className="palette-icon flag" aria-hidden="true">{r.c.flag}</span>
        <span className="palette-main">{r.c.name_es ?? r.c.name}<small>{r.c.groups} pistas · guía</small></span>
      </>
    )
  if (r.kind === 'place')
    return (
      <>
        <span className="palette-thumb">{r.p.thumb ? <Img src={r.p.thumb} sizes="40px" /> : null}</span>
        <span className="palette-main">{r.p.name}<small>{kindLabel(r.p.kind)}{r.p.cc ? ` · ${r.p.cc.toUpperCase()}` : ''}</small></span>
      </>
    )
  return (
    <>
      <span className="palette-icon" aria-hidden="true">★</span>
      <span className="palette-main palette-clip">{textOf(r.i)}<small>Guardado</small></span>
    </>
  )
}
