import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCountries } from '../lib/data'
import { REGION_ES } from '../lib/labels'
import { Loading, MissingData } from '../components/ui'
import { masteryByCountry } from '../lib/study/stats'
import { useStudy } from '../lib/study/store'

const REGIONS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']
// el mapa (d3 + fronteras) se carga solo al abrir esa vista
const WorldMap = lazy(() => import('../components/WorldMap'))

export default function Countries() {
  const countries = useCountries()
  const study = useStudy()
  // tu dominio de cada país (si ya lo estudias)
  const mastery = useMemo(() => masteryByCountry(study), [study.cards, study.reviews]) // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('')
  const [order, setOrder] = useState<'rich' | 'name'>('rich')
  const [params, setParams] = useSearchParams()
  const mode = params.get('vista') === 'mapa' ? 'map' : 'list'
  const setMode = (m: 'map' | 'list') => setParams(m === 'map' ? { vista: 'mapa' } : {}, { replace: true })

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (countries ?? [])
      .filter((c) => c.groups > 0)
      .filter((c) => !region || c.region === region)
      .filter((c) => !needle || `${c.name_es} ${c.name}`.toLowerCase().includes(needle))
      .sort((a, b) =>
        order === 'rich' ? b.groups - a.groups : (a.name_es ?? a.name).localeCompare(b.name_es ?? b.name, 'es'),
      )
  }, [countries, q, region, order])

  if (countries === undefined) return <Loading what="países" />
  if (countries === null) return <MissingData />

  return (
    <div>
      <header className="page-head">
        <h1>Países</h1>
        <p className="lead">Cada guía empieza por lo esencial: las pistas que por sí solas te ubican.</p>
      </header>

      <div className="toolbar countries-toolbar">
        <input className="input countries-search" placeholder="Buscar país" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg">
          <button className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>Lista</button>
          <button className={mode === 'map' ? 'on' : ''} onClick={() => setMode('map')}>Mapa</button>
        </div>
        {mode === 'list' && (
        <>
        <div className="seg">
          <button className={order === 'rich' ? 'on' : ''} onClick={() => setOrder('rich')}>Más pistas</button>
          <button className={order === 'name' ? 'on' : ''} onClick={() => setOrder('name')}>A–Z</button>
        </div>
        <div className="seg">
          <button className={!region ? 'on' : ''} onClick={() => setRegion('')}>Todos</button>
          {REGIONS.map((r) => (
            <button key={r} className={region === r ? 'on' : ''} onClick={() => setRegion(r)}>{REGION_ES[r]}</button>
          ))}
        </div>
        </>
        )}
      </div>

      {mode === 'map' ? (
        <Suspense fallback={<div className="empty">Cargando mapa…</div>}>
          <WorldMap countries={countries} highlight={q.trim() ? new Set(list.map((c) => c.code)) : undefined} />
        </Suspense>
      ) : list.length === 0 ? (
        <div className="empty">Ningún país coincide.</div>
      ) : (
        <div className="country-list">
          {list.map((c) => (
            <Link key={c.code} to={`/pais/${c.code}`} className="country-item">
              <span className="flag">{c.flag}</span>
              <span className="country-item-main">
                <strong>{c.name_es ?? c.name}</strong>
                <small>{c.essential} determinantes · {c.groups} pistas{c.region ? ` · ${REGION_ES[c.region] ?? c.region}` : ''}</small>
              </span>
              {mastery.get(c.code) && (
                <span className="country-known" title="Tu dominio de este país">{Math.round(mastery.get(c.code)!.score * 100)} %</span>
              )}
              <span className="country-go" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
