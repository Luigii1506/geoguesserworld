import { useMemo, useState } from 'react'
import { useCountryMap, useJson, countryFlag, countryLabel } from '../lib/data'
import { REGION_ES, SOURCE_NAMES } from '../lib/labels'
import { Lightbox, Loading, MissingData } from '../components/ui'
import { imageSrc } from '../lib/images'

// Explorador de fotos: una categoría, todos los países, con las imágenes de
// todas las fuentes del pipeline (public/community/, uso personal).

interface VisualItem {
  c: string | null
  n?: string
  s: string
  k: string
  sk?: string
  t: string
  i: string
  l: string
}

interface VisualIndex {
  generatedAt: string
  counts: Record<string, number>
  categories: { id: string; name: string; grp: string }[]
  items: VisualItem[]
}

const SOURCE_BY_LETTER: Record<string, string> = { p: 'plonkit', g: 'geometas', h: 'geohints', t: 'geotips', l: 'learnablemeta', o: 'openguessr' }
const REGIONS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']
const PAGE = 60

export default function Visual() {
  const index = useJson<VisualIndex>('/community/visual-index.json')
  const map = useCountryMap()
  const [cat, setCat] = useState('bollards')
  const [sub, setSub] = useState('')
  const [region, setRegion] = useState('')
  const [pais, setPais] = useState('')
  const [fuente, setFuente] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [box, setBox] = useState<number | null>(null)

  const items = index?.items ?? []
  const label = (code: string | null, raw?: string) => (code ? countryLabel(map, code) : raw ?? '—')
  const inCat = useMemo(() => items.filter((it) => it.k === cat), [items, cat])

  const subcats = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of inCat) if (it.sk) m.set(it.sk, (m.get(it.sk) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [inCat])

  const availableCountries = useMemo(
    () => [...new Set(inCat.filter((it) => it.c).map((it) => it.c as string))].sort((a, b) => label(a).localeCompare(label(b), 'es')),
    [inCat, map],
  )

  const filtered = useMemo(
    () =>
      inCat
        .filter((it) => {
          if (sub && it.sk !== sub) return false
          if (pais && it.c !== pais) return false
          if (fuente && it.s !== fuente) return false
          if (region && (!it.c || map.get(it.c)?.region !== region)) return false
          return true
        })
        .sort((a, b) => label(a.c, a.n).localeCompare(label(b.c, b.n), 'es')),
    [inCat, sub, pais, fuente, region, map],
  )

  if (index === undefined) return <Loading what="fotos" />
  if (index === null) return <MissingData />

  const reset = () => setLimit(PAGE)
  const shown = filtered.slice(0, limit)

  return (
    <div>
      <header className="page-head">
        <h1>Fotos</h1>
        <p className="lead">{items.length.toLocaleString('es')} imágenes de seis fuentes. Elige un tema y compara cómo es en cada país.</p>
      </header>

      <div className="toolbar">
        <select className="select" value={cat} onChange={(e) => { setCat(e.target.value); setSub(''); setPais(''); reset() }}>
          {[...new Set(index.categories.map((c) => c.grp))].map((g) => (
            <optgroup key={g} label={g}>
              {index.categories.filter((c) => c.grp === g && (index.counts[c.id] ?? 0) > 0).map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({index.counts[c.id]})</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select className="select" value={pais} onChange={(e) => { setPais(e.target.value); reset() }}>
          <option value="">Todos los países ({availableCountries.length})</option>
          {availableCountries.map((c) => <option key={c} value={c}>{label(c)}</option>)}
        </select>
        <select className="select" value={fuente} onChange={(e) => { setFuente(e.target.value); reset() }}>
          <option value="">Todas las fuentes</option>
          {Object.entries(SOURCE_BY_LETTER).map(([k, v]) => <option key={k} value={k}>{SOURCE_NAMES[v]}</option>)}
        </select>
        <div className="seg">
          <button className={!region ? 'on' : ''} onClick={() => { setRegion(''); reset() }}>Todo</button>
          {REGIONS.map((r) => <button key={r} className={region === r ? 'on' : ''} onClick={() => { setRegion(r); reset() }}>{REGION_ES[r]}</button>)}
        </div>
      </div>

      {subcats.length > 0 && (
        <div className="toolbar">
          <div className="chips">
            <button className={`chip ${!sub ? 'on' : ''}`} onClick={() => { setSub(''); reset() }}>Todos los tipos</button>
            {subcats.map(([s, n]) => (
              <button key={s} className={`chip ${sub === s ? 'on' : ''}`} onClick={() => { setSub(s); reset() }}>
                {s.replace(/_/g, ' ')} <span className="muted">{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="muted small" style={{ marginBottom: '1rem' }}>{filtered.length.toLocaleString('es')} fotos</p>

      <div className="photo-grid">
        {shown.map((it, i) => (
          <figure key={`${it.i}-${i}`} className="photo" style={{ margin: 0 }}>
            <button className="shot" onClick={() => setBox(i)} aria-label="Ampliar">
              <img src={imageSrc(it.i, 'thumb')} loading="lazy" alt="" />
            </button>
            <figcaption className="photo-caption">
              <span>{it.c ? countryFlag(map, it.c) : ''} {label(it.c, it.n)}</span>
              <span className="muted">{SOURCE_NAMES[SOURCE_BY_LETTER[it.s]] ?? it.s}</span>
            </figcaption>
            {it.t && <p className="photo-text">{it.t}</p>}
          </figure>
        ))}
      </div>

      {filtered.length > limit && (
        <div style={{ textAlign: 'center', marginTop: '1.6rem' }}>
          <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>Mostrar más ({filtered.length - limit})</button>
        </div>
      )}

      {box !== null && (
        <Lightbox
          images={shown.map((it) => it.i)}
          index={box}
          onClose={() => setBox(null)}
          caption={<span>{label(shown[box]?.c ?? null, shown[box]?.n)}</span>}
        />
      )}
    </div>
  )
}
