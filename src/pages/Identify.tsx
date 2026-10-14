import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { type MetaObject, countryFlag, countryLabel, useCountryMap, useMetaObjects } from '../lib/data'
import { OBJECT_LABEL, VARIANT_LABEL, attrLabel, valueLabel } from '../lib/labels'
import { Loading, MissingData, Swatch } from '../components/ui'

// Búsqueda inversa: "veo esto, ¿qué países encajan?". Un país encaja si tiene
// algún objeto del tipo elegido que no contradice ningún rasgo marcado; se
// ordena por cuántos rasgos confirma.

const ORDER = ['bollard', 'road_lines', 'licence_plate', 'chevron', 'utility_pole', 'google_car', 'sign_back', 'warning_sign', 'stop_sign', 'guardrail']

export default function Identify() {
  const data = useMetaObjects()
  const map = useCountryMap()
  const [type, setType] = useState('bollard')
  const [wanted, setWanted] = useState<Record<string, string>>({})
  const [side, setSide] = useState<'' | 'left' | 'right'>('')

  const objects = useMemo(() => (data?.objects ?? []).filter((o) => o.type === type), [data, type])

  const options = useMemo(() => {
    const byKey = new Map<string, Map<string, Set<string>>>()
    for (const o of objects)
      for (const [k, v] of Object.entries(o.attrs)) {
        if (v === 'other' || v === 'none') continue
        if (!byKey.has(k)) byKey.set(k, new Map())
        const vals = byKey.get(k)!
        if (!vals.has(v)) vals.set(v, new Set())
        vals.get(v)!.add(o.country)
      }
    return [...byKey.entries()].map(([k, vals]) => ({
      key: k,
      values: [...vals.entries()].map(([v, cs]) => ({ value: v, n: cs.size })).sort((a, b) => b.n - a.n),
    }))
  }, [objects])

  const results = useMemo(() => {
    const total = Object.keys(wanted).length
    const best = new Map<string, { o: MetaObject; confirmed: number }>()
    const score = (o: MetaObject, confirmed: number) => confirmed * 10 + (o.variant === 'main' ? 1 : 0)
    for (const o of objects) {
      if (side && map.get(o.country)?.driving_side !== side) continue
      let confirmed = 0
      let conflict = false
      for (const [k, v] of Object.entries(wanted)) {
        if (!(k in o.attrs)) continue
        if (o.attrs[k] === v) confirmed++
        else conflict = true
      }
      if (conflict) continue
      const prev = best.get(o.country)
      if (!prev || score(o, confirmed) > score(prev.o, prev.confirmed)) best.set(o.country, { o, confirmed })
    }
    const list = [...best.values()].sort((a, b) => b.confirmed - a.confirmed)
    return {
      total,
      full: total ? list.filter((r) => r.confirmed === total) : [],
      partial: total ? list.filter((r) => r.confirmed > 0 && r.confirmed < total) : [],
      countries: new Set(objects.map((o) => o.country)).size,
    }
  }, [objects, wanted, side, map])

  if (data === undefined) return <Loading what="rasgos" />
  if (data === null) return <MissingData />

  const rare = Object.entries(wanted)
    .map(([k, v]) => ({ k, v, n: options.find((o) => o.key === k)?.values.find((x) => x.value === v)?.n ?? 0 }))
    .filter((x) => x.n > 0 && x.n <= 2)

  const toggle = (k: string, v: string) =>
    setWanted((w) => {
      const next = { ...w }
      if (next[k] === v) delete next[k]
      else next[k] = v
      return next
    })

  return (
    <div>
      <header className="page-head">
        <h1>¿Qué estás viendo?</h1>
        <p className="lead">Marca lo que reconoces y te decimos qué países encajan.</p>
      </header>

      <div className="toolbar">
        <div className="seg">
          {ORDER.filter((t) => data.objects.some((o) => o.type === t)).map((t) => (
            <button key={t} className={type === t ? 'on' : ''} onClick={() => { setType(t); setWanted({}) }}>
              {OBJECT_LABEL[t]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="identify">
        <aside className="filters-panel">
          <div className="filter-group">
            <span className="eyebrow">Conduce por</span>
            <div className="seg">
              <button className={side === '' ? 'on' : ''} onClick={() => setSide('')}>Cualquiera</button>
              <button className={side === 'right' ? 'on' : ''} onClick={() => setSide('right')}>Derecha</button>
              <button className={side === 'left' ? 'on' : ''} onClick={() => setSide('left')}>Izquierda</button>
            </div>
          </div>
          {options.map((opt) => (
            <div key={opt.key} className="filter-group">
              <span className="eyebrow">{attrLabel(opt.key)}</span>
              <div className="option-chips">
                {opt.values.map((v) => (
                  <button key={v.value} className={`chip ${wanted[opt.key] === v.value ? 'on' : ''}`} onClick={() => toggle(opt.key, v.value)}>
                    <Swatch value={v.value} /> {valueLabel(v.value)} <span className="count">{v.n}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {results.total > 0 && <button className="btn btn-quiet" onClick={() => setWanted({})}>Borrar selección</button>}
        </aside>

        <section className="results">
          {results.total === 0 ? (
            <div className="empty">Elige al menos un rasgo. Hay datos de {results.countries} países.</div>
          ) : (
            <>
              {rare.map((x) => (
                <p key={x.k} className="note">
                  {attrLabel(x.k)}: {valueLabel(x.v)} solo aparece en {x.n === 1 ? 'un país' : 'dos países'}. Es una pista fuerte.
                </p>
              ))}
              <div className="row">
                <h2>Encajan</h2>
                <span className="muted">{results.full.length} de {results.countries} países con datos</span>
              </div>
              {results.full.length === 0 ? (
                <p className="muted">Ningún país confirma todo a la vez. Prueba a quitar un rasgo.</p>
              ) : (
                <div className="result-list">
                  {results.full.map(({ o }) => (
                    <Link key={o.country} to={`/pais/${o.country}`} className="result">
                      <span className="flag">{countryFlag(map, o.country)}</span>
                      <span>
                        {countryLabel(map, o.country)}
                        {(o.variant !== 'main' || o.region) && (
                          <span className="muted"> · {[o.variant !== 'main' ? VARIANT_LABEL[o.variant] : null, o.region].filter(Boolean).join(' · ')}</span>
                        )}
                        {o.features.length > 0 && <small>{o.features.slice(0, 3).join(' · ')}</small>}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {results.partial.length > 0 && (
                <div className="filter-group">
                  <span className="eyebrow">No lo contradicen ({results.partial.length})</span>
                  <p className="muted small">Confirman parte de lo marcado; del resto no hay datos.</p>
                  <div className="chips">
                    {results.partial.map(({ o, confirmed }) => (
                      <Link key={o.country} to={`/pais/${o.country}`} className="chip">
                        {countryFlag(map, o.country)} {countryLabel(map, o.country)} <span className="muted">{confirmed}/{results.total}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
