import { useEffect, useRef, useState } from 'react'

export type CountryOption = { code: string; n: number; flag: string; name: string; alt: string }

const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Buscador de países: escribe "mex" y elige con el ratón, el dedo o las flechas. */
export function CountryPicker({ options, value, onChange }: { options: CountryOption[]; value: string; onChange: (cc: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  const current = options.find((o) => o.code === value)
  const needle = fold(q.trim())
  const list = (needle ? options.filter((o) => fold(o.name).includes(needle) || fold(o.alt).includes(needle)) : options)
    .sort((a, b) => (needle ? (fold(a.name).startsWith(needle) ? 0 : 1) - (fold(b.name).startsWith(needle) ? 0 : 1) : 0) || a.name.localeCompare(b.name, 'es'))
    .slice(0, 60)
  const pick = (cc: string) => {
    onChange(cc)
    setQ('')
    setOpen(false)
  }
  return (
    <div className="cp" ref={box}>
      <input
        className="input cp-input"
        placeholder={current ? `${current.flag} ${current.name}` : 'Buscar país: México, Japón…'}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setHi(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setHi((h) => Math.min(h + 1, list.length - 1)))
          else if (e.key === 'ArrowUp') (e.preventDefault(), setHi((h) => Math.max(h - 1, 0)))
          else if (e.key === 'Enter' && list[hi]) pick(list[hi].code)
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {current && !q && (
        <button className="cp-clear" onClick={() => onChange('')} aria-label="Quitar país">×</button>
      )}
      {open && (
        <ul className="cp-list" role="listbox">
          {list.length === 0 && <li className="cp-empty">Ningún país coincide</li>}
          {list.map((o, i) => (
            <li key={o.code}>
              <button className={`${i === hi ? 'hi' : ''} ${o.code === value ? 'on' : ''}`} onMouseEnter={() => setHi(i)} onClick={() => pick(o.code)}>
                <span className="cp-flag">{o.flag}</span>
                <span className="cp-name">{o.name}</span>
                <span className="cp-n">{o.n}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
