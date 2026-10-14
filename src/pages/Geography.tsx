import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { REGION_ES } from '../lib/labels'
import { FAMILIES, geo, useGeo, useGeoPages, type GeoCard, type GeoCountryRow, type ListQuery } from '../lib/geo'
import { SORT, SORTS, SORTS_FOR, TAG_GROUPS, kindLabel, nf, type TagGroup } from '../lib/geoFormat'
import { Loading, PlaceMap } from '../components/ui'
import { CountryPicker } from '../components/geo/CountryPicker'
import { GeoCardView, GeoRow } from '../components/geo/GeoCards'
import { CountryAtlas } from '../components/geo/CountryAtlas'

// Geografía: todos los lugares de la base geográfica (docs/geo.md) como fichas
// para aprender. Portada con rankings; filtros por tipo, subtipo, etiquetas
// (estado de un volcán…), continente y país; orden por cualquier dato y vista
// de galería o de ranking. Todo lo filtra y ordena la API; aquí solo se pinta.

const CONTINENTS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania']
const PAGE = 36
// órdenes antiguos en enlaces guardados
const ORDER_ALIAS: Record<string, string> = {
  imp: 'rank', ele: 'elevation', len: 'length', pop: 'population', q: 'discharge', prom: 'prominence',
  le: 'last_eruption', vis: 'visitors', nc: 'countries', az: 'name',
}

// rankings de la portada
const RANKINGS: { title: string; query: ListQuery; params: Record<string, string> }[] = [
  { title: 'Los volcanes más altos', query: { kind: 'volcano', sort: 'elevation' }, params: { tipo: 'montanas', sub: 'volcano', orden: 'elevation' } },
  { title: 'Las montañas más altas', query: { kind: 'mountain', sort: 'elevation' }, params: { tipo: 'montanas', sub: 'mountain', orden: 'elevation' } },
  { title: 'Los ríos más largos', query: { kind: 'river', sort: 'length' }, params: { tipo: 'agua', sub: 'river', orden: 'length' } },
  { title: 'Las ciudades más pobladas', query: { kind: 'city', sort: 'population' }, params: { tipo: 'ciudades', sub: 'city', orden: 'population' } },
  { title: 'Patrimonio de la Humanidad', query: { tags: ['unesco'], sort: 'rank' }, params: { unesco: '1' } },
  { title: 'Volcanes activos', query: { kind: 'volcano', tags: ['activo'], sort: 'rank' }, params: { tipo: 'montanas', sub: 'volcano', estado: 'activo' } },
  { title: 'Los ríos más caudalosos', query: { kind: 'river', sort: 'discharge' }, params: { tipo: 'agua', sub: 'river', orden: 'discharge' } },
  { title: 'Las islas más grandes', query: { kind: 'island', sort: 'area' }, params: { tipo: 'islas', sub: 'island', orden: 'area' } },
  { title: 'Los lagos más grandes', query: { kind: 'lake', sort: 'area' }, params: { tipo: 'agua', sub: 'lake', orden: 'area' } },
  { title: 'Los desiertos más extensos', query: { kind: 'desert', sort: 'area' }, params: { tipo: 'relieve', sub: 'desert', orden: 'area' } },
]

function Ranking({ r, countries, onOpen, onAll }: { r: (typeof RANKINGS)[number]; countries: Map<string, GeoCountryRow>; onOpen: (c: GeoCard) => void; onAll: () => void }) {
  const { data } = useGeo(`rank:${r.title}`, () => geo.list({ ...r.query, limit: 10 }))
  const items = (data?.items ?? []).filter((c) => r.query.sort === 'rank' || c.value != null)
  if (data && items.length < 3) return null
  return (
    <section className="geo-ranking">
      <header>
        <h2>{r.title}</h2>
        <button className="link" onClick={onAll}>Ver el ranking completo →</button>
      </header>
      <div className="geo-strip">
        {data ? items.map((c, i) => <GeoCardView key={c.id} c={c} countries={countries} rank={i + 1} onOpen={onOpen} />) : <div className="geo-strip-skel" />}
      </div>
    </section>
  )
}

export default function Geography() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [open, setOpen] = useState<GeoCard | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)
  const meta = useGeo('meta', geo.meta)
  const countryRows = useGeo('countries', geo.countries)
  const countries = useMemo(() => new Map((countryRows.data?.items ?? []).map((c) => [c.cc, c])), [countryRows.data])

  const fam = params.get('tipo') ?? ''
  const sub = params.get('sub') ?? ''
  const cont = params.get('continente') ?? ''
  const cc = params.get('pais') ?? ''
  const unesco = params.get('unesco') === '1'
  const inHints = params.get('pistas') === '1'
  const view = params.get('vista') === 'ranking' ? 'ranking' : 'galeria'
  const family = FAMILIES.find((f) => f.id === fam)
  const rawSort = params.get('orden') ?? ''
  const sort = SORT.has(ORDER_ALIAS[rawSort] ?? rawSort) ? ORDER_ALIAS[rawSort] ?? rawSort : 'rank'
  // grupos de etiquetas: los fijos (volcanes) y el bioma de las ecorregiones, desde la leyenda de su capa
  const biomeLegend = meta.data?.layers.find((l) => l.id === 'biome')?.legend ?? []
  const allGroups: TagGroup[] = [...TAG_GROUPS, { id: 'bioma', label: 'Bioma', kinds: ['ecoregion'], tags: biomeLegend.map((b) => ({ tag: b.key, label: b.label })) }]
  const groups = allGroups.filter((g) => sub && g.kinds.includes(sub))
  const tags = [...(unesco ? ['unesco'] : []), ...groups.map((g) => params.get(g.id) ?? '').filter(Boolean)]
  const text = params.get('q') ?? ''
  // dentro de una entidad (estado, área urbana, cordillera…): desde "Ver sus lugares" de una ficha
  const within = params.get('dentro') ?? ''
  const withinEntity = useGeo(within ? `entity:${within}` : null, () => geo.entity(within))

  const query: ListQuery = {
    q: text || undefined, family: sub ? undefined : fam || undefined, kind: sub || undefined, cc: cc || undefined,
    continent: cc ? undefined : cont || undefined, within: within || undefined, tags, hints: inHints, sort,
  }
  const list = useGeoPages(query, PAGE)
  const country = useGeo(cc ? `country:${cc}` : null, () => geo.country(cc))

  const setMany = (changes: Record<string, string>, top = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
    if (top) window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const groupReset = Object.fromEntries(allGroups.map((g) => [g.id, '']))
  const set = (k: string, v: string) =>
    setMany({
      [k]: v,
      ...(k === 'continente' ? { pais: '' } : {}),
      ...(k === 'tipo' ? { sub: '', orden: '', ...groupReset } : {}),
      ...(k === 'sub' ? groupReset : {}),
    })

  // búsqueda con una pausa corta
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (text !== q.trim()) set('q', q.trim())
    }, 220)
    return () => window.clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  // la galería se va cargando al bajar
  useEffect(() => {
    const el = sentinel.current
    if (!el || list.done) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && list.more(), { rootMargin: '900px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [list.done, list.items.length, list.key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (meta.error) return <div className="empty">No se pudo cargar la base geográfica: {meta.error}</div>
  if (!meta.data || !countryRows.data) return <Loading what="la geografía" />

  const kindCount = list.facets?.kinds ?? {}
  const famCount = new Map(FAMILIES.map((f) => [f.id, f.kinds.reduce((n, k) => n + (kindCount[k] ?? 0), 0)]))
  const landing = !fam && !sub && !cont && !cc && !unesco && !inHints && !text && !rawSort && !within
  const totalPlaces = Object.entries(meta.data.totals).filter(([k]) => k !== 'country' && k !== 'admin1').reduce((n, [, v]) => n + v, 0)
  const sorts = SORTS.filter((s) => !fam || (SORTS_FOR[fam] ?? []).includes(s.id))
  const maxValue = Math.max(0, ...list.items.slice(0, 200).map((c) => (sort === 'hints' ? c.hints : c.value ?? 0)))
  const byValue = SORT.get(sort)?.format !== undefined
  const countryOptions = countryRows.data.items.filter((c) => c.places > 0).map((c) => ({ code: c.cc, n: c.places, flag: c.flag ?? '', name: c.name, alt: c.name_en ?? '' }))
  const openCard = (c: GeoCard) => setOpen(c)

  return (
    <div className="geo">
      <header className="geo-hero">
        <span className="eyebrow">Geografía</span>
        <h1>Ponle cara a cada nombre</h1>
        <p className="lead">
          {nf(totalPlaces)} volcanes, ríos, montañas, llanuras, ciudades, monumentos y templos del mundo. Ordénalos por lo conocidos, altos, largos o poblados que son, y ábrelos para ver dónde están y cómo son.
        </p>
      </header>

      <div className="geo-bar">
        <input className="input geo-search" type="search" placeholder="Busca un lugar: Malinche, Danubio, Kioto…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="geo-chips">
          <button className={`fx-chip-t ${!fam ? 'on' : ''}`} onClick={() => set('tipo', '')}>Todo</button>
          {FAMILIES.filter((f) => famCount.get(f.id) || fam === f.id).map((f) => (
            <button key={f.id} className={`fx-chip-t ${fam === f.id ? 'on' : ''}`} onClick={() => set('tipo', fam === f.id ? '' : f.id)}>
              {f.label} <span>{nf(famCount.get(f.id) ?? 0)}</span>
            </button>
          ))}
        </div>
        {family && family.kinds.filter((k) => kindCount[k]).length > 1 && (
          <div className="geo-chips geo-subs">
            <button className={`fx-chip-s ${!sub ? 'on' : ''}`} onClick={() => set('sub', '')}>Todos</button>
            {family.kinds.filter((k) => kindCount[k]).map((k) => (
              <button key={k} className={`fx-chip-s ${sub === k ? 'on' : ''}`} onClick={() => set('sub', sub === k ? '' : k)}>
                {kindLabel(k)} <span>{nf(kindCount[k])}</span>
              </button>
            ))}
          </div>
        )}
        {groups.map((g) => {
          const cur = params.get(g.id) ?? ''
          const vals = g.tags.filter((t) => (list.facets?.tags[t.tag] ?? 0) > 0 || t.tag === cur)
          if (!vals.length) return null
          return (
            <div key={g.id} className="geo-chips geo-facet">
              <span className="geo-facet-label">{g.label}</span>
              {vals.map((t) => (
                <button key={t.tag} title={t.help} className={`fx-chip-s geo-f-${t.tag} ${cur === t.tag ? 'on' : ''}`} onClick={() => setMany({ [g.id]: cur === t.tag ? '' : t.tag })}>
                  {t.label} <span>{nf(list.facets?.tags[t.tag] ?? 0)}</span>
                </button>
              ))}
            </div>
          )
        })}
        <div className="geo-where">
          <select className="input geo-cont-m" value={cont} onChange={(e) => set('continente', e.target.value)}>
            <option value="">Todo el mundo</option>
            {CONTINENTS.map((r) => <option key={r} value={r}>{REGION_ES[r]}</option>)}
          </select>
          <div className="seg seg-sm geo-cont">
            <button className={!cont ? 'on' : ''} onClick={() => set('continente', '')}>Mundo</button>
            {CONTINENTS.map((r) => (
              <button key={r} className={cont === r ? 'on' : ''} onClick={() => set('continente', cont === r ? '' : r)}>{REGION_ES[r]}</button>
            ))}
          </div>
          <CountryPicker value={cc} onChange={(v) => setMany({ pais: v, continente: v ? '' : cont })} options={countryOptions} />
        </div>
      </div>

      {/* país elegido: cabecera, mapa de terreno y accesos directos a cada tipo */}
      {cc && country.data && (
        <section className="geo-country-head">
          <div className="geo-country-name">
            <span className="flag">{country.data.flag}</span>
            <div>
              <h2>{country.data.name}</h2>
              <span className="muted small">{nf(countries.get(cc)?.places ?? 0)} lugares</span>
            </div>
            {country.data.guide && <a className="link" href={`#/pais/${cc}`}>Guía de GeoGuessr →</a>}
          </div>
          <CountryAtlas country={country.data} onOpen={openCard} />
          <div className="geo-country-types">
            {FAMILIES.flatMap((f) => f.kinds).map((k) => {
              const n = country.data!.counts[k]
              if (!n) return null
              const on = sub === k
              return (
                <button key={k} className={`geo-ctype ${on ? 'on' : ''}`} onClick={() => setMany(on ? { tipo: '', sub: '' } : { tipo: FAMILIES.find((f) => f.kinds.includes(k))!.id, sub: k })}>
                  <strong>{nf(n)}</strong>
                  <span>{kindLabel(k)}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {landing && (
        <div className="geo-rankings">
          {RANKINGS.map((r) => (
            <Ranking key={r.title} r={r} countries={countries} onOpen={openCard} onAll={() => setMany({ ...r.params, vista: r.params.orden ? 'ranking' : '' }, true)} />
          ))}
          <h2 className="geo-all">Explora todo</h2>
        </div>
      )}

      {within && (
        <div className="geo-within">
          <span>Dentro de</span>
          <strong>{withinEntity.data ? `${kindLabel(withinEntity.data.kind)}: ${withinEntity.data.name}` : '…'}</strong>
          <button className="fx-chip" onClick={() => setMany({ dentro: '' })}>Quitar <span>×</span></button>
        </div>
      )}

      <div className="geo-tools">
        <p className="geo-count"><strong>{nf(list.total)}</strong> lugares</p>
        <button className={`geo-toggle ${inHints ? 'on' : ''}`} onClick={() => setMany({ pistas: inHints ? '' : '1' })}>
          <span className="geo-toggle-dot" />Con pistas de GeoGuessr <b>{nf(list.facets?.hints ?? 0)}</b>
        </button>
        <button className={`geo-toggle ${unesco ? 'on' : ''}`} onClick={() => setMany({ unesco: unesco ? '' : '1' })}>
          <span className="geo-toggle-dot" />Patrimonio UNESCO
        </button>
        <div className="seg seg-sm geo-view">
          <button className={view === 'galeria' ? 'on' : ''} onClick={() => setMany({ vista: '' })}>Galería</button>
          <button className={view === 'ranking' ? 'on' : ''} onClick={() => setMany({ vista: 'ranking' })}>Ranking</button>
        </div>
      </div>
      <div className="geo-sorts" role="group" aria-label="Ordenar por">
        <span>Ordenar por</span>
        {sorts.map((s) => (
          <button key={s.id} className={`fx-chip-s ${sort === s.id ? 'on' : ''}`} onClick={() => setMany({ orden: s.id === 'rank' ? '' : s.id })}>{s.label}</button>
        ))}
      </div>

      {list.error ? (
        <div className="empty">No se pudo cargar: {list.error}</div>
      ) : list.items.length === 0 && !list.loading ? (
        <div className="empty">Nada coincide. Prueba con otro tipo o país.</div>
      ) : view === 'ranking' ? (
        <ol className={`geo-list ${list.stale ? 'is-stale' : ''}`}>
          {list.items.map((c, i) => (
            <GeoRow key={c.id} c={c} countries={countries} n={!byValue || c.value != null || sort === 'hints' ? i + 1 : null} sort={sort} max={maxValue} onOpen={openCard} />
          ))}
        </ol>
      ) : (
        <div className={`geo-grid ${list.stale ? 'is-stale' : ''}`}>
          {list.items.map((c, i) => (
            <GeoCardView key={c.id} c={c} countries={countries} rank={byValue && c.value != null ? i + 1 : undefined} onOpen={openCard} />
          ))}
        </div>
      )}
      {!list.done && <div ref={sentinel} className="lib-sentinel">Cargando más…</div>}

      {open && (
        <PlaceMap places={[{ id: open.id, n: open.name_en ?? open.name, es: open.name, lat: open.lat, lng: open.lng, k: open.kind, cc: open.cc }]} index={0} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}
