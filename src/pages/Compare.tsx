import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  type CountryFile, type MetaObject, countryFlag, countryLabel, loadJson, useCountries, useCountryMap, useMetaObjects,
} from '../lib/data'
import { hintText, useLang } from '../lib/i18n'
import { OBJECT_LABEL, VARIANT_LABEL, attrLabel, valueLabel } from '../lib/labels'
import { CountryChip, Loading, MissingData, Swatch } from '../components/ui'

const MAX = 4

function useCountryFiles(codes: string[]) {
  const [files, setFiles] = useState<Map<string, CountryFile>>(new Map())
  const key = codes.join(',')
  useEffect(() => {
    let alive = true
    const list = key.split(',').filter(Boolean)
    Promise.all(list.map((c) => loadJson<CountryFile>(`/community/country/${c}.json`).then((f) => [c, f] as const))).then(
      (pairs) => {
        if (alive) setFiles(new Map(pairs.filter((p): p is readonly [string, CountryFile] => Boolean(p[1]))))
      },
    )
    return () => {
      alive = false
    }
  }, [key])
  return files
}

function SideBySide({ codes }: { codes: string[] }) {
  const data = useMetaObjects()
  const map = useCountryMap()
  const files = useCountryFiles(codes)
  const lang = useLang()

  const rows = useMemo(() => {
    const objs = (data?.objects ?? []).filter((o) => codes.includes(o.country))
    return [...new Set(objs.map((o) => o.type))]
      .map((type) => {
        const cells = codes.map((c) =>
          objs.filter((o) => o.type === type && o.country === c).sort((a, b) => (a.variant === 'main' ? 0 : 1) - (b.variant === 'main' ? 0 : 1)),
        )
        const mainVals = new Map<string, Set<string>>()
        for (const list of cells) {
          const main = list.find((o) => o.variant === 'main') ?? list[0]
          if (!main) continue
          for (const [k, v] of Object.entries(main.attrs)) {
            if (!mainVals.has(k)) mainVals.set(k, new Set())
            mainVals.get(k)!.add(v)
          }
        }
        return { type, cells, differs: (k: string) => (mainVals.get(k)?.size ?? 0) > 1 }
      })
      .filter((r) => r.cells.filter((c) => c.length).length >= 2)
  }, [data, codes])

  const notes = useMemo(() => {
    const out: { o: MetaObject; other: string; kind: 'same' | 'confused'; note: string | null }[] = []
    for (const o of data?.objects ?? []) {
      if (!codes.includes(o.country)) continue
      for (const c of o.alsoIn) if (codes.includes(c)) out.push({ o, other: c, kind: 'same', note: null })
      for (const c of o.confusedWith) if (codes.includes(c.country)) out.push({ o, other: c.country, kind: 'confused', note: c.difference })
    }
    return out
  }, [data, codes])

  if (data === undefined) return <Loading what="rasgos" />
  if (data === null) return <MissingData />

  return (
    <div className="cols">
      {notes.length > 0 && (
        <section className="filter-group">
          <h2>Lo que dicen las fuentes</h2>
          <div className="hints">
            {notes.map((n, i) => (
              <div key={i} className="hint">
                <p>
                  <strong>{OBJECT_LABEL[n.o.type]?.label}</strong> de {countryLabel(map, n.o.country)}:{' '}
                  {n.kind === 'same' ? 'es el mismo que en ' : 'se confunde con el de '}
                  {countryLabel(map, n.other)}.
                </p>
                {n.note && <p className="muted">{n.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="filter-group">
        <h2>Rasgo a rasgo</h2>
        <p className="muted small">En negrita, lo que cambia entre países en su diseño principal. Atenuado, lo que comparten.</p>
        {rows.length === 0 ? (
          <div className="empty">No hay objetos comparables entre estos países.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  {codes.map((c) => (
                    <th key={c}><Link to={`/pais/${c}`}>{countryFlag(map, c)} {countryLabel(map, c)}</Link></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.type}>
                    <td>{OBJECT_LABEL[r.type]?.label}</td>
                    {r.cells.map((list, i) => (
                      <td key={codes[i]}>
                        {list.length === 0 && <span className="muted">Sin datos</span>}
                        {list.slice(0, 3).map((o) => (
                          <div key={o.id} className="cell-variant">
                            {(o.variant !== 'main' || o.region) && (
                              <div className="muted small">{[o.variant !== 'main' ? VARIANT_LABEL[o.variant] : null, o.region].filter(Boolean).join(' · ')}</div>
                            )}
                            {Object.entries(o.attrs).map(([k, v]) => (
                              <div key={k} className={`cell-trait ${o.variant === 'main' && r.differs(k) ? 'diff' : 'same'}`}>
                                <Swatch value={v} /> {attrLabel(k)}: {valueLabel(v)}
                              </div>
                            ))}
                          </div>
                        ))}
                        {list.length > 3 && <div className="muted small">y {list.length - 3} variantes más</div>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="filter-group">
        <h2>Lo esencial de cada uno</h2>
        <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))` }}>
          {codes.map((c) => {
            const f = files.get(c)
            const hints = new Map((f?.hints ?? []).map((h) => [h.id, h]))
            const top = (f?.clusters ?? []).filter((x) => x.usefulness === 3).sort((a, b) => b.source_count - a.source_count).slice(0, 5)
            return (
              <div key={c} className="panel">
                <h3 style={{ marginBottom: '0.6rem' }}>{countryFlag(map, c)} {countryLabel(map, c)}</h3>
                {!f ? <span className="muted">Cargando…</span> : (
                  <div className="hints">
                    {top.map((x) => {
                      const h = hints.get(x.canonical_id)
                      return h ? <p key={x.id} className="hint small">{hintText(h, lang)}</p> : null
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function WorldTraits() {
  const data = useMetaObjects()
  const map = useCountryMap()
  const [type, setType] = useState('bollard')
  const [open, setOpen] = useState<string | null>(null)
  if (data === undefined) return <Loading what="rasgos" />
  if (data === null) return <MissingData />

  const traits = data.traits.filter((t) => t.type === type && t.value !== 'other' && t.value !== 'none')
  const keys = [...new Set(traits.map((t) => t.key))]
  const countries = new Set(data.objects.filter((o) => o.type === type).map((o) => o.country)).size

  return (
    <div className="cols">
      <div className="seg">
        {Object.entries(OBJECT_LABEL).filter(([t]) => data.traits.some((x) => x.type === t)).map(([t, l]) => (
          <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{l.label}</button>
        ))}
      </div>
      <p className="muted small">De {countries} países con datos. Lo que tienen pocos países te ubica; lo que tienen muchos, no. Pulsa un valor para ver los países.</p>
      <div className="grid grid-2">
        {keys.map((k) => (
          <div key={k} className="panel bars">
            <h3 style={{ marginBottom: '0.4rem' }}>{attrLabel(k)}</h3>
            {traits.filter((t) => t.key === k).sort((a, b) => a.n - b.n).map((t) => {
              const id = `${t.key}|${t.value}`
              return (
                <div key={id} className={`bar-row ${t.n <= 3 ? 'rare' : ''}`}>
                  <button onClick={() => setOpen(open === id ? null : id)}><Swatch value={t.value} /> {valueLabel(t.value)}</button>
                  <div className="bar"><span style={{ width: `${Math.max(3, (t.n / countries) * 100)}%` }} /></div>
                  <span className="num small muted">{t.n}</span>
                  {open === id && <div className="chips bar-countries">{t.countries.map((c) => <CountryChip key={c} code={c} map={map} />)}</div>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Compare() {
  const [params, setParams] = useSearchParams()
  const countries = useCountries()
  const map = useCountryMap()
  const [tab, setTab] = useState<'side' | 'world'>(params.get('tab') === 'world' ? 'world' : 'side')
  const codes = (params.get('c') ?? '').split(',').filter(Boolean).slice(0, MAX)
  const setCodes = (next: string[]) => setParams({ c: next.join(',') }, { replace: true })
  const suggested = codes.length === 1 ? (map.get(codes[0])?.confusable ?? []).slice(0, 5) : []

  return (
    <div>
      <header className="page-head">
        <h1>Comparar</h1>
        <p className="lead">Pon lado a lado los países que confundes y mira qué rasgo los separa.</p>
      </header>

      <div className="toolbar">
        <div className="seg">
          <button className={tab === 'side' ? 'on' : ''} onClick={() => setTab('side')}>Países lado a lado</button>
          <button className={tab === 'world' ? 'on' : ''} onClick={() => setTab('world')}>Rasgos comunes y exclusivos</button>
        </div>
      </div>

      {tab === 'world' ? (
        <WorldTraits />
      ) : (
        <div className="cols">
          <div className="toolbar" style={{ marginBottom: 0 }}>
            {codes.map((c) => (
              <span key={c} className="chip">
                {countryFlag(map, c)} {countryLabel(map, c)}
                <button className="x" onClick={() => setCodes(codes.filter((x) => x !== c))} aria-label="Quitar">×</button>
              </span>
            ))}
            {codes.length < MAX && (
              <select className="select" value="" onChange={(e) => e.target.value && setCodes([...codes, e.target.value])}>
                <option value="">Añadir país…</option>
                {(countries ?? [])
                  .filter((c) => c.objects > 0 && !codes.includes(c.code))
                  .sort((a, b) => (a.name_es ?? a.name).localeCompare(b.name_es ?? b.name, 'es'))
                  .map((c) => <option key={c.code} value={c.code}>{c.name_es ?? c.name}</option>)}
              </select>
            )}
            {suggested.length > 0 && <span className="muted small">Sugeridos:</span>}
            {suggested.map((c) => (
              <button key={c} className="chip" onClick={() => setCodes([...codes, c])}>+ {countryLabel(map, c)}</button>
            ))}
          </div>
          {codes.length < 2 ? (
            <div className="empty">
              Elige al menos dos países. Por ejemplo:{' '}
              <button className="link" onClick={() => setCodes(['hu', 'hr', 'ro'])}>Hungría, Croacia y Rumanía</button>,{' '}
              <button className="link" onClick={() => setCodes(['se', 'no', 'fi'])}>Suecia, Noruega y Finlandia</button> o{' '}
              <button className="link" onClick={() => setCodes(['uy', 'ar'])}>Uruguay y Argentina</button>.
            </div>
          ) : (
            <SideBySide codes={codes} />
          )}
        </div>
      )}
    </div>
  )
}
