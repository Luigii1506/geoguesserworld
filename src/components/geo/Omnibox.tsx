import { useEffect, useRef, useState } from 'react'
import { geo, type GeoCard, type GeoCountryRow } from '../../lib/geo'
import { factLine, kindLabel } from '../../lib/geoFormat'

// Buscador único de Geografía: mientras escribes sugiere países y lugares;
// Enter busca el texto en toda la base. Teclado: flechas, Enter y Escape.

type Item = { type: 'country'; c: GeoCountryRow } | { type: 'place'; p: GeoCard } | { type: 'all'; q: string }

const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function Omnibox({ countries, value, onSearch, onCountry, onPlace, placeholder, autoFocus, big }: {
  countries: GeoCountryRow[]
  value: string
  onSearch: (q: string) => void
  onCountry: (cc: string) => void
  onPlace: (p: GeoCard) => void
  placeholder?: string
  autoFocus?: boolean
  big?: boolean
}) {
  const [q, setQ] = useState(value)
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const [places, setPlaces] = useState<GeoCard[]>([])
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => setQ(value), [value])
  useEffect(() => {
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  // lugares: con una pausa corta, desde la API
  useEffect(() => {
    const text = q.trim()
    if (text.length < 2) return setPlaces([])
    let alive = true
    const t = window.setTimeout(() => {
      geo.search(text).then((r) => alive && setPlaces(r.items.filter((p) => p.kind !== 'country').slice(0, 6)), () => {})
    }, 180)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [q])

  const needle = fold(q.trim())
  const countryHits = needle
    ? countries
        .filter((c) => fold(c.name).includes(needle) || fold(c.name_en ?? '').includes(needle))
        .sort((a, b) => Number(fold(b.name).startsWith(needle)) - Number(fold(a.name).startsWith(needle)) || b.places - a.places)
        .slice(0, 4)
    : []
  const items: Item[] = needle
    ? [...countryHits.map((c) => ({ type: 'country' as const, c })), ...places.map((p) => ({ type: 'place' as const, p })), { type: 'all' as const, q: q.trim() }]
    : []

  const pick = (it: Item) => {
    setOpen(false)
    if (it.type === 'country') {
      setQ('')
      onCountry(it.c.cc)
    } else if (it.type === 'place') onPlace(it.p)
    else onSearch(it.q)
  }
  const flag = (cc?: string) => countries.find((c) => c.cc === cc)?.flag ?? ''

  return (
    <div className={`omni ${big ? 'omni-big' : ''}`} ref={box}>
      <svg className="omni-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        className="omni-input"
        type="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        placeholder={placeholder ?? 'Busca un país o un lugar: México, Danubio, Kioto…'}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setHi(-1)
          if (!e.target.value) onSearch('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setHi((h) => Math.min(h + 1, items.length - 1)))
          else if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(h - 1, 0)))
          // Enter: la sugerencia marcada con las flechas o, si no hay, buscar el texto
          else if (e.key === 'Enter') {
            e.preventDefault()
            pick(open && items[hi] ? items[hi] : { type: 'all', q: q.trim() })
          } else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && items.length > 0 && (
        <ul className="omni-list" role="listbox">
          {items.map((it, i) => (
            <li key={it.type === 'country' ? `c${it.c.cc}` : it.type === 'place' ? it.p.id : 'all'}>
              <button className={i === hi ? 'hi' : ''} onPointerEnter={() => setHi(i)} onClick={() => pick(it)}>
                {it.type === 'country' ? (
                  <>
                    <span className="omni-flag">{it.c.flag}</span>
                    <span className="omni-main"><strong>{it.c.name}</strong><em>País · {it.c.places.toLocaleString('es')} lugares</em></span>
                    <span className="omni-go">Ver país →</span>
                  </>
                ) : it.type === 'place' ? (
                  <>
                    <span className="omni-thumb">{it.p.thumb ? <img src={it.p.thumb} alt="" loading="lazy" /> : null}</span>
                    <span className="omni-main">
                      <strong>{it.p.name}</strong>
                      <em>{kindLabel(it.p.kind)} · {flag(it.p.cc)} {countries.find((c) => c.cc === it.p.cc)?.name ?? ''}{factLine(it.p.kind, it.p.facts) ? ` · ${factLine(it.p.kind, it.p.facts)}` : ''}</em>
                    </span>
                  </>
                ) : (
                  <span className="omni-main omni-all">Ver todos los resultados de «{it.q}» →</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
