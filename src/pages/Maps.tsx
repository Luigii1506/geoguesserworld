import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { type CountryRow, type MapLayer, useCountries, useMaps } from '../lib/data'
import { COLOR_HEX, valueLabel } from '../lib/labels'
import { Loading, MissingData } from '../components/ui'

// Mapas temáticos: un rasgo de la meta por capa (lado de conducción, color de
// la línea central, matrícula trasera…). Al pasar por un valor de la leyenda
// se iluminan solo los países que lo tienen: se ve qué es común y qué es raro.

const WorldMap = lazy(() => import('../components/WorldMap'))

// colores reales para las capas de color; "ninguno" y "otro" en neutros
const MAP_COLOR: Record<string, string> = { ...COLOR_HEX, white: '#ffffff', none: '#d9d4c7', eu_blue: '#2f62b8' }
// paleta para categorías sin color propio (forma, material, generación…)
const PALETTE = ['#1f6b55', '#e8862b', '#2f62b8', '#c8352b', '#8a5bb8', '#c9a227', '#3f9fa8', '#7a5233', '#9a9a96', '#d16b9b']

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

type Value = MapLayer['values'][number] & { color: string; label: string }

function resolve(layer: MapLayer): Value[] {
  return layer.values.map((x, i) => ({
    ...x,
    label: cap(x.label ?? valueLabel(x.v)),
    color: x.color ?? (layer.kind === 'color' ? MAP_COLOR[x.v] ?? PALETTE[i % PALETTE.length] : PALETTE[i % PALETTE.length]),
  }))
}

const stripeId = (vals: string[]) => `mix-${vals.join('_').replace(/[^a-z0-9_]/gi, '')}`

export default function Maps() {
  const maps = useMaps()
  const countries = useCountries()
  const [params, setParams] = useSearchParams()
  const [hoverValue, setHoverValue] = useState<string | null>(null)
  const [lockedValue, setLockedValue] = useState<string | null>(null)

  const layers = maps?.layers ?? []
  const layer = layers.find((l) => l.id === params.get('capa')) ?? layers[0]
  const values = useMemo(() => (layer ? resolve(layer) : []), [layer])
  const byValue = useMemo(() => new Map(values.map((v) => [v.v, v])), [values])
  const focus = hoverValue ?? lockedValue

  const groups = useMemo(() => {
    const m = new Map<string, MapLayer[]>()
    for (const l of layers) {
      if (!m.has(l.group)) m.set(l.group, [])
      m.get(l.group)!.push(l)
    }
    return [...m.entries()]
  }, [layers])

  // países con dos o más valores: rayas con sus colores (p. ej. Serbia, latina y cirílica)
  const combos = useMemo(() => {
    if (!layer) return []
    const seen = new Map<string, string[]>()
    for (const vals of Object.values(layer.data)) if (vals.length > 1) seen.set(stripeId(vals.slice(0, 3)), vals.slice(0, 3))
    return [...seen.entries()]
  }, [layer])

  if (maps === undefined || countries === undefined) return <Loading what="los mapas" />
  if (!maps || !countries || !layer) return <MissingData />

  const select = (id: string) => {
    setLockedValue(null)
    setHoverValue(null)
    setParams({ capa: id }, { replace: true })
  }

  const paint = (c: CountryRow) => {
    const vals = layer.data[c.code]
    if (!vals?.length) return undefined
    if (focus) return vals.includes(focus) ? byValue.get(focus)?.color : undefined
    return vals.length > 1 ? `url(#${stripeId(vals.slice(0, 3))})` : byValue.get(vals[0])?.color
  }
  const highlight = focus ? new Set(Object.entries(layer.data).filter(([, v]) => v.includes(focus)).map(([cc]) => cc)) : undefined

  // rayas de 4 px en pantalla sea cual sea el zoom
  const defs = (k: number) =>
    combos.map(([id, vals]) => {
      const w = 4 / k
      return (
        <pattern key={id} id={id} width={w * vals.length} height={w} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          {vals.map((v, i) => <rect key={v} x={i * w} width={w} height={w} fill={byValue.get(v)?.color ?? '#999'} />)}
        </pattern>
      )
    })

  const card = (c: CountryRow) => {
    const vals = layer.data[c.code] ?? []
    return (
      <>
        {vals.length ? (
          <ul className="mp-card-values">
            {vals.map((v) => (
              <li key={v}>
                <span className="mp-swatch" style={{ background: byValue.get(v)?.color }} />
                {byValue.get(v)?.label ?? cap(valueLabel(v))}
              </li>
            ))}
          </ul>
        ) : (
          <div className="wm-card-meta">Sin dato en esta capa</div>
        )}
        {c.groups > 0 && <div className="wm-card-cta">Abrir guía →</div>}
      </>
    )
  }

  const legend = (
    <div className="mp-legend">
      {values.map((v) => {
        const rare = v.n <= 3 && layer.total >= 20
        return (
          <button
            key={v.v}
            className={`mp-chip ${focus === v.v ? 'on' : ''} ${focus && focus !== v.v ? 'off' : ''}`}
            onMouseEnter={() => setHoverValue(v.v)}
            onMouseLeave={() => setHoverValue(null)}
            onClick={() => setLockedValue(lockedValue === v.v ? null : v.v)}
          >
            <span className="mp-swatch" style={{ background: v.color }} />
            {v.label}
            <span className="mp-n">{v.n}</span>
            {rare && <span className="mp-rare">raro</span>}
          </button>
        )
      })}
      <span className="mp-nodata"><span className="mp-swatch mp-swatch-hatch" />Sin dato</span>
    </div>
  )

  return (
    <div className="maps">
      <aside className="mp-layers">
        {groups.map(([g, list]) => (
          <div key={g} className="mp-group">
            <span className="eyebrow">{g}</span>
            {list.map((l) => (
              <button key={l.id} className={l.id === layer.id ? 'on' : ''} onClick={() => select(l.id)}>
                {l.title}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <section className="mp-main">
        <header className="mp-head">
          <span className="eyebrow">{layer.group}</span>
          <h1>{layer.title}</h1>
          <p className="lead">{layer.question}</p>
          <p className="muted small">
            {layer.total} países con dato{layer.source ? ` · ${layer.source}` : ''}
            {layer.multi ? ' · un país puede tener varios valores (rayas)' : ''}
            {' · '}pasa el ratón por la leyenda para aislar un valor, haz clic para fijarlo
          </p>
        </header>
        {legend}
        <Suspense fallback={<div className="empty">Cargando mapa…</div>}>
          <WorldMap countries={countries} paint={paint} card={card} highlight={highlight} legend={<span />} defs={defs} />
        </Suspense>
        {lockedValue && (
          <p className="mp-list">
            <strong>{byValue.get(lockedValue)?.label}:</strong>{' '}
            {Object.entries(layer.data)
              .filter(([, v]) => v.includes(lockedValue))
              .map(([cc]) => countries.find((c) => c.code === cc))
              .filter((c): c is CountryRow => Boolean(c))
              .sort((a, b) => (a.name_es ?? a.name).localeCompare(b.name_es ?? b.name, 'es'))
              .map((c, i, arr) => (
                <span key={c.code}>
                  {c.groups > 0 ? <Link to={`/pais/${c.code}`}>{c.flag} {c.name_es ?? c.name}</Link> : <>{c.flag} {c.name_es ?? c.name}</>}
                  {i < arr.length - 1 ? ', ' : ''}
                </span>
              ))}
          </p>
        )}
      </section>
    </div>
  )
}
