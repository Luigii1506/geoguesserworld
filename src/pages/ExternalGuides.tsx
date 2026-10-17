import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCountryMap } from '../lib/data'
import { REGION_ES } from '../lib/labels'
import { KIND_LABEL, LEVEL_LABEL, useResources, type ExternalGuide, type ResourceKind } from '../lib/resources'
import { ExternalGuideRow } from '../components/ExternalGuide'
import { CountryPicker } from '../components/geo/CountryPicker'
import { Loading, MissingData } from '../components/ui'

// Guías externas: lo que otros jugadores han publicado (documentos, mapas, infografías,
// vídeos), por país. Solo enlaces: cada guía se abre en su sitio. La lista y las valoraciones
// son de la Regionguessing Meta Library de Lupus. Filtros en la URL: ?pais=&continente=&nivel=&tipo=&q=

const REGIONS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']
// la hoja separa América del Norte y del Sur; la app, como el resto, usa «América»
const CONTINENT: Record<string, string> = { Europe: 'Europe', Asia: 'Asia', Africa: 'Africa', 'North America': 'Americas', 'South America': 'Americas', Oceania: 'Oceania' }
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

export default function ExternalGuides() {
  const data = useResources()
  const map = useCountryMap()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const cc = params.get('pais') ?? ''
  const region = params.get('continente') ?? ''
  const level = params.get('nivel') ?? ''
  const kind = params.get('tipo') ?? ''
  const set = (patch: Record<string, string | null>) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k))
      return n
    }, { replace: true })

  const name = (c: string) => map.get(c)?.name_es ?? map.get(c)?.name ?? c.toUpperCase()
  const keep = (g: ExternalGuide) => (!level || g.lv === level) && (!kind || g.k === kind)
  const needle = fold(q.trim())
  const matches = (g: ExternalGuide) => !needle || fold(`${g.t} ${g.d ?? ''} ${g.a ?? ''}`).includes(needle)

  const countries = useMemo(
    () =>
      Object.entries(data?.countries ?? {})
        .map(([code, c]) => ({ code, ...c, region: CONTINENT[c.continent] ?? c.continent }))
        .sort((a, b) => name(a.code).localeCompare(name(b.code), 'es')),
    [data, map], // eslint-disable-line react-hooks/exhaustive-deps
  )
  if (data === undefined || !map.size) return <Loading what="las guías" />
  if (!data) return <MissingData />

  const total = countries.reduce((a, c) => a + c.items.length, 0)
  const kinds = [...new Set(countries.flatMap((c) => c.items.map((i) => i.k)))] as ResourceKind[]
  const options = countries.map((c) => ({ code: c.code, n: c.items.length, flag: map.get(c.code)?.flag ?? '', name: name(c.code), alt: map.get(c.code)?.name ?? '' }))
  const current = cc ? countries.find((c) => c.code === cc) : undefined
  const inRegion = countries.filter((c) => !region || c.region === region)
  // buscando sin país: las guías que coinciden en todos los países (del continente elegido)
  const found = !current && needle ? inRegion.flatMap((c) => c.items.filter((g) => keep(g) && matches(g)).map((g) => ({ g, cc: c.code }))) : []

  return (
    <div className="xguides">
      <header className="page-head">
        <h1>Guías externas</h1>
        <p className="lead">
          {total} documentos, mapas, infografías y vídeos que otros jugadores han publicado para {countries.length} países. Aquí solo están los enlaces: cada guía se abre en su sitio, con su autor.
        </p>
        <p className="muted small">
          La lista, el nivel y la utilidad de cada guía son de la <a href={data.library.url} target="_blank" rel="noreferrer">{data.library.name}</a>, de {data.library.author}
          {' '}· actualizada el {new Date(data.generatedAt).toLocaleDateString('es')}.
        </p>
      </header>

      {!current && !needle && (
        <section className="xg-section">
          <h2>Para cualquier país</h2>
          <div className="xg-general">
            {data.general.map((g) => (
              <a key={g.u} className="xg-card" href={g.u} target="_blank" rel="noreferrer">
                <strong>{g.t} <span aria-hidden="true">↗</span></strong>
                <span>{g.d}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="xg-section">
        {!current && <h2>Por país</h2>}
        <div className="toolbar xg-toolbar">
          <CountryPicker value={cc} onChange={(v) => set({ pais: v || null })} options={options} />
          <input
            className="input xg-search"
            value={q}
            onChange={(e) => set({ q: e.target.value || null })}
            placeholder={current ? `Buscar en ${name(current.code)}: postes, regiones…` : 'Buscar en todas: postes, matrículas, regiones…'}
            aria-label="Buscar guías"
          />
        </div>
        {!current && (
          <div className="seg xg-regions">
            <button className={!region ? 'on' : ''} onClick={() => set({ continente: null })}>Todo</button>
            {REGIONS.map((r) => <button key={r} className={region === r ? 'on' : ''} onClick={() => set({ continente: r })}>{REGION_ES[r]}</button>)}
          </div>
        )}
        {(current || needle) && (
          <div className="chips xg-filters" role="group" aria-label="Filtros">
            <span className="eyebrow">Nivel</span>
            {(['', 'basic', 'all', 'advanced'] as const).map((l) => (
              <button key={l || 'todo'} className={`chip ${level === l ? 'on' : ''}`} onClick={() => set({ nivel: l || null })}>{l ? LEVEL_LABEL[l] : 'Todos'}</button>
            ))}
            <span className="eyebrow">Tipo</span>
            <button className={`chip ${!kind ? 'on' : ''}`} onClick={() => set({ tipo: null })}>Todos</button>
            {kinds.map((k) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => set({ tipo: kind === k ? null : k })}>{KIND_LABEL[k]}</button>)}
          </div>
        )}

        {current ? (
          <CountryGuides code={current.code} name={name(current.code)} flag={map.get(current.code)?.flag ?? ''} items={current.items.filter((g) => keep(g) && matches(g))} all={current.items.length} areaCodes={current.areaCodes} hasGuide={(map.get(current.code)?.groups ?? 0) > 0} />
        ) : needle ? (
          <div className="xg-list">
            <p className="muted small">{found.length} {found.length === 1 ? 'guía' : 'guías'} con «{q.trim()}»</p>
            {found.slice(0, 200).map(({ g, cc: c }) => <ExternalGuideRow key={c + g.u} g={g} flag={map.get(c)?.flag ?? undefined} />)}
          </div>
        ) : (
          <div className="xg-countries">
            {inRegion.map((c) => {
              const first = c.items.find((g) => g.start) ?? c.items[0]
              return (
                <button key={c.code} className="xg-country" onClick={() => (set({ pais: c.code }), window.scrollTo({ top: 0 }))}>
                  <span className="flag" aria-hidden="true">{map.get(c.code)?.flag}</span>
                  <span className="xg-country-main">
                    <strong>{name(c.code)}</strong>
                    <span className="muted small">{c.items.length} {c.items.length === 1 ? 'guía' : 'guías'}{first ? ` · empieza por «${first.t}»` : ''}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function CountryGuides({ code, name, flag, items, all, areaCodes, hasGuide }: { code: string; name: string; flag: string; items: ExternalGuide[]; all: number; areaCodes?: string; hasGuide: boolean }) {
  return (
    <div className="xg-list">
      <div className="xg-country-head">
        <span className="flag" aria-hidden="true">{flag}</span>
        <div>
          <h2>{name}</h2>
          <span className="muted small">
            {items.length === all ? `${all} guías` : `${items.length} de ${all} guías`}
            {hasGuide && <> · <Link to={`/pais/${code}`}>su guía en GeoMastery</Link></>}
          </span>
        </div>
      </div>
      {items.length === 0 && <p className="muted">Ninguna guía con estos filtros.</p>}
      {items.map((g) => <ExternalGuideRow key={g.u + g.t} g={g} />)}
      {areaCodes && (
        <p className="xg-parts">
          Y el mapa de <a href={areaCodes} target="_blank" rel="noreferrer">prefijos telefónicos de {name}</a> ↗
        </p>
      )}
    </div>
  )
}
